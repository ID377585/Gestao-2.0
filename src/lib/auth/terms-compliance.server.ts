import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  CURRENT_TERMS_DOCUMENT_SLUG,
  CURRENT_TERMS_DOCUMENT_TITLE,
  CURRENT_TERMS_VERSION_ID,
  hasAcceptedCurrentTerms,
  type TermsComplianceState,
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
  accessToken?: string | null;
  headersOverride?: Headers;
};

type TermsAcceptanceRow = {
  document_slug: string | null;
  document_title: string | null;
  terms_version_id: string;
  accepted_at: string;
  accepted_from_path: string | null;
};

type AccessLogRow = {
  path: string | null;
  created_at: string;
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

async function getTelemetry(params?: {
  headersOverride?: Headers;
  accessToken?: string | null;
  path?: string | null;
}): Promise<RequestTelemetry> {
  const currentHeaders = params?.headersOverride ?? (await headers());
  let accessToken = params?.accessToken ?? null;

  if (!accessToken) {
    const supabase = await createSupabaseServerClient();
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

async function getPrimaryEstablishmentId(userId: string) {
  const supabaseAdmin = getSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("memberships")
    .select("establishment_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Falha ao resolver estabelecimento do usuario.");
  }

  return data?.establishment_id ?? null;
}

async function getLatestAccessLog(userId: string, ascending: boolean) {
  const supabaseAdmin = getSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("user_access_logs")
    .select("path, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Falha ao consultar auditoria de acesso.");
  }

  return (data as AccessLogRow | null) ?? null;
}

export async function getUserTermsComplianceState(
  userId: string
): Promise<TermsComplianceState> {
  const supabaseAdmin = getSupabaseAdminClient();

  const [{ data: acceptance, error: acceptanceError }, firstAccess, lastAccess] =
    await Promise.all([
      supabaseAdmin
        .from("user_terms_acceptances")
        .select(
          "document_slug, document_title, terms_version_id, accepted_at, accepted_from_path"
        )
        .eq("user_id", userId)
        .eq("terms_version_id", CURRENT_TERMS_VERSION_ID)
        .maybeSingle(),
      getLatestAccessLog(userId, true),
      getLatestAccessLog(userId, false),
    ]);

  if (acceptanceError) {
    throw new Error(
      acceptanceError.message || "Falha ao consultar aceite dos termos."
    );
  }

  const accepted = (acceptance as TermsAcceptanceRow | null) ?? null;
  const lastComplianceEventAt = [accepted?.accepted_at, lastAccess?.created_at]
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null;

  return {
    current_terms_slug: accepted?.document_slug ?? null,
    current_terms_title: accepted?.document_title ?? null,
    current_terms_version: accepted?.terms_version_id ?? null,
    current_terms_accepted_at: accepted?.accepted_at ?? null,
    first_access_at: firstAccess?.created_at ?? null,
    last_access_at: lastAccess?.created_at ?? null,
    first_login_at: null,
    last_login_at: null,
    last_access_path:
      lastAccess?.path ?? accepted?.accepted_from_path ?? null,
    last_compliance_event_at: lastComplianceEventAt,
  };
}

export async function recordTermsAcceptance(
  params: RecordTermsAcceptanceParams
): Promise<TermsComplianceState> {
  const previousState = await getUserTermsComplianceState(params.userId);

  if (hasAcceptedCurrentTerms(previousState)) {
    return previousState;
  }

  const telemetry = await getTelemetry(params);
  const acceptedAt = new Date().toISOString();
  const primaryEstablishmentId = await getPrimaryEstablishmentId(params.userId);
  const supabaseAdmin = getSupabaseAdminClient();

  const { error } = await supabaseAdmin.from("user_terms_acceptances").insert({
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

  if (error && error.code !== "23505") {
    throw new Error(error.message || "Falha ao registrar aceite dos termos.");
  }

  return getUserTermsComplianceState(params.userId);
}

export async function recordTermsAcceptanceForCurrentUser(
  params: RecordTermsAcceptanceParams
) {
  return recordTermsAcceptance(params);
}

export async function touchUserAccess(params: TouchUserAccessParams) {
  const telemetry = await getTelemetry(params);
  const primaryEstablishmentId = await getPrimaryEstablishmentId(params.userId);
  const supabaseAdmin = getSupabaseAdminClient();

  const { error } = await supabaseAdmin.from("user_access_logs").insert({
    user_id: params.userId,
    establishment_id: primaryEstablishmentId,
    path: params.path ?? null,
    ip_address: telemetry.ipAddress,
    user_agent: telemetry.userAgent,
    auth_session_id: telemetry.authSessionId,
  });

  if (error) {
    throw new Error(error.message || "Falha ao registrar auditoria de acesso.");
  }
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
  const compliance = await getUserTermsComplianceState(params.userId);

  if (hasAcceptedCurrentTerms(compliance)) {
    return compliance;
  }

  const loginPath = params.loginPath ?? "/login";
  const separator = loginPath.includes("?") ? "&" : "?";
  redirect(
    `${loginPath}${separator}terms=required&redirect=${encodeURIComponent(
      params.redirectPath
    )}`
  );
}

export { CURRENT_TERMS_VERSION_ID };
