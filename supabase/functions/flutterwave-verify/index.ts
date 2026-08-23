/* ============================================================
   PAD UP FOUNDATION - Flutterwave Live Payment Verification
   Edge function that verifies Flutterwave transactions server-side
   before recording them as successful donations.

   Endpoints:
   POST /verify  — called from frontend after Flutterwave checkout callback.
                   Verifies the transaction with Flutterwave's API, then
                   inserts a donation row using the service role key.
   POST /webhook — Flutterwave server-to-server webhook. Verifies the
                   webhook signature, then verifies and records the
                   transaction (idempotent via tx_ref unique constraint).

   Secrets (server-side only, never exposed to frontend):
   - FLUTTERWAVE_SECRET_KEY     — Live secret key for API verification
   - FLUTTERWAVE_ENCRYPTION_KEY — Live encryption key for webhook signature
   - SUPABASE_SERVICE_ROLE_KEY  — bypasses RLS to insert verified donations
   ============================================================ */

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { createHmac } from "node:crypto";

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

interface VerifyBody {
  transaction_id?: number;
  tx_ref?: string;
  amount?: number;
  currency?: string;
  donor_name?: string;
  donor_email?: string;
  donor_phone?: string;
  donor_message?: string;
  campaign?: string;
}

interface InitializeBody {
  tx_ref?: string;
  amount?: number;
  currency?: string;
  redirect_url?: string;
  donor_name?: string;
  donor_email?: string;
  donor_phone?: string;
  donor_message?: string;
  campaign?: string;
}

interface FlutterwaveVerifyResponse {
  status: string;
  message: string;
  data?: {
    id: number;
    tx_ref: string;
    flw_ref: string;
    amount: number;
    currency: string;
    charged_amount: number;
    status: string;
    payment_type: string;
    customer?: {
      email: string;
      name?: string;
      phone_number?: string;
    };
  };
}

async function verifyWithFlutterwave(transactionId: number): Promise<FlutterwaveVerifyResponse> {
  const secretKey = Deno.env.get("FLUTTERWAVE_SECRET_KEY");
  if (!secretKey) throw new Error("FLUTTERWAVE_SECRET_KEY not configured");

  const res = await fetch(
    `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
    {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Flutterwave verify failed (${res.status}): ${errText}`);
  }

  return await res.json() as FlutterwaveVerifyResponse;
}

async function initializeWithFlutterwave(body: InitializeBody) {
  const secretKey = Deno.env.get("FLUTTERWAVE_SECRET_KEY");
  if (!secretKey) throw new Error("FLUTTERWAVE_SECRET_KEY not configured");

  const res = await fetch("https://api.flutterwave.com/v3/payments", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tx_ref: body.tx_ref,
      amount: body.amount,
      currency: body.currency,
      redirect_url: body.redirect_url,
      payment_options: "card,banktransfer,ussd,mobilemoney",
      customer: {
        email: body.donor_email,
        phone_number: body.donor_phone,
        name: body.donor_name,
      },
      customizations: {
        title: "Pad Up Foundation",
        description: "Donation — Ending Period Poverty",
        logo: `${new URL(body.redirect_url || "https://padupfoundation.org").origin}/images/Padupfoundation-LOGO.jpg`,
      },
    }),
  });

  const result = await res.json().catch(() => ({}));
  if (!res.ok || result.status !== "success" || !result.data?.link) {
    throw new Error(result.message || `Flutterwave payment setup failed (${res.status})`);
  }

  return result.data.link as string;
}

