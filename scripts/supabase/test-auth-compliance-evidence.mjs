import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const TENANT_COOKIE_NAME = "gestify_current_establishment_id";
const CURRENT_TERMS_VERSION_ID = "saas-v1.3-2026-04-23";
const DASHBOARD_PATH = "/dashboard/perdas";

function requiredEnv(name, fallbacks = []) {
  for (const candidate of [name, ...fallbacks]) {
    const value = process.env[candidate];
    if (value) return value;
  }

  throw new Error(
    `Variável obrigatória ausente: ${[name, ...fallbacks].join(" ou ")}`
  );
}

const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL", ["SUPABASE_URL"]);
const publicKey = requiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", [
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_ANON_KEY",
]);
const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
const appUrl = new URL(process.env.GESTIFY_APP_URL ?? "http://127.0.0.1:3010");
const reportFile =
  process.env.GESTIFY_AUTH_COMPLIANCE_REPORT_FILE ??
  ".artifacts/supabase-migration-smoke/auth-compliance-evidence-report.json";

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function formatError(error) {
  if (!error) return "erro desconhecido";

  return [error.message, error.code, error.details, error.hint]
    .filter(Boolean)
    .join(" | ");
}

async function insertRows(table, rows) {
  const { error } = await admin.from(table).insert(rows);
  if (error) {
    throw new Error(`Falha ao preparar ${table}: ${formatError(error)}`);
  }
}

async function upsertRows(table, rows, onConflict) {
  const { error } = await admin.from(table).upsert(rows, { onConflict });
  if (error) {
    throw new Error(`Falha ao preparar ${table}: ${formatError(error)}`);
  }
}

