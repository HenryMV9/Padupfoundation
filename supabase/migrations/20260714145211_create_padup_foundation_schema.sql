/*
# Pad Up Foundation — Core Schema (Supabase)

## Overview
Creates the four core data tables that power the Pad Up Foundation platform:
newsletter subscribers, donations, gallery images, and news articles.
Also creates a storage bucket for gallery and news images.
Admin access is scoped to authenticated users (Supabase Auth email/password).
Public (anon) access is read-only for published content and write-only for
newsletter signups and donation records.

## New Tables

1. `newsletter_subscribers`
   - `id` (uuid, PK)
   - `first_name` (text, not null) — subscriber first name
   - `email` (text, unique, not null) — subscriber email, prevents duplicates
   - `subscribed_at` (timestamptz, default now()) — date subscribed

2. `donations`
   - `id` (uuid, PK)
   - `donor_name` (text, nullable) — optional donor name
   - `email` (text, nullable) — optional donor email
   - `amount` (numeric, not null) — donation amount
   - `currency` (text, not null, default 'NGN') — currency code (NGN, USD, GBP, EUR, CAD)
   - `flutterwave_tx_id` (text, unique) — Flutterwave transaction reference
   - `payment_status` (text, not null, default 'successful') — only successful payments stored
   - `created_at` (timestamptz, default now()) — date of donation

3. `gallery_images`
   - `id` (uuid, PK)
   - `image_url` (text, not null) — URL to image in Supabase Storage
   - `caption` (text, nullable) — image caption
   - `category` (text, not null, default 'outreach') — outreach/education/community
   - `uploaded_at` (timestamptz, default now()) — upload date

4. `news_articles`
   - `id` (uuid, PK)
   - `featured_image` (text, nullable) — URL to featured image in Storage
   - `title` (text, not null) — article title
   - `content` (text, not null) — full article body (HTML)
   - `summary` (text, not null) — short summary for cards
   - `published_at` (timestamptz, nullable) — published date (null = draft)
   - `status` (text, not null, default 'draft') — 'published' or 'draft'
   - `created_at` (timestamptz, default now())
   - `updated_at` (timestamptz, default now())

## Security (RLS)

### newsletter_subscribers
- INSERT: anon + authenticated can subscribe (public signup form)
- SELECT/UPDATE/DELETE: authenticated only (admin management)

### donations
- INSERT: anon + authenticated can insert (donation callback writes)
- SELECT/UPDATE/DELETE: authenticated only (admin management)

### gallery_images
- SELECT: anon + authenticated can read (public gallery display)
- INSERT/UPDATE/DELETE: authenticated only (admin management)

### news_articles
- SELECT: anon + authenticated can read PUBLISHED articles; authenticated can read ALL
- INSERT/UPDATE/DELETE: authenticated only (admin management)

## Storage
- Creates `gallery` bucket (public) for gallery + news images.
- Storage policies: public read, authenticated write.

## Notes
1. The frontend uses the anon key. Newsletter signup and donation insert
   work as anon. All admin operations require Supabase Auth sign-in.
2. `flutterwave_tx_id` has a unique constraint to prevent duplicate donation records.
3. `email` on newsletter_subscribers is unique to prevent duplicate subscriptions.
4. Only authenticated admin users can manage content — create an admin user
   via Supabase Auth (email/password) to access the dashboard.
*/

-- ============================================================
-- NEWSLETTER SUBSCRIBERS
-- ============================================================
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  email text UNIQUE NOT NULL,
  subscribed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_insert_subscriber" ON newsletter_subscribers;
CREATE POLICY "public_insert_subscriber" ON newsletter_subscribers
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "admin_select_subscribers" ON newsletter_subscribers;
CREATE POLICY "admin_select_subscribers" ON newsletter_subscribers
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_update_subscribers" ON newsletter_subscribers;
CREATE POLICY "admin_update_subscribers" ON newsletter_subscribers
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_delete_subscribers" ON newsletter_subscribers;
CREATE POLICY "admin_delete_subscribers" ON newsletter_subscribers
  FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_newsletter_email ON newsletter_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribed_at ON newsletter_subscribers(subscribed_at DESC);

