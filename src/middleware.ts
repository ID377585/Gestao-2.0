import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import {
  TERMS_REQUIRED_QUERY_VALUE,
  hasAcceptedCurrentTerms,
  readTermsComplianceFromMetadata,
} from "@/lib/auth/terms-config";

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

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const pathname = req.nextUrl.pathname;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      "Middleware sem NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
    return res;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return req.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        res.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: any) {
        res.cookies.set({ name, value: "", ...options });
      },
    },
  });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session && isProtectedRoute(pathname)) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (session) {
    const complianceState = getSessionTermsCompliance(
      session.user.app_metadata as Record<string, unknown> | undefined
    );
    const acceptedCurrentTerms = hasAcceptedCurrentTerms(complianceState);

    if (isProtectedRoute(pathname) && !acceptedCurrentTerms) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("redirect", pathname);
      loginUrl.searchParams.set("terms", TERMS_REQUIRED_QUERY_VALUE);
      return NextResponse.redirect(loginUrl);
    }

    if (isAuthRoute(pathname) && acceptedCurrentTerms) {
      const requestedRedirect = safeRedirect(req.nextUrl.searchParams.get("redirect"));
      return NextResponse.redirect(new URL(requestedRedirect, req.url));
    }
  }

  return res;
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