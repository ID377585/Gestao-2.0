import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  SupabaseEnvError,
  getMissingSupabasePublicEnv,
  getRequiredSupabasePublicEnv,
} from "@/lib/supabase/config";

export function createClient(request: NextRequest) {
  const missingVariables = getMissingSupabasePublicEnv();

  if (missingVariables.length > 0) {
    throw new SupabaseEnvError(
      `Middleware sem configuração do Supabase: ${missingVariables.join(", ")}.`,
      missingVariables
    );
  }

  const { supabaseUrl, supabaseKey } = getRequiredSupabasePublicEnv();

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  return {
    supabase,
    getResponse() {
      return response;
    },
  };
}
