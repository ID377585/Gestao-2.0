import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const MIDDLEWARE_FETCH_TIMEOUT_MS = 6_000;

function getSupabaseKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
}

const fetchWithTimeout: typeof fetch = async (input, init) => {
  const controller = new AbortController();
  const upstreamSignal = init?.signal;
  const handleUpstreamAbort = () => controller.abort(upstreamSignal?.reason);

  if (upstreamSignal?.aborted) {
    handleUpstreamAbort();
  } else {
    upstreamSignal?.addEventListener("abort", handleUpstreamAbort, { once: true });
  }

  const timeoutId = setTimeout(() => {
    controller.abort(new Error("Gestify proxy Supabase request timeout"));
  }, MIDDLEWARE_FETCH_TIMEOUT_MS);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
    upstreamSignal?.removeEventListener("abort", handleUpstreamAbort);
  }
};

export function createClient(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = getSupabaseKey();

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY são obrigatórias."
    );
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    global: {
      fetch: fetchWithTimeout,
    },
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
