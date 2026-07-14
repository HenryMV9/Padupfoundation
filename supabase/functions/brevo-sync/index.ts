/* ============================================================
   PAD UP FOUNDATION - Brevo Email Marketing Sync
   Edge function that syncs newsletter subscribers to Brevo.
   Modular: API key is stored as a Supabase secret (BREVO_API_KEY).
   Called automatically or manually to sync all subscribers.

   Endpoints:
   POST /sync  — sync a single subscriber to Brevo
   POST /sync-all — sync all subscribers from database
   ============================================================ */

import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BREVO_API_URL = "https://api.brevo.com/v3/contacts";
const BREVO_LIST_ID = null; // Set via BREVO_LIST_ID secret if needed

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status: status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");

    if (!brevoApiKey) {
      return jsonResponse(200, {
        success: false,
        message: "Brevo API key not configured. Set BREVO_API_KEY secret to enable email marketing sync.",
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const action = url.pathname.split("/").pop() || "";
    const body = await req.json().catch(() => ({}));

    if (action === "sync") {
      // Sync a single subscriber
      const { email, first_name } = body;
      if (!email) {
        return jsonResponse(400, { error: "Email is required" });
      }

      const brevoBody: Record<string, unknown> = {
        email: email,
        attributes: { FIRSTNAME: first_name || "" },
        listIds: BREVO_LIST_ID ? [BREVO_LIST_ID] : undefined,
        updateEnabled: true,
      };

      const brevoRes = await fetch(BREVO_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": brevoApiKey,
        },
        body: JSON.stringify(brevoBody),
      });

      if (!brevoRes.ok) {
        const errText = await brevoRes.text();
        return jsonResponse(brevoRes.status, { error: "Brevo API error", details: errText });
      }

      return jsonResponse(200, { success: true, message: "Subscriber synced to Brevo" });
    }

    if (action === "sync-all") {
      // Sync all subscribers from the database
      const { data: subscribers, error: dbError } = await supabase
        .from("newsletter_subscribers")
        .select("first_name, email");

      if (dbError) throw dbError;

      if (!subscribers || subscribers.length === 0) {
        return jsonResponse(200, { success: true, message: "No subscribers to sync", synced: 0 });
      }

      // Brevo batch import
      const batchBody = {
        jsonBody: subscribers.map((s: { email: string; first_name: string }) => ({
          email: s.email,
          attributes: { FIRSTNAME: s.first_name || "" },
        })),
        listIds: BREVO_LIST_ID ? [BREVO_LIST_ID] : undefined,
        updateEnabled: true,
      };

      const brevoRes = await fetch("https://api.brevo.com/v3/contacts/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": brevoApiKey,
        },
        body: JSON.stringify(batchBody),
      });

      if (!brevoRes.ok) {
        const errText = await brevoRes.text();
        return jsonResponse(brevoRes.status, { error: "Brevo batch import error", details: errText });
      }

      return jsonResponse(200, { success: true, message: "Batch sync initiated", count: subscribers.length });
    }

    return jsonResponse(404, { error: "Unknown action. Use /sync or /sync-all." });
  } catch (err) {
    return jsonResponse(500, { error: err.message });
  }
});
