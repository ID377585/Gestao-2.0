"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getSupabasePublicEnv } from "@/lib/supabase/config";

const { supabaseUrl, supabaseKey } = getSupabasePublicEnv();

if (!supabaseUrl || !supabaseKey) {
  // evita crash silencioso em runtime — mas não quebra build
  console.warn(
    "[supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
  );
}

// ✅ export que seus pages esperam
export const supabase = createBrowserClient(supabaseUrl!, supabaseKey!);
