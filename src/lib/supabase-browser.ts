"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabasePublicEnv } from "@/lib/supabase/config";

let _client: SupabaseClient | null = null;

/**
 * ✅ Nome esperado em /dashboard/pedidos/page.tsx
 */
export function createSupabaseBrowserClient(): SupabaseClient {
  if (_client) return _client;

  const { supabaseUrl, supabaseKey } = getSupabasePublicEnv();

  if (!supabaseUrl || !supabaseKey) {
    console.warn(
      "[supabase-browser] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
    );
  }

  _client = createBrowserClient(supabaseUrl!, supabaseKey!);
  return _client;
}

/**
 * ✅ Compatibilidade com seu /auth/login/page.tsx
 * const supabase = supabaseBrowser();
 */
export function supabaseBrowser(): SupabaseClient {
  return createSupabaseBrowserClient();
}
