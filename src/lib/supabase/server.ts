// src/lib/supabase/server.ts
import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

/**
 * Retorna um client supabase configurado para Server Components (app/).
 * Uso: const supabase = createSupabaseServerClient();
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
 * Retorna um client supabase para Route Handlers / API (app/api/).
 * Uso: const supabase = createSupabaseRouteClient();
 *
 * Constrói headers de forma segura (somente adiciona cookie se houver valor),
 * evitando problemas de typing (string | undefined).
 */
export function createSupabaseRouteClient() {
  const cookieStore = cookies();
  const cookieHeader = cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join("; ");

  const headers: Record<string, string> = {};
  if (cookieHeader) headers.cookie = cookieHeader;

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers,
      },
    }
  );
}

/**
 * Fallback / compatibilidade: cria um client manualmente (createClient)
 * e garante que o header `cookie` contenha os cookies do Next.
 */
export function createSupabaseClientWithCookieHeader() {
  const cookieStore = cookies();
  const cookieHeader = cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join("; ");

  const headers: Record<string, string> = {};
  if (cookieHeader) headers.cookie = cookieHeader;

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers,
      },
    }
  );
}
