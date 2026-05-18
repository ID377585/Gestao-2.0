import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  CURRENT_TERMS_DOCUMENT_SLUG,
  CURRENT_TERMS_DOCUMENT_TITLE,
  CURRENT_TERMS_VERSION_ID,
  hasAcceptedCurrentTerms,
  readTermsComplianceFromMetadata,
  type TermsComplianceState,
  TERMS_COMPLIANCE_METADATA_KEY,
} from "@/lib/auth/terms-config";
import {
  createSupabaseServerClient,
  getSupabaseAdminClient,
} from "@/lib/supabase/server";

type RequestTelemetry = {
  ipAddress: string | null;
  userAgent: string | null;
  path: string | null;
  authSessionId: string | null;
};

type RecordTermsAcceptanceParams = {
  userId: string;
  path?: string | null;
  source: string;
  redirectPath?: string | null;
  accessToken?: string | null;
  headersOverride?: Headers;
};

type TouchUserAccessParams = {
  userId: string;
  path?: string | null;
  headersOverride?: Headers;
};

type AuthAdminUser = {
  id: string;
  app_metadata?: Record<string, unknown>;
};

function getHeader(headersList: Headers, key: string) {
  return headersList.get(key)?.trim() || null;
}

function normalizeIpAddress(rawValue: string | null) {
  if (!rawValue) return null;

  const firstValue = rawValue.split(",")[0]?.trim() || "";
  if (!firstValue) return null;

  if (firstValue === "::1") return "127.0.0.1";

  return firstValue;
}

