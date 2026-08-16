import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const adminKey =
  process.env.SUPABASE_SECRET_KEY_PREVIEW ??
  process.env.SUPABASE_SECRET_KEY_NEW ??
  process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL não definida.");
}

if (!adminKey) {
  throw new Error("Credencial administrativa Supabase moderna não definida.");
}

export const supabaseAdmin = createClient(supabaseUrl, adminKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
