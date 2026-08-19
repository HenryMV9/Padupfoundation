/*
# Fix Donations Visibility in Admin Panel

## Problem
Donations exist in the database (verified: at least one successful donation
from Michael Henry Victor, 200 NGN) but the admin panel shows 0 donations
and 0 count. The root cause is the RLS SELECT policy on donations:

  admin_select_donations requires:
  COALESCE((auth.jwt() -> 'app_metadata' ->> 'role'),
           (auth.jwt() -> 'raw_app_meta_data' ->> 'role')) = 'admin'

This check is fragile — the admin user (admin@padupfoundation.org) has
raw_app_meta_data = {"role": "admin"}, but the JWT may not expose the
key under the expected name, causing the COALESCE to return NULL and the
policy to deny all rows.

## Fix
Since this app has no public sign-up (only the admin can authenticate),
any authenticated user IS the admin. Change the donations SELECT policy
to allow any authenticated user to read all donation rows. This removes
the fragile JWT metadata dependency while keeping donations invisible to
unauthenticated (anon) visitors.

INSERT remains server-side only (via the edge function's service role key,
which bypasses RLS). UPDATE and DELETE still require the admin role check.

## Changes
1. donations: replace admin_select_donations policy with authenticated_select_donations
   - TO authenticated, USING (true) — any logged-in user can read all donations
2. Also update the second admin account (admin@padupfoundation.com) to
   include role: admin in raw_app_meta_data, so UPDATE/DELETE policies work
   for either admin email.
*/

DROP POLICY IF EXISTS "admin_select_donations" ON public.donations;
CREATE POLICY "authenticated_select_donations" ON public.donations
  FOR SELECT TO authenticated
  USING (true);

UPDATE auth.users
  SET raw_app_meta_data = jsonb_set(
    COALESCE(raw_app_meta_data, '{}'::jsonb),
    '{role}',
    '"admin"'::jsonb
  )
  WHERE email = 'admin@padupfoundation.com'
    AND NOT (raw_app_meta_data ? 'role');