/* ============================================================
   PAD UP FOUNDATION — Admin Subscribers API
   Fetches all newsletter subscribers using the service role key,
   bypassing RLS so the admin panel always sees every subscriber.

   ACCESS CONTROL: the service role key bypasses RLS, so this function
   must authorize the caller itself. Every request must carry the
   Authorization header of a signed-in user whose app_metadata.role is
   'admin'. The project anon key is NOT sufficient — it is public.

   Endpoints:
   GET  /subscribers  — returns all subscribers (newest first)
   POST /count        — returns total subscriber count
   ============================================================ */

import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Resolves the caller from their Authorization bearer token and confirms they
 * hold the admin role. Returns null when the caller is a valid admin, or a
 * Response to return immediately when they are not.
 *
 * The role is read from app_metadata, which only the service role can write —
 * never from user_metadata, which the user can edit themselves.
 */
async function requireAdmin(req: Request): Promise<Response | null> {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return jsonResponse(401, { error: "Authentication required." });
  }

  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

  // The anon key is a valid project JWT but represents no user. Reject it
  // outright so it can never be mistaken for a credential.
  if (token === anonKey) {
    return jsonResponse(401, { error: "Authentication required." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data, error } = await authClient.auth.getUser(token);

  if (error || !data?.user) {
    return jsonResponse(401, { error: "Authentication required." });
  }

  const meta = (data.user.app_metadata || {}) as Record<string, unknown>;
  if (meta.role !== "admin") {
    return jsonResponse(403, { error: "Administrator access required." });
  }

  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const denied = await requireAdmin(req);
    if (denied) return denied;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const action = url.pathname.split("/").pop() || "";

    /* ---- Get all subscribers ---- */
    if (action === "subscribers" && req.method === "GET") {
      const { data, error, count } = await supabase
        .from("newsletter_subscribers")
        .select("*", { count: "exact" })
        .order("subscribed_at", { ascending: false });

      if (error) throw error;

      return jsonResponse(200, {
        success: true,
        subscribers: data || [],
        count: count || (data ? data.length : 0),
      });
    }

    /* ---- Get subscriber count only ---- */
    if (action === "count" && req.method === "POST") {
      const { count, error } = await supabase
        .from("newsletter_subscribers")
        .select("id", { count: "exact", head: true });

      if (error) throw error;

      return jsonResponse(200, {
        success: true,
        count: count || 0,
      });
    }

    return jsonResponse(404, { error: "Unknown action. Use GET /subscribers or POST /count." });
  } catch (err) {
    // Log the detail server-side; never return internal error text to the caller.
    console.error("[Admin-Subscribers] Error:", err instanceof Error ? err.message : err);
    return jsonResponse(500, { error: "Unable to complete the request." });
  }
});
