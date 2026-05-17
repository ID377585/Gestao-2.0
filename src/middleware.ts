import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

import {
  CURRENT_TERMS_VERSION_ID,
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

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    console.warn(
      "Middleware sem NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY; usando fallback seguro para checagem de termos."
    );
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function readFallbackTermsCompliance(
  metadata: Record<string, unknown> | null | undefined
) {
  return readTermsComplianceFromMetadata(metadata ?? {});
}

async function getTermsComplianceState(
  userId: string,
  fallbackMetadata?: Record<string, unknown> | null
) {
  const supabaseAdmin = getSupabaseAdmin();

  if (!supabaseAdmin) {
    return readFallbackTermsCompliance(fallbackMetadata);
  }

  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (error) {
      throw error;
    }

    return readTermsComplianceFromMetadata(
      (data.user?.app_metadata as Record<string, unknown> | undefined) ??
        fallbackMetadata ??
        {}
    );
  } catch (error) {
    console.error(
      "Falha ao consultar aceite de termos no middleware; usando metadata da sessão como fallback:",
      error
    );
    return readFallbackTermsCompliance(fallbackMetadata);
  }
}

async function logTermsBlockedAttempt(req: NextRequest, userId: string) {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    if (!supabaseAdmin) {
      return;
    }

    const forwardedFor = req.headers.get("x-forwarded-for");
    const ipAddress = forwardedFor?.split(",")[0]?.trim() || null;
    const { data: membership } = await supabaseAdmin
      .from("memberships")
      .select("establishment_id, created_at")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!membership?.establishment_id) {
      return;
    }

    await supabaseAdmin.from("user_access_audit_logs").insert({
      establishment_id: membership.establishment_id,
      actor_user_id: userId,
      target_user_id: userId,
      action: "terms_blocked",
      details: {
        kind: "security_compliance",
        redirect: req.nextUrl.pathname,
        required_terms_version: CURRENT_TERMS_VERSION_ID,
        ip_address: ipAddress,
        user_agent: req.headers.get("user-agent"),
        path: req.nextUrl.pathname,
      },
    });
  } catch (error) {
    console.error("Falha ao registrar bloqueio por termos no middleware:", error);
  }
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
    const complianceState = await getTermsComplianceState(
      session.user.id,
      session.user.app_metadata as Record<string, unknown> | undefined
    );
    const acceptedCurrentTerms = hasAcceptedCurrentTerms(complianceState);

    if (isProtectedRoute(pathname) && !acceptedCurrentTerms) {
      await logTermsBlockedAttempt(req, session.user.id);

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