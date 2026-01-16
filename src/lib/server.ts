// src/lib/supabase/server.ts
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import {
  createServerComponentClient,
  createRouteHandlerClient,
} from "@supabase/auth-helpers-nextjs";
// import { Database } from "@/lib/supabase/types"; // descomente se você tiver tipos

// As variáveis abaixo devem existir no seu .env (ou no ambiente do deploy)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Helper para Server Components / layouts (app/).
 * Uso: const supabase = createSupabaseServerClient();
 *
 * Retorna um SupabaseClient configurado para o contexto de Server Component,
 * lendo os cookies via `next/headers`.
 */
export const createSupabaseServerClient = () => {
  return createServerComponentClient({
    cookies,
    // opcional: passa as envs explicitamente (ajuda em alguns setups)
    supabaseUrl: SUPABASE_URL,
    supabaseKey: SUPABASE_ANON_KEY,
  });
};

/**
 * Helper para Route Handlers / API (app/api/).
 * Uso: const supabase = createSupabaseRouteClient();
 *
 * Retorna um SupabaseClient adequado para Route Handlers, também lendo os cookies
 * via `next/headers`.
 */
export const createSupabaseRouteClient = () => {
  return createRouteHandlerClient({
    cookies,
    supabaseUrl: SUPABASE_URL,
    supabaseKey: SUPABASE_ANON_KEY,
  });
};

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

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        // se cookieHeader for string vazia, evita enviar "cookie: ''" (usa undefined)
        cookie: cookieHeader || undefined,
      },
    },
  });
}

// se já não existir, exporte um alias para evitar erros de import
export const createSupabaseRouteClient = () => createSupabaseServerClient();
