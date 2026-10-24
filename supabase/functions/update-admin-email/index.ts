// Updates a branch admin's login email. Changing an Auth user's email needs the
// service role (auth.admin.*), so it can't be done from the panel's client directly.
// Only a SUPER ADMIN may call this — we verify the caller's JWT before touching anything.
//
// Body: { "user_id": "<admin_users.id = auth user id>", "new_email": "..." }
// Response: { "success": true } or { "success": false, "reason": "..." }

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { user_id, new_email } = await req.json();
    if (!user_id || !new_email) {
      return json({ success: false, reason: "user_id and new_email are required" }, 400);
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(new_email)) {
      return json({ success: false, reason: "invalid email" }, 400);
    }

    const serviceUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // ---- Verify the CALLER is a super admin --------------------------------
    const authHeader = req.headers.get("Authorization") ?? "";
    const asCaller = createClient(serviceUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await asCaller.auth.getUser();
    if (userErr || !userData?.user) return json({ success: false, reason: "not authenticated" }, 401);

    const admin = createClient(serviceUrl, serviceKey);
    const { data: caller } = await admin
      .from("admin_users")
      .select("is_super_admin")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (!caller?.is_super_admin) return json({ success: false, reason: "super admin only" }, 403);

    // ---- Update the Auth user's email, then the admin_users record ----------
    const { error: authUpdErr } = await admin.auth.admin.updateUserById(user_id, {
      email: new_email,
      email_confirm: true,
    });
    if (authUpdErr) return json({ success: false, reason: authUpdErr.message }, 200);

    const { error: rowErr } = await admin
      .from("admin_users")
      .update({ email: new_email })
      .eq("id", user_id);
    if (rowErr) return json({ success: false, reason: rowErr.message }, 200);

    return json({ success: true });
  } catch (e) {
    return json({ success: false, reason: String(e) }, 500);
  }
});
