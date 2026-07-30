/*
# Fix SECURITY DEFINER Exposure on rls_auto_enable() Event Trigger

## Problem
The `public.rls_auto_enable()` event trigger function is declared as
`SECURITY DEFINER`, which means it executes with the privileges of its
owner (typically the postgres superuser). By default, PostgREST exposes
all functions in the `public` schema to the `anon` and `authenticated`
roles via `/rest/v1/rpc/<function_name>`. This means any anonymous
visitor or signed-in user could invoke `rls_auto_enable()` via the REST
API and potentially execute code with elevated privileges.

## Fix
1. Revoke EXECUTE on `public.rls_auto_enable()` from `anon`, `authenticated`,
   and `PUBLIC` (the default role that includes all roles).
2. Re-grant EXECUTE only to roles that actually need it: the `postgres`
   superuser and `service_role` (used by Supabase's service-level operations).

   This ensures the event trigger continues to fire automatically when the
   database owner creates tables (event triggers run as the invoking role,
   which is the superuser during DDL operations), but the function is not
   callable via the PostgREST REST API by unauthenticated or regular
   authenticated users.

## Note
Event trigger functions are not meant to be called directly — they fire
automatically in response to DDL events. Exposing them via RPC serves no
legitimate purpose and is a security risk.

## Affected Function
- `public.rls_auto_enable()` — event trigger that auto-enables RLS on
  newly created tables in the `public` schema.
*/

REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM authenticated;

-- Grant only to privileged roles that need it
GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO postgres;
GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO service_role;