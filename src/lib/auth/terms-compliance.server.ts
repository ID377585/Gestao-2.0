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

const ACCESS_EVENT_THROTTLE_MS = 15 * 60 * 1000;

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

function toIsoString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function isLoginSource(source: string) {
  return source.includes("login");
}

async function getTelemetry(params?: {
  headersOverride?: Headers;
  accessToken?: string | null;
  path?: string | null;
}): Promise<RequestTelemetry> {
  const currentHeaders = params?.headersOverride ?? headers();
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

async function getAuthAdminUser(userId: string): Promise<AuthAdminUser | null> {
  const supabaseAdmin = getSupabaseAdminClient();
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);

  if (error) {
    throw new Error(error.message || "Falha ao buscar usuário no Auth.");
  }

  if (!data?.user) {
    return null;
  }

  return {
    id: data.user.id,
    app_metadata: (data.user.app_metadata as Record<string, unknown> | undefined) ?? {},
  };
}

async function getPrimaryEstablishmentId(userId: string) {
  const supabaseAdmin = getSupabaseAdminClient();

  const { data: membership } = await supabaseAdmin
    .from("memberships")
    .select("establishment_id, created_at")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (membership?.establishment_id) {
    return String(membership.establishment_id);
  }

  const { data: legacyMembership } = await supabaseAdmin
    .from("establishment_memberships")
    .select("establishment_id, created_at")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return legacyMembership?.establishment_id
    ? String(legacyMembership.establishment_id)
    : null;
}

async function updateUserComplianceMetadata(params: {
  userId: string;
  appMetadata: Record<string, unknown>;
  complianceState: TermsComplianceState;
}) {
  const supabaseAdmin = getSupabaseAdminClient();
  const nextAppMetadata = {
    ...params.appMetadata,
    [TERMS_COMPLIANCE_METADATA_KEY]: params.complianceState,
  };

  const { error } = await supabaseAdmin.auth.admin.updateUserById(params.userId, {
    app_metadata: nextAppMetadata,
  });

  if (error) {
    throw new Error(
      error.message || "Falha ao atualizar os metadados de compliance do usuário."
    );
  }
}

async function writeAuditLog(params: {
  userId: string;
  action: string;
  details: Record<string, unknown>;
  establishmentId?: string | null;
}) {
  try {
    const establishmentId =
      params.establishmentId ?? (await getPrimaryEstablishmentId(params.userId));

    if (!establishmentId) {
      return;
    }

    const supabaseAdmin = getSupabaseAdminClient();
    const { error } = await supabaseAdmin.from("user_access_audit_logs").insert({
      establishment_id: establishmentId,
      actor_user_id: params.userId,
      target_user_id: params.userId,
      action: params.action,
      details: params.details,
    });

    if (error) {
      console.error("Falha ao gravar log de auditoria de compliance:", error);
    }
  } catch (error) {
    console.error("Falha inesperada ao gravar auditoria de compliance:", error);
  }
}

export async function getUserTermsComplianceState(userId: string) {
  const authUser = await getAuthAdminUser(userId);

  if (!authUser) {
    return null;
  }

  return readTermsComplianceFromMetadata(authUser.app_metadata);
}

export async function ensureCurrentTermsAcceptedOrRedirect(params: {
  userId: string;
  redirectPath: string;
  loginPath?: string;
}) {
  const state = await getUserTermsComplianceState(params.userId);

  if (hasAcceptedCurrentTerms(state)) {
    return state;
  }

  const loginPath = params.loginPath ?? "/login";
  const nextUrl = new URL(loginPath, "http://localhost");
  nextUrl.searchParams.set("redirect", params.redirectPath);
  nextUrl.searchParams.set("terms", "required");

  redirect(`${nextUrl.pathname}${nextUrl.search}`);
}

