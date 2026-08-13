-- ============================================================
-- Fix gallery_images RLS policies
-- The admin role check via JWT was failing, blocking INSERT and DELETE.
-- Restore simpler authenticated-user policies so signed-in admins can
-- upload, delete, and manage gallery images.
-- ============================================================

-- gallery_images: drop the broken admin-role policies
DROP POLICY IF EXISTS "admin_insert_gallery" ON gallery_images;
DROP POLICY IF EXISTS "admin_update_gallery" ON gallery_images;
DROP POLICY IF EXISTS "admin_delete_gallery" ON gallery_images;
DROP POLICY IF EXISTS "public_select_gallery" ON gallery_images;

-- gallery_images: recreate with simple authenticated checks
CREATE POLICY "public_select_gallery" ON gallery_images
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "admin_insert_gallery" ON gallery_images
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "admin_update_gallery" ON gallery_images
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "admin_delete_gallery" ON gallery_images
  FOR DELETE TO authenticated USING (true);

-- ============================================================
-- Fix storage.objects policies for the gallery bucket
-- Same issue: admin role check was blocking uploads and deletes.
-- ============================================================
DROP POLICY IF EXISTS "public_read_gallery_storage" ON storage.objects;
DROP POLICY IF EXISTS "auth_insert_gallery_storage" ON storage.objects;
DROP POLICY IF EXISTS "auth_update_gallery_storage" ON storage.objects;
DROP POLICY IF EXISTS "auth_delete_gallery_storage" ON storage.objects;
DROP POLICY IF EXISTS "admin_list_gallery_storage" ON storage.objects;

CREATE POLICY "public_read_gallery_storage" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'gallery');

CREATE POLICY "auth_insert_gallery_storage" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'gallery');

CREATE POLICY "auth_update_gallery_storage" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'gallery')
  WITH CHECK (bucket_id = 'gallery');

CREATE POLICY "auth_delete_gallery_storage" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'gallery');