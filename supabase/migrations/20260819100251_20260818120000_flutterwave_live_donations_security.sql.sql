/*
# Flutterwave Live Donations — Security Hardening

## Overview
Tightens the donations table for production Flutterwave Live integration.
Only the server-side edge function (service role, bypasses RLS) can write
verified donation rows. Anon INSERT access is removed.

## Changes
1. donations table: adds flutterwave_tx_ref, flutterwave_payment_id, donor_phone
2. Unique index on flutterwave_tx_ref for idempotency
3. Drops public_insert_donation policy (anon can no longer INSERT)
*/

ALTER TABLE donations
  ADD COLUMN IF NOT EXISTS flutterwave_tx_ref text,
  ADD COLUMN IF NOT EXISTS flutterwave_payment_id bigint,
  ADD COLUMN IF NOT EXISTS donor_phone text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_donations_tx_ref_unique
  ON donations (flutterwave_tx_ref)
  WHERE flutterwave_tx_ref IS NOT NULL;

DROP POLICY IF EXISTS "public_insert_donation" ON donations;