function buildCookieClient(cookieJar) {
  return createServerClient(supabaseUrl, publicKey, {
    cookies: {
      getAll() {
        return Array.from(cookieJar, ([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          if (cookie.options?.maxAge === 0 || !cookie.value) {
            cookieJar.delete(cookie.name);
          } else {
            cookieJar.set(cookie.name, cookie.value);
          }
        }
      },
    },
    auth: {
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function createCookieSession() {
  const cookieJar = new Map();

  return {
    cookieJar,
    client() {
      return buildCookieClient(cookieJar);
    },
    setTenant(establishmentId) {
      cookieJar.set(TENANT_COOKIE_NAME, establishmentId);
    },
    cookieHeader() {
      return Array.from(cookieJar, ([name, value]) => `${name}=${value}`).join(
        "; "
      );
    },
    absorbSetCookies(response) {
      const getSetCookie = response.headers.getSetCookie;
      const serializedCookies =
        typeof getSetCookie === "function"
          ? getSetCookie.call(response.headers)
          : [response.headers.get("set-cookie")].filter(Boolean);

      for (const serializedCookie of serializedCookies) {
        const parts = String(serializedCookie)
          .split(";")
          .map((part) => part.trim());
        const firstPart = parts[0] ?? "";
        const separatorIndex = firstPart.indexOf("=");

        if (separatorIndex <= 0) continue;

        const name = firstPart.slice(0, separatorIndex);
        const value = firstPart.slice(separatorIndex + 1);
        const mustDelete =
          !value ||
          parts.some((part) => /^max-age=0$/i.test(part)) ||
          parts.some((part) => /^expires=thu, 01 jan 1970/i.test(part));

        if (mustDelete) {
          cookieJar.delete(name);
        } else {
          cookieJar.set(name, value);
        }
      }

      return serializedCookies.length;
    },
  };
}

async function appRequest(path, options = {}) {
  const response = await fetch(new URL(path, appUrl), options);
  const text = await response.text();
  let body = null;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
  }

  return { response, body };
}

async function postCompliance(payload, accessToken, cookieHeader) {
  return appRequest("/api/auth/compliance", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Cookie: cookieHeader,
      "Content-Type": "application/json",
      "User-Agent": "gestify-auth-compliance-smoke/1.0",
      "X-Forwarded-For": "127.0.0.1",
    },
    body: JSON.stringify(payload),
  });
}

function readComplianceState(user) {
  const state = user?.app_metadata?.gestify_compliance;
  return state && typeof state === "object" ? state : null;
}

async function main() {
  const suffix = randomUUID().slice(0, 8);
  const password = `Gestify-Compliance-${suffix}-A9!`;
  const establishmentId = randomUUID();
  const email = `gestify-compliance-${suffix}@example.test`;

  const { data: userData, error: createUserError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Gestify Compliance Smoke" },
      app_metadata: { role: "estoque" },
    });

  if (createUserError || !userData.user) {
    throw new Error(
      `Falha ao criar usuário de conformidade: ${formatError(createUserError)}`
    );
  }

  const userId = userData.user.id;

  await insertRows("establishments", [
    {
      id: establishmentId,
      name: "Gestify Compliance Tenant",
      is_active: true,
    },
  ]);

  await upsertRows(
    "profiles",
    [
      {
        id: userId,
        full_name: "Gestify Compliance Smoke",
        role: "estoque",
      },
    ],
    "id"
  );

  await insertRows("memberships", [
    {
      user_id: userId,
      establishment_id: establishmentId,
      role: "estoque",
      is_active: true,
    },
  ]);

  await insertRows("establishment_memberships", [
    {
      user_id: userId,
      establishment_id: establishmentId,
      role: "estoque",
      is_active: true,
    },
  ]);

  await insertRows("user_module_permissions", [
    {
      establishment_id: establishmentId,
      user_id: userId,
      module_key: "estoque",
      can_access: true,
    },
  ]);

  const contractBefore = await admin.rpc("gestify_auth_compliance_audit");
  assert(
    !contractBefore.error && contractBefore.data?.ok === true,
    `Contrato de conformidade inválido antes do teste: ${formatError(
      contractBefore.error
    )} ${JSON.stringify(contractBefore.data)}`
  );

  const browserSession = createCookieSession();
  const initialClient = browserSession.client();
  const { data: signInData, error: signInError } =
    await initialClient.auth.signInWithPassword({ email, password });

  if (
    signInError ||
    !signInData.session?.access_token ||
    !signInData.user
  ) {
    throw new Error(`Falha ao autenticar fixture: ${formatError(signInError)}`);
  }

  const initialAccessToken = signInData.session.access_token;
  browserSession.setTenant(establishmentId);

  const acceptancePayload = {
    acceptTerms: true,
    source: "login_auth_compliance_smoke",
    path: "/login",
    redirectPath: DASHBOARD_PATH,
  };

  const firstAcceptance = await postCompliance(
    acceptancePayload,
    initialAccessToken,
    browserSession.cookieHeader()
  );
  assert(
    firstAcceptance.response.status === 200 && firstAcceptance.body?.ok === true,
    `Primeiro aceite falhou: HTTP ${firstAcceptance.response.status} ${JSON.stringify(
      firstAcceptance.body
    )}`
  );
  assert(
    firstAcceptance.body?.sessionRefreshAttempted === true &&
      firstAcceptance.body?.sessionRefreshed === true,
    `API não renovou a sessão baseada em cookie: ${JSON.stringify(
      firstAcceptance.body
    )}`
  );

  const setCookieCount = browserSession.absorbSetCookies(
    firstAcceptance.response
  );
  assert(
    setCookieCount > 0,
    "A renovação da sessão não devolveu cookies atualizados ao navegador."
  );

  const refreshedClient = browserSession.client();
  const { data: refreshedSessionData, error: refreshedSessionError } =
    await refreshedClient.auth.getSession();
  const refreshedSession = refreshedSessionData.session;
  const refreshedCompliance = readComplianceState(refreshedSession?.user);

  assert(
    !refreshedSessionError &&
      refreshedSession?.access_token &&
      refreshedSession.user?.id === userId,
    `Cookies renovados não reconstruíram uma sessão válida: ${formatError(
      refreshedSessionError
    )}`
  );
  assert(
    refreshedSession.access_token !== initialAccessToken,
    "A API declarou renovação, mas manteve o access token antigo."
  );
  assert(
    refreshedCompliance?.current_terms_version === CURRENT_TERMS_VERSION_ID &&
      refreshedCompliance?.current_terms_accepted_at,
    `JWT renovado não contém o aceite atual: ${JSON.stringify(
      refreshedCompliance
    )}`
  );

  const { data: firstEvidence, error: firstEvidenceError } = await admin
    .from("user_terms_acceptances")
    .select(
      "id,user_id,establishment_id,terms_version_id,accepted_at,accepted_source,accepted_from_path,ip_address,user_agent,auth_session_id,evidence_origin,created_at"
    )
    .eq("user_id", userId)
    .eq("terms_version_id", CURRENT_TERMS_VERSION_ID)
    .single();

  assert(
    !firstEvidenceError && firstEvidence,
    `Evidência direta não foi persistida: ${formatError(firstEvidenceError)}`
  );
  assert(
    firstEvidence.establishment_id === establishmentId &&
      firstEvidence.terms_version_id === CURRENT_TERMS_VERSION_ID &&
      firstEvidence.accepted_source === acceptancePayload.source &&
      firstEvidence.accepted_from_path === acceptancePayload.path &&
      firstEvidence.ip_address === "127.0.0.1" &&
      firstEvidence.user_agent === "gestify-auth-compliance-smoke/1.0" &&
      firstEvidence.auth_session_id &&
      firstEvidence.evidence_origin === "direct",
    `Conteúdo da evidência direta está incorreto: ${JSON.stringify(firstEvidence)}`
  );

  const secondAcceptance = await postCompliance(
    acceptancePayload,
    refreshedSession.access_token,
    browserSession.cookieHeader()
  );
  assert(
    secondAcceptance.response.status === 200 &&
      secondAcceptance.body?.ok === true &&
      secondAcceptance.body?.skipped === true,
    `Segundo aceite idempotente falhou: HTTP ${secondAcceptance.response.status} ${JSON.stringify(
      secondAcceptance.body
    )}`
  );

  const { data: repeatedEvidence, error: repeatedEvidenceError } = await admin
    .from("user_terms_acceptances")
    .select("id,accepted_at,evidence_origin")
    .eq("user_id", userId)
    .eq("terms_version_id", CURRENT_TERMS_VERSION_ID);

  assert(
    !repeatedEvidenceError &&
      repeatedEvidence?.length === 1 &&
      repeatedEvidence[0].id === firstEvidence.id &&
      repeatedEvidence[0].accepted_at === firstEvidence.accepted_at &&
      repeatedEvidence[0].evidence_origin === "direct",
    `Aceite repetido alterou ou duplicou a evidência: ${formatError(
      repeatedEvidenceError
    )} ${JSON.stringify(repeatedEvidence)}`
  );

  const directTermsRead = await refreshedClient
    .from("user_terms_acceptances")
    .select("id");
  assert(
    directTermsRead.error,
    "Sessão authenticated conseguiu ler evidência de aceite diretamente."
  );

  const directTermsInsert = await refreshedClient
    .from("user_terms_acceptances")
    .insert({
      user_id: userId,
      terms_version_id: "forged-version",
      document_slug: "/termos-de-uso",
      document_title: "Termos falsos",
      accepted_source: "forged-client",
    });
  assert(
    directTermsInsert.error,
    "Sessão authenticated conseguiu forjar evidência de aceite."
  );

  const serviceMutation = await admin
    .from("user_terms_acceptances")
    .update({ accepted_source: "mutated" })
    .eq("id", firstEvidence.id);
  assert(
    serviceMutation.error,
    "service_role conseguiu alterar uma evidência append-only."
  );

  const dashboardResponse = await fetch(new URL(DASHBOARD_PATH, appUrl), {
    headers: {
      Cookie: browserSession.cookieHeader(),
      "User-Agent": "gestify-auth-compliance-dashboard-smoke/1.0",
      "X-Forwarded-For": "127.0.0.1",
    },
    redirect: "manual",
  });
  const dashboardLocation = dashboardResponse.headers.get("location");
  const dashboardBody = await dashboardResponse.text();

  assert(
    dashboardResponse.status === 200,
    `Middleware não liberou o módulo autorizado após renovar o JWT: HTTP ${
      dashboardResponse.status
    }; location=${dashboardLocation ?? "nenhuma"}; body=${dashboardBody.slice(
      0,
      300
    )}`
  );

  const { data: accessRows, error: accessRowsError } = await admin
    .from("user_access_logs")
    .select(
      "id,user_id,establishment_id,path,ip_address,user_agent,auth_session_id,event_type,created_at"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  assert(
    !accessRowsError && accessRows?.length >= 1,
    `Página autenticada não gerou registro de acesso: ${formatError(
      accessRowsError
    )}`
  );
  assert(
    accessRows.some(
      (row) =>
        row.establishment_id === establishmentId &&
        row.path === "/dashboard" &&
        row.event_type === "authenticated_access"
    ),
    `Registro de acesso não preservou tenant/caminho: ${JSON.stringify(
      accessRows
    )}`
  );

  const directAccessRead = await refreshedClient
    .from("user_access_logs")
    .select("id");
  assert(
    directAccessRead.error,
    "Sessão authenticated conseguiu ler telemetria de acesso diretamente."
  );

  const accessMutation = await admin
    .from("user_access_logs")
    .update({ path: "/mutated" })
    .eq("id", accessRows[0].id);
  assert(
    accessMutation.error,
    "service_role conseguiu alterar telemetria append-only."
  );

  const contractAfter = await admin.rpc("gestify_auth_compliance_audit");
  assert(
    !contractAfter.error &&
      contractAfter.data?.ok === true &&
      Number(contractAfter.data.direct_evidence_rows ?? 0) >= 1,
    `Contrato de conformidade inválido após evidência: ${formatError(
      contractAfter.error
    )} ${JSON.stringify(contractAfter.data)}`
  );

  const report = {
    format: "gestify-auth-compliance-evidence-smoke-v2",
    ok: true,
    commit: process.env.GITHUB_SHA ?? null,
    ref: process.env.GITHUB_REF_NAME ?? null,
    contractVersion: contractAfter.data.contract_version,
    directEvidenceValidated: true,
    evidenceIdempotencyValidated: true,
    authenticatedReadDenied: true,
    authenticatedForgeryDenied: true,
    serviceRoleMutationDenied: true,
    cookieSessionRefreshValidated: true,
    jwtClaimsRefreshValidated: true,
    middlewareTermsGateValidated: true,
    authorizedModuleGateValidated: true,
    dashboardAccessTelemetryValidated: true,
    accessTelemetryReadDenied: true,
    accessTelemetryMutationDenied: true,
    termsEvidenceRows: repeatedEvidence.length,
    accessTelemetryRows: accessRows.length,
    generatedAt: new Date().toISOString(),
  };

  writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
}

await main();
