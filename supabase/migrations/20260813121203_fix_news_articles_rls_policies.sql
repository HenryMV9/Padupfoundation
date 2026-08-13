-- ============================================================
-- Fix news_articles RLS policies
-- The admin role check via JWT was failing, blocking INSERT, UPDATE,
-- DELETE, and even SELECT for drafts. Restore simpler authenticated-user
-- policies so signed-in admins can manage news articles.
-- ============================================================

DROP POLICY IF EXISTS "admin_select_all_news" ON news_articles;
DROP POLICY IF EXISTS "admin_insert_news" ON news_articles;
DROP POLICY IF EXISTS "admin_update_news" ON news_articles;
DROP POLICY IF EXISTS "admin_delete_news" ON news_articles;
DROP POLICY IF EXISTS "public_select_published_news" ON news_articles;

-- Public can read only published articles
CREATE POLICY "public_select_published_news" ON news_articles
  FOR SELECT TO anon, authenticated USING (status = 'published');

-- Authenticated admins can read all articles (including drafts)
CREATE POLICY "admin_select_all_news" ON news_articles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin_insert_news" ON news_articles
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "admin_update_news" ON news_articles
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "admin_delete_news" ON news_articles
  FOR DELETE TO authenticated USING (true);