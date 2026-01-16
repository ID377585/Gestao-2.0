// src/lib/supabase/server.ts
import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Retorna um client supabase configurado para Server Components (app/).
 */
export function createSupabaseServerClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        // Não implementamos set/remove aqui (não use fora de Server Action).
      },
    }
  );
}

/**
 * Alias/compatibilidade para quem importa createSupabaseRouteClient().
 */
export const createSupabaseRouteClient = () => createSupabaseServerClient();
