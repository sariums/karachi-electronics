// External push-notification / popup API.
//
// Lets an OUTSIDE system send a message to a specific phone by its IMEI — either a
// normal notification or a full-screen popup — mirroring the admin panel's
// Popups/Notifications sender:
//   1. writes a device_commands row (POPUP or NOTIFY) carrying the title + message,
//   2. sends an FCM "go check" push so the phone shows it within seconds
//      (if the push fails, the phone still picks it up on its normal ~15-min poll).
//
// Request:
//   POST  https://<project>.functions.supabase.co/device-notify
//   Header:  x-api-key: <EXTERNAL_API_KEY secret>
//   Body:    { "imei": "357521141912430",
//              "type": "popup",            // "popup" (full screen) or "notify" (notification); default "notify"
//              "title": "Payment overdue",
//              "message": "Please clear your installment to keep using the phone." }
//
// Response (200):
//   { "ok": true, "imei": "...", "type": "popup", "device_id": "...", "pushed": true }
//
// Required secrets (same project): EXTERNAL_API_KEY, SUPABASE_URL,
//   SUPABASE_SERVICE_ROLE_KEY, FIREBASE_SERVICE_ACCOUNT_JSON, FCM_PROJECT_ID.
//
// Deploy with JWT verification OFF (see supabase/config.toml) so the outside system
// can call it with just the x-api-key header.

import { createClient } from "npm:@supabase/supabase-js@2";
import { GoogleAuth } from "npm:google-auth-library@9";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  // ---- 1. Authenticate the caller with the shared API key -------------------
  const expectedKey = Deno.env.get("EXTERNAL_API_KEY");
  const providedKey = req.headers.get("x-api-key");
  if (!expectedKey || !providedKey || providedKey !== expectedKey) {
    return json({ error: "unauthorized" }, 401);
  }

  // ---- 2. Validate the request body ----------------------------------------
  let body: { imei?: string; type?: string; title?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }
  const imei = (body.imei ?? "").toString().trim();
  const type = (body.type ?? "notify").toString().trim().toLowerCase();
  const title = (body.title ?? "").toString().trim();
  const message = (body.message ?? "").toString().trim();

  if (!imei) return json({ error: "imei required" }, 400);
  if (type !== "popup" && type !== "notify") {
    return json({ error: "type must be 'popup' or 'notify'" }, 400);
  }
  if (!message) return json({ error: "message required" }, 400);

  const command = type === "popup" ? "POPUP" : "NOTIFY";

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ---- 3. Find the device by IMEI ------------------------------------------
  const { data: device, error: findErr } = await supabase
    .from("devices")
    .select("id, fcm_token")
    .eq("imei", imei)
    .maybeSingle();
  if (findErr) return json({ error: findErr.message }, 500);
  if (!device) return json({ error: "device not found for imei", imei }, 404);

  // ---- 4. Queue the popup/notification (what the phone reads on poll) -------
  const { error: cmdErr } = await supabase.from("device_commands").insert({
    device_id: device.id,
    command,
    title: title || "Notice",
    message,
    issued_by: "external-api",
  });
  if (cmdErr) return json({ error: cmdErr.message }, 500);

  // ---- 5. Instant FCM "go check" push (best-effort) ------------------------
  let pushed = false;
  try {
    if (device.fcm_token) {
      const projectId = Deno.env.get("FCM_PROJECT_ID")!;
      const serviceAccount = JSON.parse(Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON")!);
      const auth = new GoogleAuth({
        credentials: serviceAccount,
        scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
      });
      const authClient = await auth.getClient();
      const accessToken = (await authClient.getAccessToken()).token;
      const resp = await fetch(
        `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            message: {
              token: device.fcm_token,
              data: { type: "sync" },
              android: { priority: "high" },
            },
          }),
        },
      );
      pushed = resp.ok;
    }
  } catch (e) {
    console.error("FCM push failed", e);
  }

  return json({ ok: true, imei, type, device_id: device.id, pushed });
});
