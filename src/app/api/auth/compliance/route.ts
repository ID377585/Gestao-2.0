import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import {
  CURRENT_TERMS_DOCUMENT_TITLE,
  CURRENT_TERMS_DOCUMENT_VERSION,
  CURRENT_TERMS_UPDATED_AT,
  hasAcceptedCurrentTerms,
} from "@/lib/auth/terms-config";
import {
  getUserTermsComplianceState,
  recordTermsAcceptanceForCurrentUser,
} from "@/lib/auth/terms-compliance.server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";

  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  return authorization.slice(7).trim() || null;
}

async function resolveAuthenticatedUser(request: Request) {
  const bearerToken = getBearerToken(request);

  if (bearerToken) {
    const tokenClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

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

  const supabase = createSupabaseServerClient();
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

    const state = await getUserTermsComplianceState(user.id);

    return NextResponse.json(
      {
        authenticated: true,
        acceptedCurrentTerms: hasAcceptedCurrentTerms(state),
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
      typeof body?.path === "string" && body.path.trim() ? body.path.trim() : "/login";
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

    const result = await recordTermsAcceptanceForCurrentUser({
      userId: user.id,
      path,
      source,
      redirectPath,
      accessToken,
      headersOverride: request.headers,
    });

    return NextResponse.json(
      {
        ok: true,
        acceptedAt: result.acceptedAt,
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
