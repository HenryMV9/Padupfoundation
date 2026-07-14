/*
# Harden RLS Policies & Fix Function Search Path

## Overview
Addresses all flagged security issues:
- Fixes mutable search_path on `update_updated_at` function.
- Replaces overly permissive `USING (true)` admin policies with a proper
  admin-role check: `(auth.jwt() -> 'raw_app_meta_data' ->> 'role') = 'admin'`.
- Constrains public INSERT policies with meaningful field validation.
- Removes overly broad storage SELECT policy that allowed anonymous file listing.

## Changes

### 1. Function: `update_updated_at`
- Recreated with `SET search_path = ''` to make it immutable.

### 2. Table: `donations`
- `public_insert_donation`: Now requires amount > 0 AND flutterwave_tx_id IS NOT NULL.
- `admin_update_donations`: Now restricted to admin role.
- `admin_delete_donations`: Now restricted to admin role.

### 3. Table: `gallery_images`
- `admin_insert_gallery`: Now restricted to admin role.
- `admin_update_gallery`: Now restricted to admin role.
- `admin_delete_gallery`: Now restricted to admin role.

### 4. Table: `news_articles`
- `admin_insert_news`: Now restricted to admin role.
- `admin_update_news`: Now restricted to admin role.
- `admin_delete_news`: Now restricted to admin role.

### 5. Table: `newsletter_subscribers`
- `public_insert_subscriber`: Now requires email IS NOT NULL AND first_name IS NOT NULL AND length(trim(email)) > 0.
- `admin_update_subscribers`: Now restricted to admin role.
- `admin_delete_subscribers`: Now restricted to admin role.

### 6. Storage: `gallery` bucket
- Removed broad `public_read_gallery_storage` SELECT policy that allowed anonymous listing.
- Added `admin_list_gallery_storage` SELECT policy restricted to authenticated admin users.
- Public file access still works via the bucket's public URL (no SELECT policy needed).

## Security Notes
1. Admin role is checked via `auth.jwt() -> 'raw_app_meta_data' ->> 'role'` which is
   user-immutable (cannot be self-assigned via the client). Only server-side or
   service-role operations can set `raw_app_meta_data`.
2. Public INSERT policies now validate data integrity at the database level,
   preventing empty or malformed inserts even if the frontend is bypassed.
3. The storage bucket remains public for serving files via URL, but listing
   (enumerating all files) is now restricted to admin users only.
*/

-- ============================================================
-- 1. FIX FUNCTION SEARCH PATH
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- 2. HARDEN donations POLICIES
-- ============================================================

-- Public insert: require meaningful data
DROP POLICY IF EXISTS "public_insert_donation" ON public.donations;
CREATE POLICY "public_insert_donation" ON public.donations
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    amount > 0
    AND flutterwave_tx_id IS NOT NULL
    AND length(trim(flutterwave_tx_id)) > 0
  );

-- Admin select stays permissive (admin needs to see all donations)
DROP POLICY IF EXISTS "admin_select_donations" ON public.donations;
CREATE POLICY "admin_select_donations" ON public.donations
  FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'raw_app_meta_data' ->> 'role') = 'admin');

-- Admin update: restricted to admin role
DROP POLICY IF EXISTS "admin_update_donations" ON public.donations;
CREATE POLICY "admin_update_donations" ON public.donations
  FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'raw_app_meta_data' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'raw_app_meta_data' ->> 'role') = 'admin');

-- Admin delete: restricted to admin role
DROP POLICY IF EXISTS "admin_delete_donations" ON public.donations;
CREATE POLICY "admin_delete_donations" ON public.donations
  FOR DELETE TO authenticated
  USING ((auth.jwt() -> 'raw_app_meta_data' ->> 'role') = 'admin');

-- ============================================================
-- 3. HARDEN gallery_images POLICIES
-- ============================================================

-- Public select stays (gallery is intentionally public for display)
-- Already has: public_select_gallery USING (true) — this is correct for a public gallery

-- Admin insert: restricted to admin role
DROP POLICY IF EXISTS "admin_insert_gallery" ON public.gallery_images;
CREATE POLICY "admin_insert_gallery" ON public.gallery_images
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'raw_app_meta_data' ->> 'role') = 'admin');

