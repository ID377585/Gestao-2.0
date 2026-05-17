import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

import { getRequiredSupabasePublicEnv } from "./config";

type CookieStore = ReturnType<typeof cookies>;

export function createSupabaseServerClient(cookieStore: CookieStore = cookies()) {
  const { supabaseUrl, supabaseKey } = getRequiredSupabasePublicEnv();

  return createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components cannot set cookies. Middleware refreshes sessions.
          }
        },
      },
    }
  );
}

export function createSupabaseRouteClient() {
  const cookieStore = cookies();
  const { supabaseUrl, supabaseKey } = getRequiredSupabasePublicEnv();

  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  return createClient(
    supabaseUrl,
    supabaseKey,
    {
      global: {
        headers: cookieHeader ? { cookie: cookieHeader } : {},
      },
    }
  );
}

export function createSupabaseClientWithCookieHeader() {
  const cookieStore = cookies();
  const { supabaseUrl, supabaseKey } = getRequiredSupabasePublicEnv();

  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  return createClient(
    supabaseUrl,
    supabaseKey,
    {
      global: {
        headers: cookieHeader ? { cookie: cookieHeader } : {},
      },
    }
  );
}

export function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL não configurada.");
  }

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

let cachedSupabaseAdmin: ReturnType<typeof createSupabaseAdminClient> | null = null;

export function getSupabaseAdminClient() {
  if (!cachedSupabaseAdmin) {
    cachedSupabaseAdmin = createSupabaseAdminClient();
  }

  return cachedSupabaseAdmin;
}

export const supabaseAdmin = new Proxy(
  {} as ReturnType<typeof createSupabaseAdminClient>,
  {
    get(_target, prop, receiver) {
      return Reflect.get(getSupabaseAdminClient(), prop, receiver);
    },
  }
);
