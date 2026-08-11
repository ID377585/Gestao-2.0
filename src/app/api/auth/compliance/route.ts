import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import {
  CURRENT_TERMS_DOCUMENT_TITLE,
  CURRENT_TERMS_DOCUMENT_VERSION,
  CURRENT_TERMS_UPDATED_AT,
  hasAcceptedCurrentTerms,
  readTermsComplianceFromMetadata,
} from "@/lib/auth/terms-config";
import {
  getUserTermsComplianceState,
  recordTermsAcceptanceForCurrentUser,
} from "@/lib/auth/terms-compliance.server";
import { getRequiredSupabasePublicEnv } from "@/lib/supabase/config";
import { rateLimit } from "@/lib/security/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";

  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  return authorization.slice(7).trim() || null;
}

function hasCookieBackedAuthSession(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";

  return cookieHeader
    .split(";")
    .map((entry) => entry.trim().split("=", 1)[0] ?? "")
    .some((name) => name.startsWith("sb-") && name.includes("auth-token"));
}

async function refreshCookieBackedSession(request: Request) {
  if (!hasCookieBackedAuthSession(request)) {
    return {
      attempted: false,
      refreshed: false,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.refreshSession();
  const refreshedUser = data.user ?? data.session?.user ?? null;

  if (error || !data.session?.access_token || !refreshedUser) {
    throw new Error(
      "O aceite foi registrado, mas a sessão do navegador não pôde ser renovada. Faça login novamente para continuar."
    );
  }

  const refreshedState = readTermsComplianceFromMetadata(
    refreshedUser.app_metadata as Record<string, unknown> | undefined
  );

  if (!hasAcceptedCurrentTerms(refreshedState)) {
    throw new Error(
      "O aceite foi registrado, mas o novo token ainda não contém a versão contratual atual."
    );
  }

  return {
    attempted: true,
    refreshed: true,
  };
}

async function resolveAuthenticatedUser(request: Request) {
  const bearerToken = getBearerToken(request);

  if (bearerToken) {
    const { supabaseUrl, supabaseKey } = getRequiredSupabasePublicEnv();
    const tokenClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
      error,
    } = await tokenClient.auth.getUser(bearerToken);

    if (!error && user) {
      return {
        user,
        accessToken: bearerToken,
      };
    }
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (error || !user) {
    return {
      user: null,
      accessToken: null,
    };
  }

  return {
    user,
    accessToken: session?.access_token ?? null,
  };
}

export async function GET(request: Request) {
  try {
    const { user } = await resolveAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 }
      );
    }

    const sessionState = readTermsComplianceFromMetadata(
      user.app_metadata as Record<string, unknown> | undefined
    );
    const state = hasAcceptedCurrentTerms(sessionState)
      ? sessionState
      : await getUserTermsComplianceState(user.id);
    const acceptedCurrentTerms = hasAcceptedCurrentTerms(state);
    const sessionRefresh =
      acceptedCurrentTerms && !hasAcceptedCurrentTerms(sessionState)
        ? await refreshCookieBackedSession(request)
        : { attempted: false, refreshed: false };

    return NextResponse.json(
      {
        authenticated: true,
        acceptedCurrentTerms,
        sessionRefreshAttempted: sessionRefresh.attempted,
        sessionRefreshed: sessionRefresh.refreshed,
        currentTermsTitle: CURRENT_TERMS_DOCUMENT_TITLE,
        currentTermsVersion: CURRENT_TERMS_DOCUMENT_VERSION,
        currentTermsUpdatedAt: CURRENT_TERMS_UPDATED_AT,
        acceptedAt: state?.current_terms_accepted_at ?? null,
        firstAccessAt: state?.first_access_at ?? null,
        lastAccessAt: state?.last_access_at ?? null,
        firstLoginAt: state?.first_login_at ?? null,
        lastLoginAt: state?.last_login_at ?? null,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Erro em GET /api/auth/compliance:", error);

    return NextResponse.json(
      { error: error?.message ?? "Erro inesperado." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const limited = rateLimit(request, {
      key: "auth-compliance-accept",
      limit: 20,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const { user, accessToken } = await resolveAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const acceptTerms = Boolean(body?.acceptTerms);
    const source =
      typeof body?.source === "string" && body.source.trim()
        ? body.source.trim()
        : "login";
    const path =
      typeof body?.path === "string" && body.path.trim()
        ? body.path.trim()
        : "/login";
    const redirectPath =
      typeof body?.redirectPath === "string" && body.redirectPath.trim()
        ? body.redirectPath.trim()
        : null;

    if (!acceptTerms) {
      return NextResponse.json(
        { error: "O aceite dos termos é obrigatório para continuar." },
        { status: 400 }
      );
    }

    const sessionState = readTermsComplianceFromMetadata(
      user.app_metadata as Record<string, unknown> | undefined
    );

    if (hasAcceptedCurrentTerms(sessionState)) {
      return NextResponse.json(
        {
          ok: true,
          skipped: true,
          sessionRefreshAttempted: false,
          sessionRefreshed: false,
          acceptedAt: sessionState?.current_terms_accepted_at ?? null,
          currentTermsTitle: CURRENT_TERMS_DOCUMENT_TITLE,
          currentTermsVersion: CURRENT_TERMS_DOCUMENT_VERSION,
          currentTermsUpdatedAt: CURRENT_TERMS_UPDATED_AT,
        },
        { status: 200 }
      );
    }

    const result = await recordTermsAcceptanceForCurrentUser({
      userId: user.id,
      path,
      source,
      redirectPath,
      accessToken,
      headersOverride: request.headers,
    });
    const sessionRefresh = await refreshCookieBackedSession(request);

    return NextResponse.json(
      {
        ok: true,
        sessionRefreshAttempted: sessionRefresh.attempted,
        sessionRefreshed: sessionRefresh.refreshed,
        acceptedAt: result.current_terms_accepted_at ?? null,
        currentTermsTitle: CURRENT_TERMS_DOCUMENT_TITLE,
        currentTermsVersion: CURRENT_TERMS_DOCUMENT_VERSION,
        currentTermsUpdatedAt: CURRENT_TERMS_UPDATED_AT,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Erro em POST /api/auth/compliance:", error);

    return NextResponse.json(
      { error: error?.message ?? "Erro inesperado." },
      { status: 500 }
    );
  }
}
