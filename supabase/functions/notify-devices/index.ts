// Wakes one or more customer phones instantly via Firebase Cloud Messaging.
//
// Called by the admin panel right after it writes a device_commands row (LOCK,
// UNLOCK, or NOTIFY) and flips devices.is_locked if relevant. This function does NOT
// decide *what* the phone should do — it only sends a "something changed, go check"
// push. The phone always re-derives the real state from Supabase itself, so this
// function being down, slow, or misconfigured just means the phone falls back to its
// normal ~15 minute poll instead of reacting instantly. Nothing is lost.
//
// Body: { "device_ids": ["<uuid>", ...] }
//
// Required secrets (set via `supabase secrets set` or the Dashboard):
//   FIREBASE_SERVICE_ACCOUNT_JSON  — full contents of the Firebase service account key
//   FCM_PROJECT_ID                 — the Firebase project id (karachi-electronics-9063a)

import { createClient } from "npm:@supabase/supabase-js@2";
import { GoogleAuth } from "npm:google-auth-library@9";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { device_ids } = await req.json();
    if (!Array.isArray(device_ids) || device_ids.length === 0) {
      return new Response(JSON.stringify({ error: "device_ids (non-empty array) required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: devices, error } = await supabase
      .from("devices")
      .select("id, fcm_token")
      .in("id", device_ids)
      .not("fcm_token", "is", null);

    if (error) throw error;

    const projectId = Deno.env.get("FCM_PROJECT_ID")!;
    const serviceAccount = JSON.parse(Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON")!);
    const auth = new GoogleAuth({
      credentials: serviceAccount,
      scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
    });
    const authClient = await auth.getClient();
    const accessToken = (await authClient.getAccessToken()).token;

    const results = [];
    for (const device of devices ?? []) {
      const resp = await fetch(
        `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token: device.fcm_token,
              data: { type: "sync" },
              android: { priority: "high" },
            },
          }),
        },
      );
      results.push({ device_id: device.id, ok: resp.ok, status: resp.status });
    }

    const skipped = device_ids.filter(
      (id: string) => !(devices ?? []).some((d) => d.id === id),
    );

    return new Response(JSON.stringify({ sent: results, skipped_no_token: skipped }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const detail = e instanceof Error ? `${e.name}: ${e.message}\n${e.stack ?? ""}` : JSON.stringify(e);
    console.error(detail);
    return new Response(JSON.stringify({ error: detail }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
