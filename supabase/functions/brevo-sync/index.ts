/* ============================================================
   PAD UP FOUNDATION - Brevo Email Marketing Sync
   Edge function that syncs newsletter subscribers to Brevo.
   API key is stored as a Supabase secret (BREVO_API_KEY).

   Endpoints:
   POST /sync      — sync a single subscriber to Brevo (called after signup)
   POST /sync-all  — batch sync all unsynced subscribers from database
   ============================================================ */

import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BREVO_API_URL = "https://api.brevo.com/v3/contacts";
const BREVO_BATCH_URL = "https://api.brevo.com/v3/contacts/import";

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

    /* ---- Single subscriber sync ---- */
    if (action === "sync") {
      const { email, first_name, subscriber_id } = body as {
        email?: string;
        first_name?: string;
        subscriber_id?: string;
      };

      if (!email) {
        return jsonResponse(400, { error: "Email is required" });
      }

      const brevoBody: Record<string, unknown> = {
        email: email,
        attributes: { FIRSTNAME: first_name || "" },
        listIds: [2],
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
        console.error("[Brevo] Single sync failed for", email, ":", brevoRes.status, errText);
        return jsonResponse(brevoRes.status, {
          error: "Brevo API error",
          details: errText,
        });
      }

      if (subscriber_id) {
        await supabase
          .from("newsletter_subscribers")
          .update({ brevo_synced: true, brevo_synced_at: new Date().toISOString() })
          .eq("id", subscriber_id);
      }

      return jsonResponse(200, {
        success: true,
        message: "Subscriber synced to Brevo",
      });
    }

    /* ---- Batch sync all unsynced subscribers ---- */
    if (action === "sync-all") {
      const { data: subscribers, error: dbError } = await supabase
        .from("newsletter_subscribers")
        .select("id, first_name, email")
        .eq("brevo_synced", false);

      if (dbError) throw dbError;

      if (!subscribers || subscribers.length === 0) {
        return jsonResponse(200, {
          success: true,
          message: "No unsynced subscribers found",
          synced: 0,
        });
      }

      const batchBody = {
        jsonBody: subscribers.map((s: { email: string; first_name: string }) => ({
          email: s.email,
          attributes: { FIRSTNAME: s.first_name || "" },
          listIds: [2],
        })),
        listIds: [2],
        updateEnabled: true,
      };

      const brevoRes = await fetch(BREVO_BATCH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": brevoApiKey,
        },
        body: JSON.stringify(batchBody),
      });

      if (!brevoRes.ok) {
        const errText = await brevoRes.text();
        console.error("[Brevo] Batch sync failed:", brevoRes.status, errText);
        return jsonResponse(brevoRes.status, {
          error: "Brevo batch import error",
          details: errText,
        });
      }

      const now = new Date().toISOString();
      const ids = subscribers.map((s: { id: string }) => s.id);
      await supabase
        .from("newsletter_subscribers")
        .update({ brevo_synced: true, brevo_synced_at: now })
        .in("id", ids);

      return jsonResponse(200, {
        success: true,
        message: "Batch sync completed",
        synced: subscribers.length,
      });
    }

    return jsonResponse(404, { error: "Unknown action. Use /sync or /sync-all." });
  } catch (err) {
    console.error("[Brevo] Edge function error:", err.message);
    return jsonResponse(500, { error: err.message });
  }
});