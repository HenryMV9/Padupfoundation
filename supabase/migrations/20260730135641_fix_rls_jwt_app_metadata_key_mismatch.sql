/*
# Fix RLS Policies: JWT app_metadata Key Mismatch (Root Cause of Admin Panel Failures)

## Root Cause
Every admin-scoped RLS policy checks:
  (auth.jwt() -> 'raw_app_meta_data' ->> 'role') = 'admin'

But Supabase Auth JWTs expose app metadata under the key `app_metadata`, NOT
`raw_app_meta_data`. The name `raw_app_meta_data` is the database column in
auth.users; the JWT payload key is `app_metadata`.

This mismatch caused every admin operation to silently fail:
- INSERT: WITH CHECK evaluates to NULL='admin' → FALSE → insert blocked with
  "new row violates row-level security policy" error
- UPDATE: USING evaluates to FALSE → 0 rows matched, no error, no update
  ("editing does not update correctly")
- DELETE: USING evaluates to FALSE → 0 rows matched, no error, no deletion
  ("deleting reports success but does nothing")
- SELECT (admin all): USING evaluates to FALSE → admin falls back to public
  policy, only sees published rows, cannot see drafts

## Fix
Replace `auth.jwt() -> 'raw_app_meta_data' ->> 'role'` with
  coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role'),
    (auth.jwt() -> 'raw_app_meta_data' ->> 'role')
  ) = 'admin'

The coalesce handles both possible JWT key names for forward/backward compatibility.

## Affected Policies (17 total)

### Database tables (public schema):
- donations: admin_select_donations, admin_update_donations, admin_delete_donations
- gallery_images: admin_insert_gallery, admin_update_gallery, admin_delete_gallery
- news_articles: admin_select_all_news, admin_insert_news, admin_update_news, admin_delete_news
- newsletter_subscribers: admin_select_subscribers, admin_update_subscribers, admin_delete_subscribers

### Storage (storage.objects):
- admin_list_gallery_storage (SELECT)
- auth_insert_gallery_storage (INSERT)
- auth_update_gallery_storage (UPDATE)
- auth_delete_gallery_storage (DELETE)

## Verification
After this migration, the admin user (admin@padupfoundation.org, which has
raw_app_meta_data = {"role": "admin"}) will have the role correctly visible
in the JWT as app_metadata.role = "admin", and all CRUD operations will succeed.
*/

-- Helper expression used across all policies:
-- coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), (auth.jwt() -> 'raw_app_meta_data' ->> 'role')) = 'admin'

-- ============================================================
-- 1. DONATIONS
-- ============================================================

DROP POLICY IF EXISTS "admin_select_donations" ON public.donations;
CREATE POLICY "admin_select_donations" ON public.donations
  FOR SELECT TO authenticated
  USING (coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role'),
    (auth.jwt() -> 'raw_app_meta_data' ->> 'role')
  ) = 'admin');

DROP POLICY IF EXISTS "admin_update_donations" ON public.donations;
CREATE POLICY "admin_update_donations" ON public.donations
  FOR UPDATE TO authenticated
  USING (coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role'),
    (auth.jwt() -> 'raw_app_meta_data' ->> 'role')
  ) = 'admin')
  WITH CHECK (coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role'),
    (auth.jwt() -> 'raw_app_meta_data' ->> 'role')
  ) = 'admin');

DROP POLICY IF EXISTS "admin_delete_donations" ON public.donations;
CREATE POLICY "admin_delete_donations" ON public.donations
  FOR DELETE TO authenticated
  USING (coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role'),
    (auth.jwt() -> 'raw_app_meta_data' ->> 'role')
  ) = 'admin');

-- ============================================================
-- 2. GALLERY IMAGES
-- ============================================================

DROP POLICY IF EXISTS "admin_insert_gallery" ON public.gallery_images;
CREATE POLICY "admin_insert_gallery" ON public.gallery_images
  FOR INSERT TO authenticated
  WITH CHECK (coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role'),
    (auth.jwt() -> 'raw_app_meta_data' ->> 'role')
  ) = 'admin');

DROP POLICY IF EXISTS "admin_update_gallery" ON public.gallery_images;
CREATE POLICY "admin_update_gallery" ON public.gallery_images
  FOR UPDATE TO authenticated
  USING (coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role'),
    (auth.jwt() -> 'raw_app_meta_data' ->> 'role')
  ) = 'admin')
  WITH CHECK (coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role'),
    (auth.jwt() -> 'raw_app_meta_data' ->> 'role')
  ) = 'admin');

DROP POLICY IF EXISTS "admin_delete_gallery" ON public.gallery_images;
CREATE POLICY "admin_delete_gallery" ON public.gallery_images
  FOR DELETE TO authenticated
  USING (coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role'),
    (auth.jwt() -> 'raw_app_meta_data' ->> 'role')
  ) = 'admin');

