/* ============================================================
   PAD UP FOUNDATION - Brevo Email Marketing Sync
   Edge function that syncs newsletter subscribers to Brevo.
   API key is stored as a Supabase secret (BREVO_API_KEY).

   ACCESS CONTROL:
   - /sync     is reachable by the public newsletter form, so it cannot require
               a login. Instead it refuses to take the caller's word for
               anything: the email must already exist in newsletter_subscribers
               and the name / row id are read from that stored row. An arbitrary
               address can therefore no longer be pushed into Brevo.
   - /sync-all is an operator action and requires a signed-in admin.

   Endpoints:
   POST /sync      — sync an already-subscribed address to Brevo
   POST /sync-all  — batch sync all unsynced subscribers (admin only)
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

/**
 * Confirms the caller is a signed-in admin. Returns null when they are, or a
 * Response to return immediately when they are not. The role is read from
 * app_metadata, which only the service role can write.
 */
async function requireAdmin(req: Request): Promise<Response | null> {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

  // The anon key is a valid project JWT but represents no user.
  if (!token || token === anonKey) {
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
      const { email } = body as { email?: string };

      if (!email || typeof email !== "string") {
        return jsonResponse(400, { error: "Email is required" });
      }

      const normalizedEmail = email.trim().toLowerCase();
      if (normalizedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return jsonResponse(400, { error: "A valid email address is required" });
      }

      // Only sync addresses that actually subscribed. The name and row id come
      // from the stored row, never from the request body, so a caller cannot
      // inject an arbitrary contact into the mailing list or flip the synced
      // flag on a row of their choosing.
      const { data: subscriber, error: lookupError } = await supabase
        .from("newsletter_subscribers")
        .select("id, first_name, email")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (lookupError) throw lookupError;

      if (!subscriber) {
        // Deliberately generic: do not confirm whether this address is on the list.
        return jsonResponse(202, { success: true, message: "Sync request accepted." });
      }

      const brevoBody: Record<string, unknown> = {
        email: subscriber.email,
        attributes: { FIRSTNAME: subscriber.first_name || "" },
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
        console.error("[Brevo] Single sync failed for", subscriber.email, ":", brevoRes.status, errText);
        return jsonResponse(502, { error: "Email marketing sync is temporarily unavailable." });
      }

      await supabase
        .from("newsletter_subscribers")
        .update({ brevo_synced: true, brevo_synced_at: new Date().toISOString() })
        .eq("id", subscriber.id);

      return jsonResponse(200, {
        success: true,
        message: "Subscriber synced to Brevo",
      });
    }

    /* ---- Batch sync all unsynced subscribers (admin only) ---- */
    if (action === "sync-all") {
      const denied = await requireAdmin(req);
      if (denied) return denied;

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
        return jsonResponse(502, { error: "Email marketing sync is temporarily unavailable." });
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
    // Log the detail server-side; never return internal error text to the caller.
    console.error("[Brevo] Edge function error:", err instanceof Error ? err.message : err);
    return jsonResponse(500, { error: "Unable to complete the request." });
  }
});
