"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

let _client: SupabaseClient | null = null;

/**
 * ✅ Nome esperado em /dashboard/pedidos/page.tsx
 */
export function createSupabaseBrowserClient(): SupabaseClient {
  if (_client) return _client;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
      "[supabase-browser] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  _client = createBrowserClient(supabaseUrl, supabaseAnonKey);
  return _client;
}

/**
 * ✅ Compatibilidade com seu /auth/login/page.tsx
 * const supabase = supabaseBrowser();
 */
export function supabaseBrowser(): SupabaseClient {
  return createSupabaseBrowserClient();
}