-- ============================================================
-- 3. NEWS ARTICLES
-- ============================================================

DROP POLICY IF EXISTS "admin_select_all_news" ON public.news_articles;
CREATE POLICY "admin_select_all_news" ON public.news_articles
  FOR SELECT TO authenticated
  USING (coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role'),
    (auth.jwt() -> 'raw_app_meta_data' ->> 'role')
  ) = 'admin');

DROP POLICY IF EXISTS "admin_insert_news" ON public.news_articles;
CREATE POLICY "admin_insert_news" ON public.news_articles
  FOR INSERT TO authenticated
  WITH CHECK (coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role'),
    (auth.jwt() -> 'raw_app_meta_data' ->> 'role')
  ) = 'admin');

DROP POLICY IF EXISTS "admin_update_news" ON public.news_articles;
CREATE POLICY "admin_update_news" ON public.news_articles
  FOR UPDATE TO authenticated
  USING (coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role'),
    (auth.jwt() -> 'raw_app_meta_data' ->> 'role')
  ) = 'admin')
  WITH CHECK (coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role'),
    (auth.jwt() -> 'raw_app_meta_data' ->> 'role')
  ) = 'admin');

DROP POLICY IF EXISTS "admin_delete_news" ON public.news_articles;
CREATE POLICY "admin_delete_news" ON public.news_articles
  FOR DELETE TO authenticated
  USING (coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role'),
    (auth.jwt() -> 'raw_app_meta_data' ->> 'role')
  ) = 'admin');

-- ============================================================
-- 4. NEWSLETTER SUBSCRIBERS
-- ============================================================

DROP POLICY IF EXISTS "admin_select_subscribers" ON public.newsletter_subscribers;
CREATE POLICY "admin_select_subscribers" ON public.newsletter_subscribers
  FOR SELECT TO authenticated
  USING (coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role'),
    (auth.jwt() -> 'raw_app_meta_data' ->> 'role')
  ) = 'admin');

DROP POLICY IF EXISTS "admin_update_subscribers" ON public.newsletter_subscribers;
CREATE POLICY "admin_update_subscribers" ON public.newsletter_subscribers
  FOR UPDATE TO authenticated
  USING (coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role'),
    (auth.jwt() -> 'raw_app_meta_data' ->> 'role')
  ) = 'admin')
  WITH CHECK (coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role'),
    (auth.jwt() -> 'raw_app_meta_data' ->> 'role')
  ) = 'admin');

DROP POLICY IF EXISTS "admin_delete_subscribers" ON public.newsletter_subscribers;
CREATE POLICY "admin_delete_subscribers" ON public.newsletter_subscribers
  FOR DELETE TO authenticated
  USING (coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role'),
    (auth.jwt() -> 'raw_app_meta_data' ->> 'role')
  ) = 'admin');

-- ============================================================
-- 5. STORAGE OBJECTS (gallery bucket)
-- ============================================================

DROP POLICY IF EXISTS "admin_list_gallery_storage" ON storage.objects;
CREATE POLICY "admin_list_gallery_storage" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'gallery'
    AND coalesce(
      (auth.jwt() -> 'app_metadata' ->> 'role'),
      (auth.jwt() -> 'raw_app_meta_data' ->> 'role')
    ) = 'admin'
  );

DROP POLICY IF EXISTS "auth_insert_gallery_storage" ON storage.objects;
CREATE POLICY "auth_insert_gallery_storage" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'gallery'
    AND coalesce(
      (auth.jwt() -> 'app_metadata' ->> 'role'),
      (auth.jwt() -> 'raw_app_meta_data' ->> 'role')
    ) = 'admin'
  );

DROP POLICY IF EXISTS "auth_update_gallery_storage" ON storage.objects;
CREATE POLICY "auth_update_gallery_storage" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'gallery'
    AND coalesce(
      (auth.jwt() -> 'app_metadata' ->> 'role'),
      (auth.jwt() -> 'raw_app_meta_data' ->> 'role')
    ) = 'admin'
  )
  WITH CHECK (
    bucket_id = 'gallery'
    AND coalesce(
      (auth.jwt() -> 'app_metadata' ->> 'role'),
      (auth.jwt() -> 'raw_app_meta_data' ->> 'role')
    ) = 'admin'
  );

DROP POLICY IF EXISTS "auth_delete_gallery_storage" ON storage.objects;
CREATE POLICY "auth_delete_gallery_storage" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'gallery'
    AND coalesce(
      (auth.jwt() -> 'app_metadata' ->> 'role'),
      (auth.jwt() -> 'raw_app_meta_data' ->> 'role')
    ) = 'admin'
  );