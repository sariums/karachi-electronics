// Called by the admin panel's "Invite user" form (Settings > Account Management).
// Uses the service role to create the Supabase Auth user and send them a real invite
// email with a link to set their password — the anon/authenticated client can't do
// either of those (auth.admin.* requires the service role). Once the auth user
// exists, records name/role alongside it in admin_users so the admin panel can list
// them without needing admin API access on every page load.
//
// Body: { "name": "...", "email": "...", "role": "...", "invited_by": "..." }
// Response: { "success": true } or { "success": false, "reason": "..." }

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { name, email, role, invited_by } = await req.json();
    if (!name || !email || !role) {
      return new Response(JSON.stringify({ success: false, reason: "name, email and role are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: invited, error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(email);
    if (inviteErr) {
      return new Response(JSON.stringify({ success: false, reason: inviteErr.message }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: insertErr } = await supabase.from("admin_users").insert({
      id: invited.user.id,
      name,
      email,
      role,
      status: "Invited",
      invited_by: invited_by || null,
    });
    if (insertErr) {
      return new Response(JSON.stringify({ success: false, reason: insertErr.message }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