-- Admin update: restricted to admin role
DROP POLICY IF EXISTS "admin_update_gallery" ON public.gallery_images;
CREATE POLICY "admin_update_gallery" ON public.gallery_images
  FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'raw_app_meta_data' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'raw_app_meta_data' ->> 'role') = 'admin');

-- Admin delete: restricted to admin role
DROP POLICY IF EXISTS "admin_delete_gallery" ON public.gallery_images;
CREATE POLICY "admin_delete_gallery" ON public.gallery_images
  FOR DELETE TO authenticated
  USING ((auth.jwt() -> 'raw_app_meta_data' ->> 'role') = 'admin');

-- ============================================================
-- 4. HARDEN news_articles POLICIES
-- ============================================================

-- Public select for published articles stays (intentionally public)
-- Admin select all stays (admin needs to see drafts too)
DROP POLICY IF EXISTS "admin_select_all_news" ON public.news_articles;
CREATE POLICY "admin_select_all_news" ON public.news_articles
  FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'raw_app_meta_data' ->> 'role') = 'admin');

-- Admin insert: restricted to admin role
DROP POLICY IF EXISTS "admin_insert_news" ON public.news_articles;
CREATE POLICY "admin_insert_news" ON public.news_articles
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'raw_app_meta_data' ->> 'role') = 'admin');

-- Admin update: restricted to admin role
DROP POLICY IF EXISTS "admin_update_news" ON public.news_articles;
CREATE POLICY "admin_update_news" ON public.news_articles
  FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'raw_app_meta_data' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'raw_app_meta_data' ->> 'role') = 'admin');

-- Admin delete: restricted to admin role
DROP POLICY IF EXISTS "admin_delete_news" ON public.news_articles;
CREATE POLICY "admin_delete_news" ON public.news_articles
  FOR DELETE TO authenticated
  USING ((auth.jwt() -> 'raw_app_meta_data' ->> 'role') = 'admin');

-- ============================================================
-- 5. HARDEN newsletter_subscribers POLICIES
-- ============================================================

-- Public insert: require non-empty email and first_name
DROP POLICY IF EXISTS "public_insert_subscriber" ON public.newsletter_subscribers;
CREATE POLICY "public_insert_subscriber" ON public.newsletter_subscribers
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    email IS NOT NULL
    AND length(trim(email)) > 5
    AND first_name IS NOT NULL
    AND length(trim(first_name)) >= 2
  );

-- Admin select stays (admin needs full list)
DROP POLICY IF EXISTS "admin_select_subscribers" ON public.newsletter_subscribers;
CREATE POLICY "admin_select_subscribers" ON public.newsletter_subscribers
  FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'raw_app_meta_data' ->> 'role') = 'admin');

-- Admin update: restricted to admin role
DROP POLICY IF EXISTS "admin_update_subscribers" ON public.newsletter_subscribers;
CREATE POLICY "admin_update_subscribers" ON public.newsletter_subscribers
  FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'raw_app_meta_data' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'raw_app_meta_data' ->> 'role') = 'admin');

-- Admin delete: restricted to admin role
DROP POLICY IF EXISTS "admin_delete_subscribers" ON public.newsletter_subscribers;
CREATE POLICY "admin_delete_subscribers" ON public.newsletter_subscribers
  FOR DELETE TO authenticated
  USING ((auth.jwt() -> 'raw_app_meta_data' ->> 'role') = 'admin');

-- ============================================================
-- 6. FIX STORAGE POLICIES (remove broad listing, add admin-only listing)
-- ============================================================

-- Remove broad SELECT that allows anonymous listing of all files
DROP POLICY IF EXISTS "public_read_gallery_storage" ON storage.objects;

-- Add admin-only listing policy (public URL access works without SELECT policy)
DROP POLICY IF EXISTS "admin_list_gallery_storage" ON storage.objects;
CREATE POLICY "admin_list_gallery_storage" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'gallery'
    AND (auth.jwt() -> 'raw_app_meta_data' ->> 'role') = 'admin'
  );