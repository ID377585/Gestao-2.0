import { NextResponse, type NextRequest } from "next/server";

import {
  TERMS_REQUIRED_QUERY_VALUE,
  hasAcceptedCurrentTerms,
  readTermsComplianceFromMetadata,
} from "@/lib/auth/terms-config";
import { createClient as createSupabaseMiddlewareClient } from "@/utils/supabase/middleware";

function isAuthRoute(pathname: string) {
  return (
    pathname.startsWith("/login") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password")
  );
}

function isProtectedRoute(pathname: string) {
  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/compras") ||
    pathname.startsWith("/financeiro")
  );
}

function safeRedirect(raw: string | null) {
  if (!raw) return "/dashboard/pedidos";
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return "/dashboard/pedidos";
  }
  if (!raw.startsWith("/")) return "/dashboard/pedidos";
  return raw;
}

function getSessionTermsCompliance(
  metadata: Record<string, unknown> | null | undefined
) {
  return readTermsComplianceFromMetadata(metadata ?? {});
}

function copyResponseCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie);
  });

  return target;
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  let supabaseResponse = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });
  let middlewareClient: ReturnType<typeof createSupabaseMiddlewareClient>;

  try {
    middlewareClient = createSupabaseMiddlewareClient(req);
    supabaseResponse = middlewareClient.getResponse();
  } catch {
    console.error(
      "Middleware sem NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
    );
    return supabaseResponse;
  }

  const {
    data: { user },
  } = await middlewareClient.supabase.auth.getUser();
  supabaseResponse = middlewareClient.getResponse();

  if (!user && isProtectedRoute(pathname)) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    return copyResponseCookies(
      supabaseResponse,
      NextResponse.redirect(loginUrl)
    );
  }

  if (user) {
    const complianceState = getSessionTermsCompliance(
      user.app_metadata as Record<string, unknown> | undefined
    );
    const acceptedCurrentTerms = hasAcceptedCurrentTerms(complianceState);

    if (isProtectedRoute(pathname) && !acceptedCurrentTerms) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("redirect", pathname);
      loginUrl.searchParams.set("terms", TERMS_REQUIRED_QUERY_VALUE);
      return copyResponseCookies(
        supabaseResponse,
        NextResponse.redirect(loginUrl)
      );
    }

    if (isAuthRoute(pathname) && acceptedCurrentTerms) {
      const requestedRedirect = safeRedirect(req.nextUrl.searchParams.get("redirect"));
      return copyResponseCookies(
        supabaseResponse,
        NextResponse.redirect(new URL(requestedRedirect, req.url))
      );
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/compras/:path*",
    "/financeiro/:path*",
    "/login",
    "/forgot-password",
    "/reset-password",
    "/sem-acesso",
  ],
};
