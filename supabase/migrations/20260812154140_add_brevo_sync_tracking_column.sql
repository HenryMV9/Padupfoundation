/*
# Add Brevo Sync Tracking Column to Newsletter Subscribers

## Purpose
Adds a `brevo_synced` boolean column and `brevo_synced_at` timestamp to the
`newsletter_subscribers` table so the admin panel can display whether each
subscriber has been successfully synced to Brevo.

## Changes
1. New Columns on `newsletter_subscribers`:
   - `brevo_synced` (boolean, default false) — indicates whether the
     subscriber has been pushed to Brevo's contact list
   - `brevo_synced_at` (timestamptz, nullable) — timestamp of last successful sync

2. Security
   - No RLS policy changes needed. The existing admin SELECT policy already
     covers these columns. The `public_insert_subscriber` policy's WITH CHECK
     only validates `email` and `first_name`, so new columns with defaults
     won't block inserts.
   - The `brevo_synced` and `brevo_synced_at` columns are NOT user-controllable
     via the public INSERT policy — the public insert doesn't set them, and
     the admin UPDATE policy is admin-only. This prevents subscribers from
     self-marking as synced.
*/

ALTER TABLE newsletter_subscribers
  ADD COLUMN IF NOT EXISTS brevo_synced boolean NOT NULL DEFAULT false;

ALTER TABLE newsletter_subscribers
  ADD COLUMN IF NOT EXISTS brevo_synced_at timestamptz;