import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

import {
  getRequiredSupabasePublicEnv,
  getRequiredSupabaseServiceRoleKey,
} from "./config";

type CookieStore = Awaited<ReturnType<typeof cookies>>;

export async function createSupabaseServerClient(
  cookieStorePromise: ReturnType<typeof cookies> = cookies()
) {
  const cookieStore: CookieStore = await cookieStorePromise;
  const { supabaseUrl, supabaseKey } = getRequiredSupabasePublicEnv();

  return createServerClient(supabaseUrl, supabaseKey, {
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
  });
}

export async function createSupabaseRouteClient() {
  const cookieStore: CookieStore = await cookies();
  const { supabaseUrl, supabaseKey } = getRequiredSupabasePublicEnv();

  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  return createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: cookieHeader ? { cookie: cookieHeader } : {},
    },
  });
}

export async function createSupabaseClientWithCookieHeader() {
  return createSupabaseRouteClient();
}

export function createSupabaseAdminClient() {
  const { supabaseUrl } = getRequiredSupabasePublicEnv();
  const serviceRoleKey = getRequiredSupabaseServiceRoleKey();

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