function decodeJwtPayload(accessToken: string | null | undefined) {
  if (!accessToken) return null;

  const [, payload] = accessToken.split(".");
  if (!payload) return null;

  try {
    const decoded = Buffer.from(payload, "base64url").toString("utf8");
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractSessionId(accessToken: string | null | undefined) {
  const payload = decodeJwtPayload(accessToken);
  const sessionId = payload?.session_id;

  return typeof sessionId === "string" && sessionId.trim()
    ? sessionId.trim()
    : null;
}

function isLoginSource(source: string) {
  return source.includes("login");
}

async function getTelemetry(params?: {
  headersOverride?: Headers;
  accessToken?: string | null;
  path?: string | null;
}): Promise<RequestTelemetry> {
  const currentHeaders = params?.headersOverride ?? (await headers());
  let accessToken = params?.accessToken ?? null;

  if (!accessToken) {
    const supabase = createSupabaseServerClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    accessToken = session?.access_token ?? null;
  }

  return {
    ipAddress: normalizeIpAddress(
      getHeader(currentHeaders, "x-forwarded-for") ||
        getHeader(currentHeaders, "x-real-ip")
    ),
    userAgent: getHeader(currentHeaders, "user-agent"),
    path: params?.path ?? null,
    authSessionId: extractSessionId(accessToken),
  };
}

async function getAuthAdminUser(
  userId: string,
  fallbackAppMetadata?: Record<string, unknown> | null
): Promise<AuthAdminUser | null> {
  try {
    const supabaseAdmin = getSupabaseAdminClient();
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (error) {
      throw new Error(error.message || "Falha ao buscar usuario no Auth.");
    }

    if (!data?.user) {
      return null;
    }

    return {
      id: data.user.id,
      app_metadata:
        (data.user.app_metadata as Record<string, unknown> | undefined) ?? {},
    };
  } catch (error) {
    if (fallbackAppMetadata !== undefined) {
      console.error(
        "Falha ao buscar usuario via Supabase Admin; usando app_metadata da sessao como fallback:",
        error
      );
      return {
        id: userId,
        app_metadata: fallbackAppMetadata ?? {},
      };
    }

    throw error;
  }
}

async function getPrimaryEstablishmentId(userId: string) {
  const supabaseAdmin = getSupabaseAdminClient();
  const { data } = await supabaseAdmin
    .from("memberships")
    .select("establishment_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.establishment_id ?? null;
}

export async function getUserTermsComplianceState(userId: string) {
  const authUser = await getAuthAdminUser(userId);
  return readTermsComplianceFromMetadata(authUser?.app_metadata);
}

export async function recordTermsAcceptance(
  params: RecordTermsAcceptanceParams
): Promise<TermsComplianceState> {
  const telemetry = await getTelemetry(params);
  const acceptedAt = new Date().toISOString();
  const primaryEstablishmentId = await getPrimaryEstablishmentId(params.userId);
  const previousState = await getUserTermsComplianceState(params.userId);

  const nextState: TermsComplianceState = {
    ...previousState,
    current_terms_slug: CURRENT_TERMS_DOCUMENT_SLUG,
    current_terms_title: CURRENT_TERMS_DOCUMENT_TITLE,
    current_terms_version: CURRENT_TERMS_VERSION_ID,
    current_terms_accepted_at: acceptedAt,
    first_access_at: previousState?.first_access_at ?? acceptedAt,
    last_access_at: acceptedAt,
    first_login_at: previousState?.first_login_at ?? (isLoginSource(params.source) ? acceptedAt : null),
    last_login_at: isLoginSource(params.source) ? acceptedAt : previousState?.last_login_at ?? null,
    last_access_path: params.path ?? params.redirectPath ?? previousState?.last_access_path ?? null,
    last_compliance_event_at: acceptedAt,
  };

  const supabaseAdmin = getSupabaseAdminClient();

  await supabaseAdmin.auth.admin.updateUserById(params.userId, {
    app_metadata: {
      [TERMS_COMPLIANCE_METADATA_KEY]: nextState,
      current_establishment_id: primaryEstablishmentId,
    },
  });

  await supabaseAdmin.from("user_terms_acceptances").insert({
    user_id: params.userId,
    terms_version_id: CURRENT_TERMS_VERSION_ID,
    document_slug: CURRENT_TERMS_DOCUMENT_SLUG,
    document_title: CURRENT_TERMS_DOCUMENT_TITLE,
    accepted_at: acceptedAt,
    accepted_from_path: params.path ?? params.redirectPath ?? null,
    accepted_source: params.source,
    ip_address: telemetry.ipAddress,
    user_agent: telemetry.userAgent,
    auth_session_id: telemetry.authSessionId,
    establishment_id: primaryEstablishmentId,
  });

  return nextState;
}

export async function recordTermsAcceptanceForCurrentUser(
  params: RecordTermsAcceptanceParams
) {
  return recordTermsAcceptance(params);
}

export async function touchUserAccess(params: TouchUserAccessParams) {
  const telemetry = await getTelemetry(params);
  const now = new Date().toISOString();
  const supabaseAdmin = getSupabaseAdminClient();
  const previousState = await getUserTermsComplianceState(params.userId);

  await supabaseAdmin.from("user_access_logs").insert({
    user_id: params.userId,
    path: params.path ?? null,
    ip_address: telemetry.ipAddress,
    user_agent: telemetry.userAgent,
    auth_session_id: telemetry.authSessionId,
  });

  await supabaseAdmin.auth.admin.updateUserById(params.userId, {
    app_metadata: {
      [TERMS_COMPLIANCE_METADATA_KEY]: {
        ...previousState,
        first_access_at: previousState?.first_access_at ?? now,
        last_access_at: now,
        last_access_path: params.path ?? previousState?.last_access_path ?? null,
        last_compliance_event_at: now,
      },
    },
  });
}

export async function touchUserAuthenticatedAccess(params: TouchUserAccessParams) {
  return touchUserAccess(params);
}

export async function ensureCurrentTermsAcceptedOrRedirect(params: {
  userId: string;
  redirectPath: string;
  loginPath?: string;
  appMetadata?: Record<string, unknown> | null;
}) {
  const authUser = await getAuthAdminUser(params.userId, params.appMetadata);
  const compliance = readTermsComplianceFromMetadata(authUser?.app_metadata);

  if (hasAcceptedCurrentTerms(compliance)) {
    return compliance;
  }

  const source = isLoginSource(params.redirectPath) ? "login" : "guard";
  const next = await recordTermsAcceptance({
    userId: params.userId,
    path: params.redirectPath,
    source,
    redirectPath: params.loginPath ?? "/login",
  });

  if (!hasAcceptedCurrentTerms(next)) {
    redirect(params.loginPath ?? "/login");
  }

  return next;
}

export { CURRENT_TERMS_VERSION_ID };
