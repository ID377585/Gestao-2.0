// src/lib/supabase/server.ts
import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

/**
 * Retorna um client supabase configurado para Server Components (app/).
 *
 * Uso: const supabase = createSupabaseServerClient();
 *
 * Esse helper usa @supabase/ssr e lê os cookies do Next (next/headers).
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
 * Retorna um client supabase configurado para Route Handlers / API (app/api/).
 *
 * Uso em Route Handlers: const supabase = createSupabaseRouteClient();
 *
 * Esse helper usa createRouteHandlerClient de @supabase/auth-helpers-nextjs
 * e também lê cookies via next/headers.
 */
export function createSupabaseRouteClient() {
  const cookieStore = cookies();

  return createRouteHandlerClient({
    // createRouteHandlerClient aceita um objeto com cookies (get/set/remove).
    // Aqui disponibilizamos apenas get, que é suficiente para leitura da sessão.
    cookies: {
      get: (name: string) => cookieStore.get(name)?.value,
      // set / delete não são implementados intencionalmente aqui:
      // - Route Handlers costumam usar esse helper apenas para operações server-side
      // - Se precisar set/delete, podemos implementar wrappers que chamem Response cookies
    },
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  });
}
