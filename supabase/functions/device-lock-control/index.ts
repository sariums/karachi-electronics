// External lock/unlock API.
//
// Lets an OUTSIDE system tell our system to lock or unlock a specific phone by its
// IMEI. It mirrors exactly what the admin panel's Lock/Unlock buttons do:
//   1. writes a device_commands row (LOCK / UNLOCK),
//   2. flips devices.is_locked,
//   3. records a device_events row (audit/history),
//   4. sends an FCM "go check" push so the phone reacts within seconds
//      (if the push fails, the phone still picks it up on its normal ~15-min poll).
//
// Request:
//   POST  https://<project>.functions.supabase.co/device-lock-control
//   Header:  x-api-key: <the branch's api_key>
//   Body:    { "imei": "357521141912430", "action": "lock" }   // or "unlock"
//
// Response (200):
//   { "ok": true, "imei": "...", "action": "lock", "device_id": "...",
//     "is_locked": true, "pushed": true }
//
// Auth is PER-BRANCH: the x-api-key is a branch's own key (branches.api_key). It
// identifies the branch and limits control to THAT branch's devices only — a key
// cannot touch another branch's phones.
//
// Required secrets (same project): SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (auto),
//   FIREBASE_SERVICE_ACCOUNT_JSON (Firebase service account key for FCM), FCM_PROJECT_ID.
//
// Deploy with JWT verification OFF so the outside system can call it with just the
// x-api-key header (not a Supabase JWT): see supabase/config.toml.

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

  const providedKey = req.headers.get("x-api-key");
  if (!providedKey) return json({ error: "unauthorized" }, 401);

  // ---- 1. Validate the request body ----------------------------------------
  let body: { imei?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }
  const imei = (body.imei ?? "").toString().trim();
  const action = (body.action ?? "").toString().trim().toLowerCase();
  if (!imei) return json({ error: "imei required" }, 400);
  if (action !== "lock" && action !== "unlock") {
    return json({ error: "action must be 'lock' or 'unlock'" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ---- 2. Authenticate: the API key identifies a BRANCH --------------------
  // Each branch has its own key, so a key can only ever touch that branch's own
  // devices. An unknown key is a 401; a valid key scopes everything below to its branch.
  const { data: branch, error: keyErr } = await supabase
    .from("branches")
    .select("id")
    .eq("api_key", providedKey)
    .maybeSingle();
  if (keyErr) return json({ error: keyErr.message }, 500);
  if (!branch) return json({ error: "unauthorized" }, 401);

  // ---- 3. Find the device by IMEI *within that branch* ---------------------
  const { data: device, error: findErr } = await supabase
    .from("devices")
    .select("id, is_locked, fcm_token")
    .eq("imei", imei)
    .eq("branch_id", branch.id)
    .maybeSingle();
  if (findErr) return json({ error: findErr.message }, 500);
  if (!device) return json({ error: "device not found for imei in this branch", imei }, 404);

  const lock = action === "lock";
  const command = lock ? "LOCK" : "UNLOCK";

  // ---- 4. Apply exactly what the admin panel's Lock/Unlock does -------------
  // Command row (history of issued commands) — best-effort.
  try {
    await supabase.from("device_commands").insert({
      device_id: device.id,
      command,
      issued_by: "external-api",
    });
  } catch (e) {
    console.error("device_commands insert failed", e);
  }

  // The authoritative state the phone reads on every poll. This one must succeed.
  const { error: upErr } = await supabase
    .from("devices")
    .update({ is_locked: lock })
    .eq("id", device.id);
  if (upErr) return json({ error: upErr.message }, 500);

  // Event log (shown in device history) — best-effort.
  try {
    await supabase.from("device_events").insert({
      device_id: device.id,
      event_type: command,
      method: "ADMIN",
    });
  } catch (e) {
    console.error("device_events insert failed", e);
  }

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

  return json({
    ok: true,
    imei,
    action,
    device_id: device.id,
    is_locked: lock,
    pushed,
  });
});