async function recordDonation(supabase: ReturnType<typeof createClient>, params: {
  txRef: string;
  transactionId: number;
  amount: number;
  currency: string;
  donorName: string | null;
  donorEmail: string | null;
  donorPhone: string | null;
  donorMessage: string | null;
  campaign: string;
  paymentStatus: string;
}): Promise<{ inserted: boolean; error?: string }> {
  const { error } = await supabase.from("donations").insert({
    donor_name: params.donorName,
    email: params.donorEmail,
    donor_phone: params.donorPhone,
    donor_message: params.donorMessage,
    campaign: params.campaign,
    amount: params.amount,
    currency: params.currency,
    flutterwave_tx_ref: params.txRef,
    flutterwave_tx_id: String(params.transactionId),
    flutterwave_payment_id: params.transactionId,
    payment_status: params.paymentStatus,
  });

  if (error) {
    // 23505 = unique_violation — duplicate tx_ref, payment already recorded
    if (error.code === "23505") {
      return { inserted: false };
    }
    return { inserted: false, error: "Unable to record the donation." };
  }

  return { inserted: true };
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

    /* ---- Initialize hosted payment (frontend calls this to get checkout link) ---- */
    if (action === "initialize") {
      const body = await req.json().catch(() => ({} as InitializeBody));
      const { tx_ref, amount, currency, redirect_url, donor_name, donor_email, donor_phone, donor_message, campaign } = body as InitializeBody;
      const paymentCampaign = campaign || "GENERAL";

      if (!tx_ref || !amount || !currency || !donor_email) {
        return jsonResponse(400, { error: "tx_ref, amount, currency, and donor_email are required" });
      }
      if (paymentCampaign !== "GENERAL" && paymentCampaign !== "STRIDE 2026") {
        return jsonResponse(400, { error: "Invalid campaign" });
      }

      const link = await initializeWithFlutterwave({
        tx_ref,
        amount: Number(amount),
        currency,
        redirect_url: redirect_url || `${url.origin}/donate.html`,
        donor_name,
        donor_email,
        donor_phone,
        donor_message,
        campaign: paymentCampaign,
      });

      return jsonResponse(200, { success: true, link });
    }

    /* ---- Verify transaction (frontend callback) ---- */
    if (action === "verify") {
      const body = await req.json().catch(() => ({} as VerifyBody));
      const { transaction_id, tx_ref, amount, currency, donor_name, donor_email, donor_phone, donor_message, campaign } = body as VerifyBody;
      const paymentCampaign = campaign || "GENERAL";

      if (!transaction_id || !tx_ref) {
        return jsonResponse(400, { error: "transaction_id and tx_ref are required" });
      }
      if (paymentCampaign !== "GENERAL" && paymentCampaign !== "STRIDE 2026") {
        return jsonResponse(400, { error: "Invalid campaign" });
      }

      const verification = await verifyWithFlutterwave(transaction_id);

      if (verification.status !== "success" || !verification.data) {
        return jsonResponse(400, {
          success: false,
          verified: false,
          message: verification.message || "Transaction verification failed",
        });
      }

      const tx = verification.data;

      if (tx.tx_ref !== tx_ref) {
        return jsonResponse(400, { success: false, verified: false, message: "Transaction reference mismatch." });
      }

      if (tx.status !== "successful") {
        return jsonResponse(200, {
          success: false,
          verified: true,
          payment_status: tx.status,
          message: `Payment status is ${tx.status}, not successful.`,
        });
      }

      // Verify amount matches (use charged_amount to account fees)
      const expectedAmount = Number(amount);
      if (tx.charged_amount && expectedAmount > 0) {
        const tolerance = 0.01;
        if (Math.abs(tx.charged_amount - expectedAmount) > tolerance && Math.abs(tx.amount - expectedAmount) > tolerance) {
          return jsonResponse(400, {
            success: false,
            verified: true,
            message: "Amount mismatch — possible tampering detected.",
          });
        }
      }

      const result = await recordDonation(supabase, {
        txRef: tx_ref,
        transactionId: tx.id,
        amount: tx.amount,
        currency: tx.currency,
        // Prefer the identity the payment provider verified over anything the
        // browser sent, so a caller cannot attribute someone else's payment to
        // a name or address of their choosing.
        donorName: tx.customer?.name || donor_name || null,
        donorEmail: tx.customer?.email || donor_email || null,
        donorPhone: tx.customer?.phone_number || donor_phone || null,
        // Free text from the browser: bound its length before storing it.
        donorMessage: typeof donor_message === "string" ? donor_message.slice(0, 1000) : null,
        campaign: paymentCampaign,
        paymentStatus: "successful",
      });

      if (result.error) {
        return jsonResponse(500, { success: false, error: result.error });
      }

      return jsonResponse(200, {
        success: true,
        verified: true,
        payment_status: "successful",
        amount: tx.amount,
        currency: tx.currency,
        duplicate: !result.inserted,
        message: result.inserted
          ? "Donation verified and recorded successfully."
          : "Donation already recorded (duplicate prevented).",
      });
    }

    /* ---- Webhook (Flutterwave server-to-server) ---- */
    if (action === "webhook") {
      // Verify webhook signature: HMAC-SHA256 of the event payload
      // using the encryption key
      const encryptionKey = Deno.env.get("FLUTTERWAVE_ENCRYPTION_KEY");
      if (!encryptionKey) {
        return jsonResponse(500, { error: "FLUTTERWAVE_ENCRYPTION_KEY not configured" });
      }

      const rawBody = await req.text();
      const flutterwaveSignature = req.headers.get("verif-hash") || "";

      if (!flutterwaveSignature) {
        return jsonResponse(401, { error: "Missing webhook signature" });
      }

      // Flutterwave sends a simple verification hash in the verif-hash header
      // For v3 webhooks, the signature is the encryption key itself (or a hash of the payload)
      // We verify by comparing the signature against the encryption key
      // This is Flutterwave's documented webhook verification method
      if (flutterwaveSignature !== encryptionKey) {
        // Also try HMAC verification as an alternative
        const hmac = createHmac("sha256", encryptionKey);
        hmac.update(rawBody);
        const computed = hmac.digest("hex");
        if (computed !== flutterwaveSignature) {
          return jsonResponse(401, { error: "Invalid webhook signature" });
        }
      }

      const event = JSON.parse(rawBody) as {
        event?: string;
        data?: {
          id?: number;
          tx_ref?: string;
          amount?: number;
          currency?: string;
          status?: string;
          customer?: { email?: string; name?: string; phone_number?: string };
        };
      };

      // Only process successful card/debit events
      if (event.event !== "charge.completed" && event.data?.status !== "successful") {
        return jsonResponse(200, { success: true, message: "Event ignored (not a successful charge)" });
      }

      const tx = event.data;
      if (!tx || !tx.id || !tx.tx_ref) {
        return jsonResponse(200, { success: true, message: "Incomplete transaction data" });
      }

      // Double-verify with Flutterwave API for security
      const verification = await verifyWithFlutterwave(tx.id);

      if (verification.status !== "success" || !verification.data || verification.data.status !== "successful") {
        return jsonResponse(200, { success: true, message: "Transaction not confirmed by API verification" });
      }

      const verifiedTx = verification.data;

      const result = await recordDonation(supabase, {
        txRef: verifiedTx.tx_ref,
        transactionId: verifiedTx.id,
        amount: verifiedTx.amount,
        currency: verifiedTx.currency,
        donorName: verifiedTx.customer?.name || null,
        donorEmail: verifiedTx.customer?.email || null,
        donorPhone: verifiedTx.customer?.phone_number || null,
        donorMessage: null,
        campaign: "GENERAL",
        paymentStatus: "successful",
      });

      if (result.error) {
        return jsonResponse(500, { success: false, error: result.error });
      }

      return jsonResponse(200, {
        success: true,
        verified: true,
        duplicate: !result.inserted,
        message: "Webhook processed successfully",
      });
    }

    return jsonResponse(404, { error: "Unknown action. Use /verify or /webhook." });
  } catch (err) {
    // Log the detail server-side; never return internal error text to the caller.
    console.error("[Flutterwave] Edge function error:", err instanceof Error ? err.message : err);
    return jsonResponse(500, { error: "Unable to complete the request." });
  }
});