export async function recordTermsAcceptanceForCurrentUser(
  params: RecordTermsAcceptanceParams
) {
  const authUser = await getAuthAdminUser(params.userId);

  if (!authUser) {
    throw new Error("Usuário não encontrado no Auth.");
  }

  const existingState = readTermsComplianceFromMetadata(authUser.app_metadata);
  const telemetry = await getTelemetry({
    headersOverride: params.headersOverride,
    accessToken: params.accessToken,
    path: params.path ?? null,
  });
  const now = new Date().toISOString();
  const alreadyAcceptedCurrentTerms = hasAcceptedCurrentTerms(existingState);

  const nextState: TermsComplianceState = {
    current_terms_slug: CURRENT_TERMS_DOCUMENT_SLUG,
    current_terms_title: CURRENT_TERMS_DOCUMENT_TITLE,
    current_terms_version: CURRENT_TERMS_VERSION_ID,
    current_terms_accepted_at: now,
    first_login_at: existingState?.first_login_at ?? now,
    last_login_at: isLoginSource(params.source)
      ? now
      : existingState?.last_login_at ?? null,
    first_access_at: existingState?.first_access_at ?? now,
    last_access_at: now,
    last_access_path: telemetry.path,
    last_compliance_event_at: now,
  };

  await updateUserComplianceMetadata({
    userId: params.userId,
    appMetadata: authUser.app_metadata ?? {},
    complianceState: nextState,
  });

  const auditBase = {
    kind: "security_compliance",
    document_slug: CURRENT_TERMS_DOCUMENT_SLUG,
    document_title: CURRENT_TERMS_DOCUMENT_TITLE,
    document_version: CURRENT_TERMS_VERSION_ID,
    accepted_at: now,
    source: params.source,
    path: telemetry.path,
    redirect_path: params.redirectPath ?? null,
    ip_address: telemetry.ipAddress,
    user_agent: telemetry.userAgent,
    auth_session_id: telemetry.authSessionId,
  };

  await writeAuditLog({
    userId: params.userId,
    action: alreadyAcceptedCurrentTerms ? "terms_reaccepted" : "terms_accepted",
    details: auditBase,
  });

  if (isLoginSource(params.source)) {
    await writeAuditLog({
      userId: params.userId,
      action: "login_success",
      details: {
        ...auditBase,
        first_login_at: nextState.first_login_at,
        last_login_at: nextState.last_login_at,
      },
    });
  }

  return {
    acceptedAt: now,
    documentSlug: CURRENT_TERMS_DOCUMENT_SLUG,
    documentTitle: CURRENT_TERMS_DOCUMENT_TITLE,
    documentVersion: CURRENT_TERMS_VERSION_ID,
    alreadyAcceptedCurrentTerms,
  };
}

export async function touchUserAuthenticatedAccess(
  params: TouchUserAccessParams
) {
  const authUser = await getAuthAdminUser(params.userId);

  if (!authUser) {
    throw new Error("Usuário não encontrado no Auth.");
  }

  const existingState = readTermsComplianceFromMetadata(authUser.app_metadata);
  const telemetry = await getTelemetry({
    headersOverride: params.headersOverride,
    path: params.path ?? null,
  });
  const now = new Date().toISOString();
  const lastAccessAt = existingState?.last_access_at
    ? new Date(existingState.last_access_at).getTime()
    : null;
  const shouldWriteAccessEvent =
    !lastAccessAt || Date.now() - lastAccessAt >= ACCESS_EVENT_THROTTLE_MS;

  const nextState: TermsComplianceState = {
    current_terms_slug:
      existingState?.current_terms_slug ?? CURRENT_TERMS_DOCUMENT_SLUG,
    current_terms_title:
      existingState?.current_terms_title ?? CURRENT_TERMS_DOCUMENT_TITLE,
    current_terms_version: existingState?.current_terms_version ?? null,
    current_terms_accepted_at: toIsoString(existingState?.current_terms_accepted_at),
    first_login_at: toIsoString(existingState?.first_login_at),
    last_login_at: toIsoString(existingState?.last_login_at),
    first_access_at: existingState?.first_access_at ?? now,
    last_access_at: now,
    last_access_path: telemetry.path,
    last_compliance_event_at: shouldWriteAccessEvent
      ? now
      : existingState?.last_compliance_event_at ?? null,
  };

  await updateUserComplianceMetadata({
    userId: params.userId,
    appMetadata: authUser.app_metadata ?? {},
    complianceState: nextState,
  });

  if (!shouldWriteAccessEvent) {
    return;
  }

  await writeAuditLog({
    userId: params.userId,
    action: "protected_access",
    details: {
      kind: "security_compliance",
      path: telemetry.path,
      accessed_at: now,
      ip_address: telemetry.ipAddress,
      user_agent: telemetry.userAgent,
      auth_session_id: telemetry.authSessionId,
      document_version: existingState?.current_terms_version ?? null,
    },
  });
}
