import { NextResponse, type NextRequest } from "next/server";

import {
  TERMS_REQUIRED_QUERY_VALUE,
  hasAcceptedCurrentTerms,
  readTermsComplianceFromMetadata,
} from "@/lib/auth/terms-config";
import { createClient as createSupabaseMiddlewareClient } from "@/utils/supabase/middleware";
import { TENANT_COOKIE_NAME } from "@/lib/tenant/constants";
import {
  getDefaultModulePermissionsForRole,
  getModuleKeyForPathname,
} from "@/lib/tenant/module-routes";

const DEFAULT_AUTH_REDIRECT = "/dashboard/pedidos";

function isAuthRoute(pathname: string) {
  return (
    pathname === "/login" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname.startsWith("/login/") ||
    pathname.startsWith("/forgot-password/") ||
    pathname.startsWith("/reset-password/")
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
  if (!raw) return DEFAULT_AUTH_REDIRECT;

  try {
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      return DEFAULT_AUTH_REDIRECT;
    }

    if (!raw.startsWith("/")) return DEFAULT_AUTH_REDIRECT;

    const url = new URL(raw, "http://local");
    if (url.pathname.startsWith("//")) return DEFAULT_AUTH_REDIRECT;

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return DEFAULT_AUTH_REDIRECT;
  }
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

async function userCanAccessProtectedModule(params: {
  supabase: ReturnType<typeof createSupabaseMiddlewareClient>["supabase"];
  userId: string;
  pathname: string;
  selectedEstablishmentId: string | null;
}) {
  const moduleKey = getModuleKeyForPathname(params.pathname);

  if (!moduleKey) {
    return true;
  }

  let membershipQuery = params.supabase
    .from("memberships")
    .select("establishment_id, role")
    .eq("user_id", params.userId)
    .eq("is_active", true);

  if (params.selectedEstablishmentId) {
    membershipQuery = membershipQuery.eq(
      "establishment_id",
      params.selectedEstablishmentId
    );
  }

  const { data: membership, error: membershipError } = await membershipQuery
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (membershipError || !membership?.establishment_id) {
    console.error("[middleware] active membership lookup failed:", {
      message: membershipError?.message,
      selected_establishment_id: params.selectedEstablishmentId,
    });
    return false;
  }

  const role = String((membership as any).role ?? "");
  const establishmentId = String((membership as any).establishment_id);

  const { data: permission, error: permissionError } = await params.supabase
    .from("user_module_permissions")
    .select("can_access")
    .eq("establishment_id", establishmentId)
    .eq("user_id", params.userId)
    .eq("module_key", moduleKey)
    .maybeSingle();

  if (permissionError) {
    console.error("[middleware] module permission lookup failed:", {
      message: permissionError.message,
      code: permissionError.code,
      module_key: moduleKey,
    });
    return Boolean(getDefaultModulePermissionsForRole(role)[moduleKey]);
  }

  if (!permission) {
    return Boolean(getDefaultModulePermissionsForRole(role)[moduleKey]);
  }

  return Boolean((permission as any).can_access);
}

function redirectWithCookies(
  req: NextRequest,
  supabaseResponse: NextResponse,
  pathname: string,
  params?: Record<string, string>
) {
  const url = new URL(pathname, req.url);

  Object.entries(params ?? {}).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return copyResponseCookies(supabaseResponse, NextResponse.redirect(url));
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

  /*
   * Mantemos getUser() por enquanto porque o fluxo de aceite de termos depende
   * de app_metadata. A melhoria cirúrgica aqui é reduzir escopo, endurecer
   * redirects e evitar trabalho desnecessário fora das rotas realmente usadas.
   *
   * Próximo passo seguro: migrar a checagem simples de sessão para getClaims()
   * somente depois de confirmar que o projeto usa JWT assimétrico/JWKS e que o
   * estado de termos pode ser lido dos claims sem quebrar o fluxo atual.
   */
  const {
    data: { user },
  } = await middlewareClient.supabase.auth.getUser();

  supabaseResponse = middlewareClient.getResponse();

  if (!user && isProtectedRoute(pathname)) {
    return redirectWithCookies(req, supabaseResponse, "/login", {
      redirect: pathname,
    });
  }

  if (!user) {
    return supabaseResponse;
  }

  const complianceState = getSessionTermsCompliance(
    user.app_metadata as Record<string, unknown> | undefined
  );
  const acceptedCurrentTerms = hasAcceptedCurrentTerms(complianceState);

  if (isProtectedRoute(pathname) && !acceptedCurrentTerms) {
    return redirectWithCookies(req, supabaseResponse, "/login", {
      redirect: pathname,
      terms: TERMS_REQUIRED_QUERY_VALUE,
    });
  }

  if (isAuthRoute(pathname) && acceptedCurrentTerms) {
    const requestedRedirect = safeRedirect(
      req.nextUrl.searchParams.get("redirect")
    );

    return copyResponseCookies(
      supabaseResponse,
      NextResponse.redirect(new URL(requestedRedirect, req.url))
    );
  }

  if (isProtectedRoute(pathname)) {
    const canAccessModule = await userCanAccessProtectedModule({
      supabase: middlewareClient.supabase,
      userId: user.id,
      pathname,
      selectedEstablishmentId: req.cookies.get(TENANT_COOKIE_NAME)?.value ?? null,
    });

    if (!canAccessModule) {
      return copyResponseCookies(
        supabaseResponse,
        NextResponse.redirect(new URL("/sem-acesso", req.url))
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
    "/login/:path*",
    "/forgot-password",
    "/forgot-password/:path*",
    "/reset-password",
    "/reset-password/:path*",
  ],
};
