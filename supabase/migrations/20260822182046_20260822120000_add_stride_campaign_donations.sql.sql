/*
# Add STRIDE 2026 campaign donation support

1. New columns on `donations`
- `campaign` (text): campaign identifier, defaulting to GENERAL for existing donations.
- `donor_message` (text): optional note from the donor.

2. Data integrity
- Adds a campaign index for admin filtering and reporting.
- Existing donation rows remain unchanged and are classified as GENERAL.

3. Security
- The existing donations RLS policies remain in place.
- STRIDE payment rows are inserted only after server-side Flutterwave verification by the edge function using its service role.
- No anonymous browser write policy is added.
*/

ALTER TABLE public.donations
  ADD COLUMN IF NOT EXISTS campaign text NOT NULL DEFAULT 'GENERAL',
  ADD COLUMN IF NOT EXISTS donor_message text;

CREATE INDEX IF NOT EXISTS idx_donations_campaign_created_at
  ON public.donations (campaign, created_at DESC);
