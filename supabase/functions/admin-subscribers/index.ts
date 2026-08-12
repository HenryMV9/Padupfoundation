/* ============================================================
   PAD UP FOUNDATION — Admin Subscribers API
   Fetches all newsletter subscribers using the service role key,
   bypassing RLS so the admin panel always sees every subscriber.

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
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
    console.error("[Admin-Subscribers] Error:", err.message);
    return jsonResponse(500, { error: err.message });
  }
});