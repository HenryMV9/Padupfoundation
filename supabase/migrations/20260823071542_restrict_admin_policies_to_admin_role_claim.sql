/*
  # Restrict admin-intended policies to the actual admin role claim

  Several policies on public tables were named `admin_*` but carried a `true`
  predicate, so every authenticated session held them. This aligns them with the
  admin role check already used by `admin_update_donations`,
  `admin_delete_donations` and the newsletter_subscribers policies.

  1. donations
     - `authenticated_select_donations` (was USING true) -> admin only  [F1]
  2. news_articles
     - `admin_insert_news`     (was WITH CHECK true) -> admin only      [F2]
     - `admin_update_news`     (was USING/CHECK true) -> admin only     [F3]
     - `admin_delete_news`     (was USING true) -> admin only           [F4]
     - `admin_select_all_news` (was USING true) -> admin only           [F5]
  3. gallery_images
     - `admin_insert_gallery`  (was WITH CHECK true) -> admin only      [F6]
     - `admin_update_gallery`  (was USING/CHECK true) -> admin only     [F7]
     - `admin_delete_gallery`  (was USING true) -> admin only           [F8]

  Public read policies (`public_select_gallery`,
  `public_select_published_news`) are deliberately left untouched so the public
  website keeps rendering the gallery and published articles.
*/

-- ---------- F1: donations are admin-only reading ----------
DROP POLICY IF EXISTS "authenticated_select_donations" ON donations;

CREATE POLICY "admin_select_donations"
  ON donations FOR SELECT
  TO authenticated
  USING (
    COALESCE(
      (auth.jwt() -> 'app_metadata') ->> 'role',
      (auth.jwt() -> 'raw_app_meta_data') ->> 'role'
    ) = 'admin'
  );

-- ---------- F5: only an admin may read drafts ----------
DROP POLICY IF EXISTS "admin_select_all_news" ON news_articles;

CREATE POLICY "admin_select_all_news"
  ON news_articles FOR SELECT
  TO authenticated
  USING (
    COALESCE(
      (auth.jwt() -> 'app_metadata') ->> 'role',
      (auth.jwt() -> 'raw_app_meta_data') ->> 'role'
    ) = 'admin'
  );

-- ---------- F2: only an admin may create articles ----------
DROP POLICY IF EXISTS "admin_insert_news" ON news_articles;

CREATE POLICY "admin_insert_news"
  ON news_articles FOR INSERT
  TO authenticated
  WITH CHECK (
    COALESCE(
      (auth.jwt() -> 'app_metadata') ->> 'role',
      (auth.jwt() -> 'raw_app_meta_data') ->> 'role'
    ) = 'admin'
  );

-- ---------- F3: only an admin may edit articles ----------
DROP POLICY IF EXISTS "admin_update_news" ON news_articles;

CREATE POLICY "admin_update_news"
  ON news_articles FOR UPDATE
  TO authenticated
  USING (
    COALESCE(
      (auth.jwt() -> 'app_metadata') ->> 'role',
      (auth.jwt() -> 'raw_app_meta_data') ->> 'role'
    ) = 'admin'
  )
  WITH CHECK (
    COALESCE(
      (auth.jwt() -> 'app_metadata') ->> 'role',
      (auth.jwt() -> 'raw_app_meta_data') ->> 'role'
    ) = 'admin'
  );

-- ---------- F4: only an admin may delete articles ----------
DROP POLICY IF EXISTS "admin_delete_news" ON news_articles;

CREATE POLICY "admin_delete_news"
  ON news_articles FOR DELETE
  TO authenticated
  USING (
    COALESCE(
      (auth.jwt() -> 'app_metadata') ->> 'role',
      (auth.jwt() -> 'raw_app_meta_data') ->> 'role'
    ) = 'admin'
  );

-- ---------- F6: only an admin may add gallery rows ----------
DROP POLICY IF EXISTS "admin_insert_gallery" ON gallery_images;

CREATE POLICY "admin_insert_gallery"
  ON gallery_images FOR INSERT
  TO authenticated
  WITH CHECK (
    COALESCE(
      (auth.jwt() -> 'app_metadata') ->> 'role',
      (auth.jwt() -> 'raw_app_meta_data') ->> 'role'
    ) = 'admin'
  );

-- ---------- F7: only an admin may edit gallery rows ----------
DROP POLICY IF EXISTS "admin_update_gallery" ON gallery_images;

CREATE POLICY "admin_update_gallery"
  ON gallery_images FOR UPDATE
  TO authenticated
  USING (
    COALESCE(
      (auth.jwt() -> 'app_metadata') ->> 'role',
      (auth.jwt() -> 'raw_app_meta_data') ->> 'role'
    ) = 'admin'
  )
  WITH CHECK (
    COALESCE(
      (auth.jwt() -> 'app_metadata') ->> 'role',
      (auth.jwt() -> 'raw_app_meta_data') ->> 'role'
    ) = 'admin'
  );

-- ---------- F8: only an admin may delete gallery rows ----------
DROP POLICY IF EXISTS "admin_delete_gallery" ON gallery_images;

CREATE POLICY "admin_delete_gallery"
  ON gallery_images FOR DELETE
  TO authenticated
  USING (
    COALESCE(
      (auth.jwt() -> 'app_metadata') ->> 'role',
      (auth.jwt() -> 'raw_app_meta_data') ->> 'role'
    ) = 'admin'
  );
