// src/lib/server.ts
// Re-exporta helpers do módulo src/lib/supabase/server.ts para compatibilidade de import.
export {
  createSupabaseServerClient,
  createSupabaseRouteClient,
  createSupabaseClientWithCookieHeader,
} from "@/lib/supabase/server";