-- ============================================================
-- DONATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_name text,
  email text,
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'NGN',
  flutterwave_tx_id text UNIQUE,
  payment_status text NOT NULL DEFAULT 'successful',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE donations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_insert_donation" ON donations;
CREATE POLICY "public_insert_donation" ON donations
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "admin_select_donations" ON donations;
CREATE POLICY "admin_select_donations" ON donations
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_update_donations" ON donations;
CREATE POLICY "admin_update_donations" ON donations
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_delete_donations" ON donations;
CREATE POLICY "admin_delete_donations" ON donations
  FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_donations_created_at ON donations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_donations_currency ON donations(currency);
CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(payment_status);

-- ============================================================
-- GALLERY IMAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS gallery_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url text NOT NULL,
  caption text,
  category text NOT NULL DEFAULT 'outreach',
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE gallery_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select_gallery" ON gallery_images;
CREATE POLICY "public_select_gallery" ON gallery_images
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_gallery" ON gallery_images;
CREATE POLICY "admin_insert_gallery" ON gallery_images
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "admin_update_gallery" ON gallery_images;
CREATE POLICY "admin_update_gallery" ON gallery_images
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_delete_gallery" ON gallery_images;
CREATE POLICY "admin_delete_gallery" ON gallery_images
  FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_gallery_category ON gallery_images(category);
CREATE INDEX IF NOT EXISTS idx_gallery_uploaded_at ON gallery_images(uploaded_at DESC);

-- ============================================================
-- NEWS ARTICLES
-- ============================================================
CREATE TABLE IF NOT EXISTS news_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  featured_image text,
  title text NOT NULL,
  content text NOT NULL,
  summary text NOT NULL,
  published_at timestamptz,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE news_articles ENABLE ROW LEVEL SECURITY;

-- Public can read only published articles
DROP POLICY IF EXISTS "public_select_published_news" ON news_articles;
CREATE POLICY "public_select_published_news" ON news_articles
  FOR SELECT TO anon, authenticated USING (status = 'published');

-- Authenticated admins can read all articles (including drafts)
-- This is handled by the fact that authenticated users also match the
-- public policy, but we need a separate one for drafts:
DROP POLICY IF EXISTS "admin_select_all_news" ON news_articles;
CREATE POLICY "admin_select_all_news" ON news_articles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_news" ON news_articles;
CREATE POLICY "admin_insert_news" ON news_articles
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "admin_update_news" ON news_articles;
CREATE POLICY "admin_update_news" ON news_articles
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_delete_news" ON news_articles;
CREATE POLICY "admin_delete_news" ON news_articles
  FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_news_status ON news_articles(status);
CREATE INDEX IF NOT EXISTS idx_news_published_at ON news_articles(published_at DESC);

-- ============================================================
-- UPDATED_AT TRIGGER for news_articles
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_news_updated_at ON news_articles;
CREATE TRIGGER trigger_news_updated_at
  BEFORE UPDATE ON news_articles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- STORAGE BUCKET for gallery + news images
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('gallery', 'gallery', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: public read, authenticated write
DROP POLICY IF EXISTS "public_read_gallery_storage" ON storage.objects;
CREATE POLICY "public_read_gallery_storage" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'gallery');

DROP POLICY IF EXISTS "auth_insert_gallery_storage" ON storage.objects;
CREATE POLICY "auth_insert_gallery_storage" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'gallery');

DROP POLICY IF EXISTS "auth_update_gallery_storage" ON storage.objects;
CREATE POLICY "auth_update_gallery_storage" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'gallery');

DROP POLICY IF EXISTS "auth_delete_gallery_storage" ON storage.objects;
CREATE POLICY "auth_delete_gallery_storage" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'gallery');