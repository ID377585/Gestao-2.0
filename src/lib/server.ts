// src/lib/server.ts
// Compatibilidade: re-exporta os helpers do module src/lib/supabase/server.ts
export {
  createSupabaseServerClient,
  createSupabaseRouteClient,
  createSupabaseClientWithCookieHeader,
} from "@/lib/supabase/server";
