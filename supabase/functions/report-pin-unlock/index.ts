// Called by the Android app right after a customer unlocks their phone offline using
// a PIN code (see LockActivity's "Unlock with a code from the store"). The phone
// unlocks itself immediately and fully offline — this call is just how that fact gets
// reported back to Supabase once the phone has a connection again, so the admin panel
// (is_locked, device_events) reflects reality. Re-validates the PIN server-side
// (using the service role) before changing anything — the phone is never trusted to
// have unlocked for a good reason on its own.
//
// Body: { "imei": "...", "pin": "123456" }
// Response: { "success": true } or { "success": false, "reason": "..." }

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-device-imei",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { imei, pin } = await req.json();
    if (!imei || !pin) {
      return new Response(JSON.stringify({ success: false, reason: "imei and pin required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: device, error } = await supabase
      .from("devices")
      .select("id, unlock_pin")
      .eq("imei", imei)
      .maybeSingle();

    if (error) throw error;

    if (!device || !device.unlock_pin || device.unlock_pin !== pin) {
      return new Response(JSON.stringify({ success: false, reason: "invalid code" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase
      .from("devices")
      .update({ is_locked: false })
      .eq("id", device.id);

    await supabase
      .from("device_events")
      .insert({ device_id: device.id, event_type: "UNLOCK", method: "PIN_CODE" });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, reason: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
