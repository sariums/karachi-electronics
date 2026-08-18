import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://jslhwzsozfrgwptasjsz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_dAoOVRD_P39GL243ykg-4w_CnrvCNVk";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
