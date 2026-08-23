/*
  # Restrict gallery bucket writes to the admin role  [F9]

  The three write policies on storage.objects for the `gallery` bucket keyed
  only on `bucket_id = 'gallery'`, so any authenticated session could upload,
  overwrite or delete files in a publicly readable bucket. Add the same admin
  role claim used elsewhere in this project.

  `public_read_gallery_storage` is left untouched so visitors can still load
  gallery images.
*/

DROP POLICY IF EXISTS "auth_insert_gallery_storage" ON storage.objects;

CREATE POLICY "admin_insert_gallery_storage"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'gallery'
    AND COALESCE(
      (auth.jwt() -> 'app_metadata') ->> 'role',
      (auth.jwt() -> 'raw_app_meta_data') ->> 'role'
    ) = 'admin'
  );

DROP POLICY IF EXISTS "auth_update_gallery_storage" ON storage.objects;

CREATE POLICY "admin_update_gallery_storage"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'gallery'
    AND COALESCE(
      (auth.jwt() -> 'app_metadata') ->> 'role',
      (auth.jwt() -> 'raw_app_meta_data') ->> 'role'
    ) = 'admin'
  )
  WITH CHECK (
    bucket_id = 'gallery'
    AND COALESCE(
      (auth.jwt() -> 'app_metadata') ->> 'role',
      (auth.jwt() -> 'raw_app_meta_data') ->> 'role'
    ) = 'admin'
  );

DROP POLICY IF EXISTS "auth_delete_gallery_storage" ON storage.objects;

CREATE POLICY "admin_delete_gallery_storage"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'gallery'
    AND COALESCE(
      (auth.jwt() -> 'app_metadata') ->> 'role',
      (auth.jwt() -> 'raw_app_meta_data') ->> 'role'
    ) = 'admin'
  );
