-- Enable Supabase Realtime on all CRUD tables
-- This allows the admin panel and frontend to receive live updates
-- when any row is inserted, updated, or deleted.

ALTER PUBLICATION supabase_realtime ADD TABLE public.news_articles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.gallery_images;
ALTER PUBLICATION supabase_realtime ADD TABLE public.donations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.newsletter_subscribers;