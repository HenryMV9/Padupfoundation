/*
# Harden Storage Write Policies to Admin Role

## Overview
Restricts storage INSERT, UPDATE, and DELETE policies on the `gallery` bucket
to only authenticated users with the admin role, matching the database table
policies. Previously any authenticated user could upload/modify storage objects.

## Changes
- `auth_insert_gallery_storage`: Now requires admin role.
- `auth_update_gallery_storage`: Now requires admin role.
- `auth_delete_gallery_storage`: Now requires admin role.
*/

DROP POLICY IF EXISTS "auth_insert_gallery_storage" ON storage.objects;
CREATE POLICY "auth_insert_gallery_storage" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'gallery'
    AND (auth.jwt() -> 'raw_app_meta_data' ->> 'role') = 'admin'
  );

DROP POLICY IF EXISTS "auth_update_gallery_storage" ON storage.objects;
CREATE POLICY "auth_update_gallery_storage" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'gallery'
    AND (auth.jwt() -> 'raw_app_meta_data' ->> 'role') = 'admin'
  );

DROP POLICY IF EXISTS "auth_delete_gallery_storage" ON storage.objects;
CREATE POLICY "auth_delete_gallery_storage" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'gallery'
    AND (auth.jwt() -> 'raw_app_meta_data' ->> 'role') = 'admin'
  );