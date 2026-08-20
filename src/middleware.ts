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
const API_CORS_METHODS = "GET,POST,PUT,PATCH,DELETE,OPTIONS";
const API_CORS_HEADERS = [
  "authorization",
  "content-type",
  "idempotency-key",
  "x-idempotency-key",
  "x-alerts-secret",
  "x-cron-secret",
  "x-fiscal-sync-secret",
  "x-job-worker-secret",
  "x-nutrition-cron-secret",
  "x-operational-readiness-secret",
].join(", ");

function getAllowedCorsOrigins(req: NextRequest) {
  const origins = new Set<string>([req.nextUrl.origin]);
  const configured = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    process.env.VERCEL_BRANCH_URL
      ? `https://${process.env.VERCEL_BRANCH_URL}`
      : null,
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : null,
    ...(process.env.GESTIFY_ALLOWED_CORS_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  ];

  for (const origin of configured) {
    if (!origin) continue;

    try {
      origins.add(new URL(origin).origin);
    } catch {
      // Ignore malformed optional environment entries.
    }
  }

  return origins;
}

function isCorsOriginAllowed(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  return getAllowedCorsOrigins(req).has(origin);
}

function applyCorsHeaders(req: NextRequest, response: NextResponse) {
  const origin = req.headers.get("origin");
  if (!origin || !isCorsOriginAllowed(req)) return response;

  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Access-Control-Allow-Methods", API_CORS_METHODS);
  response.headers.set("Access-Control-Allow-Headers", API_CORS_HEADERS);
  response.headers.set("Access-Control-Max-Age", "600");
  response.headers.append("Vary", "Origin");

  return response;
}

function handleApiCors(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith("/api/")) return null;

  if (!isCorsOriginAllowed(req)) {
    return NextResponse.json({ error: "Origem não permitida." }, { status: 403 });
  }

  if (req.method === "OPTIONS") {
    return applyCorsHeaders(req, new NextResponse(null, { status: 204 }));
  }

  return applyCorsHeaders(req, NextResponse.next());
}

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

function isInvalidRefreshTokenError(error: unknown) {
  const message = String((error as any)?.message ?? "").toLowerCase();
  const code = String((error as any)?.code ?? "").toLowerCase();
  const status = Number((error as any)?.status ?? 0);

  return (
    code.includes("refresh") ||
    code === "session_not_found" ||
    code === "bad_jwt" ||
    status === 401 ||
    message.includes("invalid refresh token") ||
    message.includes("refresh token not found") ||
    message.includes("refresh_token_not_found") ||
    message.includes("session from session_id claim in jwt does not exist") ||
    message.includes("jwt expired")
  );
}

function clearAuthAndTenantCookies(req: NextRequest, response: NextResponse) {
  const cookieNames = new Set<string>([TENANT_COOKIE_NAME]);

  for (const cookie of req.cookies.getAll()) {
    if (cookie.name.startsWith("sb-") || cookie.name === TENANT_COOKIE_NAME) {
      cookieNames.add(cookie.name);
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    try {
      const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
      if (projectRef) {
        cookieNames.add(`sb-${projectRef}-auth-token`);
        cookieNames.add(`sb-${projectRef}-auth-token.0`);
        cookieNames.add(`sb-${projectRef}-auth-token.1`);
      }
    } catch {
      // Ignore malformed optional environment values.
    }
  }

  for (const name of cookieNames) {
    response.cookies.set(name, "", {
      path: "/",
      maxAge: 0,
      sameSite: "lax",
    });
  }

  return response;
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

  const loadMembership = async (establishmentId: string | null) => {
    let membershipQuery = params.supabase
      .from("memberships")
      .select("establishment_id, role")
      .eq("user_id", params.userId)
      .eq("is_active", true);

    if (establishmentId) {
      membershipQuery = membershipQuery.eq("establishment_id", establishmentId);
    }

    return membershipQuery
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
  };

  let { data: membership, error: membershipError } = await loadMembership(
    params.selectedEstablishmentId
  );

  if (!membership?.establishment_id && params.selectedEstablishmentId) {
    ({ data: membership, error: membershipError } = await loadMembership(null));
  }

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
  const apiCorsResponse = handleApiCors(req);

  if (apiCorsResponse) {
    return apiCorsResponse;
  }

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

  const { data: claimsData, error: claimsError } =
    await middlewareClient.supabase.auth.getClaims();
  const claims = claimsData?.claims ?? null;

  supabaseResponse = middlewareClient.getResponse();

  if (claimsError && isInvalidRefreshTokenError(claimsError)) {
    const clearedResponse = clearAuthAndTenantCookies(req, supabaseResponse);

    if (isProtectedRoute(pathname)) {
      return redirectWithCookies(req, clearedResponse, "/login", {
        redirect: pathname,
      });
    }

    return clearedResponse;
  }

  if (claimsError) {
    console.warn("[middleware] sessão não pôde ser validada por claims:", {
      message: claimsError.message,
    });
  }

  const userId = typeof claims?.sub === "string" ? claims.sub : null;

  if (!userId && isProtectedRoute(pathname)) {
    return redirectWithCookies(req, supabaseResponse, "/login", {
      redirect: pathname,
    });
  }

  if (!userId) {
    return supabaseResponse;
  }

  const complianceState = getSessionTermsCompliance(
    claims?.app_metadata as Record<string, unknown> | undefined
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
      userId,
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
    "/api/:path*",
  ],
};