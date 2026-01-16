// src/lib/supabase/server.ts
import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

/**
 * Retorna um client supabase configurado para Server Components (app/).
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
 * Retorna um client supabase para Route Handlers / API (app/api/).
 *
 * Em vez de depender de @supabase/auth-helpers-nextjs, criamos manualmente
 * um client com o header cookie preenchido, que funciona em Route Handlers.
 *
 * Uso: const supabase = createSupabaseRouteClient();
 */
export function createSupabaseRouteClient() {
  const cookieStore = cookies();
  const cookieHeader = cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join("; ");

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: {
      headers: {
        // se cookieHeader for string vazia, evita enviar "cookie: ''"
        cookie: cookieHeader || undefined,
      },
    },
  });
}

/**
 * Fallback / compatibilidade: cria um client manualmente (createClient)
 * e garante que o header `cookie` contenha os cookies do Next.
 *
 * Use este helper somente se você realmente precisa criar um client manualmente
 * (por exemplo, alguma lógica antiga que usa createClient diretamente).
 */
export function createSupabaseClientWithCookieHeader() {
  const cookieStore = cookies();
  const cookieHeader = cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join("; ");

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: {
      headers: {
        cookie: cookieHeader || undefined,
      },
    },
  });
}
