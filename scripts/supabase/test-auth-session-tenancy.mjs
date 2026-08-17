import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const TENANT_COOKIE_NAME = "gestify_current_establishment_id";

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
  process.env.GESTIFY_AUTH_SESSION_REPORT_FILE ??
  ".artifacts/supabase-migration-smoke/auth-session-tenancy-report.json";

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

async function countRows(table, filters = {}) {
  let query = admin.from(table).select("*", { count: "exact", head: true });

  for (const [column, value] of Object.entries(filters)) {
    query = query.eq(column, value);
  }

  const { count, error } = await query;
  if (error) {
    throw new Error(`Falha ao contar ${table}: ${formatError(error)}`);
  }

  return count ?? 0;
}

function createCookieAuthenticatedClient() {
  const cookieJar = new Map();

  const client = createServerClient(supabaseUrl, publicKey, {
    cookies: {
      getAll() {
        return Array.from(cookieJar, ([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          if (cookie.options?.maxAge === 0) {
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

  return {
    client,
    cookieJar,
    setTenant(establishmentId) {
      cookieJar.set(TENANT_COOKIE_NAME, establishmentId);
    },
    cookieHeader() {
      return Array.from(cookieJar, ([name, value]) => `${name}=${value}`).join(
        "; "
      );
    },
    authCookieCount() {
      return Array.from(cookieJar.keys()).filter((name) => name !== TENANT_COOKIE_NAME)
        .length;
    },
  };
}

async function signIn(email, password, establishmentId) {
  const session = createCookieAuthenticatedClient();
  const { data, error } = await session.client.auth.signInWithPassword({
    email,
    password,
  });

  if (
    error ||
    !data.session?.access_token ||
    !data.session?.refresh_token ||
    !data.user
  ) {
    throw new Error(`Falha ao autenticar fixture: ${formatError(error)}`);
  }

  session.setTenant(establishmentId);
  assert(session.authCookieCount() > 0, "Login não gerou cookies SSR de autenticação.");

  return {
    ...session,
    user: data.user,
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
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

async function getCompliance(options = {}) {
  return appRequest("/api/auth/compliance", {
    method: "GET",
    headers: options.headers ?? {},
  });
}

async function postCompliance(payload, options = {}) {
  return appRequest("/api/auth/compliance", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    body: JSON.stringify(payload),
  });
}

async function getLosses(session) {
  return appRequest("/api/losses?limit=20", {
    headers: { Cookie: session.cookieHeader() },
  });
}

async function createFixtureUser({ email, password, fullName, role }) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
    app_metadata: { role },
  });

  if (error || !data.user) {
    throw new Error(`Falha ao criar usuário de teste: ${formatError(error)}`);
  }

  return data.user;
}

async function assertRefreshTokenRevoked(refreshToken, message) {
  const verifier = createClient(supabaseUrl, publicKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await verifier.auth.refreshSession({
    refresh_token: refreshToken,
  });

  assert(error || !data.session, `${message}: refresh token ainda foi aceito.`);
}

function assertLossTenant(result, expectedEstablishmentId, message) {
  assert(
    result.response.status === 200 && Array.isArray(result.body?.losses),
    `${message}: HTTP ${result.response.status} ${JSON.stringify(result.body)}`
  );
  assert(result.body.losses.length === 1, `${message}: quantidade inesperada.`);
  assert(
    result.body.losses[0].establishment_id === expectedEstablishmentId,
    `${message}: retornou tenant incorreto.`
  );
}

async function main() {
  const suffix = randomUUID().slice(0, 8);
  const password = `Gestify-Auth-${suffix}-A9!`;
  const establishmentA = randomUUID();
  const establishmentB = randomUUID();
  const establishmentC = randomUUID();
  const productA = randomUUID();
  const productB = randomUUID();
  const productC = randomUUID();
  const emailAB = `gestify-auth-ab-${suffix}@example.test`;
  const emailC = `gestify-auth-c-${suffix}@example.test`;

  const userAB = await createFixtureUser({
    email: emailAB,
    password,
    fullName: "Gestify Auth Multiempresa",
    role: "estoque",
  });
  const userC = await createFixtureUser({
    email: emailC,
    password,
    fullName: "Gestify Auth Tenant C",
    role: "estoque",
  });

  await insertRows("establishments", [
    { id: establishmentA, name: "Gestify Auth Tenant A", is_active: true },
    { id: establishmentB, name: "Gestify Auth Tenant B", is_active: true },
    { id: establishmentC, name: "Gestify Auth Tenant C", is_active: true },
  ]);

  await upsertRows(
    "profiles",
    [
      {
        id: userAB.id,
        full_name: "Gestify Auth Multiempresa",
        role: "estoque",
      },
      { id: userC.id, full_name: "Gestify Auth Tenant C", role: "estoque" },
    ],
    "id"
  );

  await insertRows("memberships", [
    {
      user_id: userAB.id,
      establishment_id: establishmentA,
      role: "estoque",
      is_active: true,
      created_at: "2026-01-01T12:00:00.000Z",
    },
    {
      user_id: userAB.id,
      establishment_id: establishmentB,
      role: "estoque",
      is_active: true,
      created_at: "2026-01-02T12:00:00.000Z",
    },
    {
      user_id: userC.id,
      establishment_id: establishmentC,
      role: "estoque",
      is_active: true,
      created_at: "2026-01-03T12:00:00.000Z",
    },
  ]);

  await insertRows("establishment_memberships", [
    {
      user_id: userAB.id,
      establishment_id: establishmentA,
      role: "estoque",
      is_active: true,
    },
    {
      user_id: userAB.id,
      establishment_id: establishmentB,
      role: "estoque",
      is_active: true,
    },
    {
      user_id: userC.id,
      establishment_id: establishmentC,
      role: "estoque",
      is_active: true,
    },
  ]);

  await insertRows("fiscal_company_profiles", [
    {
      establishment_id: establishmentA,
      razao_social: "Gestify Auth Tenant A LTDA",
      nome_fantasia: "Auth A",
      cnpj: `91${suffix.replace(/[^0-9]/g, "").padEnd(12, "1").slice(0, 12)}`,
    },
    {
      establishment_id: establishmentB,
      razao_social: "Gestify Auth Tenant B LTDA",
      nome_fantasia: "Auth B",
      cnpj: `92${suffix.replace(/[^0-9]/g, "").padEnd(12, "2").slice(0, 12)}`,
    },
    {
      establishment_id: establishmentC,
      razao_social: "Gestify Auth Tenant C LTDA",
      nome_fantasia: "Auth C",
      cnpj: `93${suffix.replace(/[^0-9]/g, "").padEnd(12, "3").slice(0, 12)}`,
    },
  ]);

  await insertRows("user_module_permissions", [
    {
      establishment_id: establishmentA,
      user_id: userAB.id,
      module_key: "estoque",
      can_access: true,
    },
    {
      establishment_id: establishmentB,
      user_id: userAB.id,
      module_key: "estoque",
      can_access: true,
    },
    {
      establishment_id: establishmentC,
      user_id: userC.id,
      module_key: "estoque",
      can_access: true,
    },
  ]);

  await insertRows("products", [
    {
      id: productA,
      establishment_id: establishmentA,
      name: "Produto Auth A",
      sku: `AUTH-A-${suffix}`,
      default_unit_label: "UN",
      product_type: "INSU",
      is_active: true,
      price: 0,
    },
    {
      id: productB,
      establishment_id: establishmentB,
      name: "Produto Auth B",
      sku: `AUTH-B-${suffix}`,
      default_unit_label: "UN",
      product_type: "INSU",
      is_active: true,
      price: 0,
    },
    {
      id: productC,
      establishment_id: establishmentC,
      name: "Produto Auth C",
      sku: `AUTH-C-${suffix}`,
      default_unit_label: "UN",
      product_type: "INSU",
      is_active: true,
      price: 0,
    },
  ]);

  await insertRows("losses", [
    {
      establishment_id: establishmentA,
      user_id: userAB.id,
      product_id: productA,
      product_name: "Produto Auth A",
      sku: `AUTH-A-${suffix}`,
      unit_label: "UN",
      qty: 1,
      reason: "Quebra",
    },
    {
      establishment_id: establishmentB,
      user_id: userAB.id,
      product_id: productB,
      product_name: "Produto Auth B",
      sku: `AUTH-B-${suffix}`,
      unit_label: "UN",
      qty: 1,
      reason: "Quebra",
    },
    {
      establishment_id: establishmentC,
      user_id: userC.id,
      product_id: productC,
      product_name: "Produto Auth C",
      sku: `AUTH-C-${suffix}`,
      unit_label: "UN",
      qty: 1,
      reason: "Quebra",
    },
  ]);

  const anonymousCompliance = await getCompliance();
  assert(
    anonymousCompliance.response.status === 401,
    `Compliance anônimo deveria retornar 401, retornou ${anonymousCompliance.response.status}.`
  );

  const sessionAB = await signIn(emailAB, password, establishmentA);

  const complianceBefore = await getCompliance({
    headers: { Authorization: `Bearer ${sessionAB.accessToken}` },
  });
  assert(
    complianceBefore.response.status === 200 &&
      complianceBefore.body?.authenticated === true &&
      complianceBefore.body?.acceptedCurrentTerms === false,
    `Estado contratual inicial inesperado: ${JSON.stringify(complianceBefore.body)}`
  );

  const rejectedAcceptance = await postCompliance(
    { acceptTerms: false, source: "auth_session_smoke" },
    { headers: { Authorization: `Bearer ${sessionAB.accessToken}` } }
  );
  assert(
    rejectedAcceptance.response.status === 400,
    `Aceite falso deveria retornar 400, retornou ${rejectedAcceptance.response.status}.`
  );

  const accepted = await postCompliance(
    {
      acceptTerms: true,
      source: "login_auth_session_smoke",
      path: "/login",
      redirectPath: "/dashboard/pedidos",
    },
    {
      headers: {
        Authorization: `Bearer ${sessionAB.accessToken}`,
        "User-Agent": "gestify-auth-session-smoke/1.0",
        "X-Forwarded-For": "127.0.0.1",
      },
    }
  );
  assert(
    accepted.response.status === 200 && accepted.body?.ok === true,
    `Aceite contratual falhou: HTTP ${accepted.response.status} ${JSON.stringify(accepted.body)}`
  );
  assert(
    (await countRows("user_terms_acceptances", { user_id: userAB.id })) === 1,
    "Aceite contratual não gerou exatamente uma evidência."
  );

  const complianceAfter = await getCompliance({
    headers: { Authorization: `Bearer ${sessionAB.accessToken}` },
  });
  assert(
    complianceAfter.response.status === 200 &&
      complianceAfter.body?.acceptedCurrentTerms === true,
    `Compliance não reconheceu o aceite persistido: ${JSON.stringify(complianceAfter.body)}`
  );

  const previousAccessToken = sessionAB.accessToken;
  const previousRefreshToken = sessionAB.refreshToken;
  const refreshed = await sessionAB.client.auth.refreshSession();
  assert(
    !refreshed.error &&
      refreshed.data.session?.access_token &&
      refreshed.data.session?.refresh_token &&
      refreshed.data.user?.id === userAB.id,
    `Renovação da sessão falhou: ${formatError(refreshed.error)}`
  );
  assert(
    refreshed.data.session.access_token !== previousAccessToken,
    "Renovação não emitiu um novo access token."
  );
  assert(
    refreshed.data.session.refresh_token !== previousRefreshToken,
    "Renovação não rotacionou o refresh token."
  );
  assert(sessionAB.authCookieCount() > 0, "Renovação removeu os cookies SSR.");

  sessionAB.setTenant(establishmentA);
  assertLossTenant(
    await getLosses(sessionAB),
    establishmentA,
    "Leitura autenticada do tenant A"
  );

  sessionAB.setTenant(establishmentB);
  assertLossTenant(
    await getLosses(sessionAB),
    establishmentB,
    "Troca autenticada para o tenant B"
  );

  sessionAB.setTenant(establishmentC);
  assertLossTenant(
    await getLosses(sessionAB),
    establishmentB,
    "Cookie de tenant não autorizado deveria recuar para membership válida"
  );

  const directReadAB = await sessionAB.client
    .from("losses")
    .select("id,establishment_id");
  assert(
    !directReadAB.error && Array.isArray(directReadAB.data),
    `Leitura RLS do usuário multiempresa falhou: ${formatError(directReadAB.error)}`
  );
  assert(
    directReadAB.data.length === 2 &&
      directReadAB.data.every(
        (loss) =>
          loss.establishment_id === establishmentA ||
          loss.establishment_id === establishmentB
      ),
    "RLS do usuário multiempresa retornou linha fora de seus tenants."
  );

  const sessionC = await signIn(emailC, password, establishmentC);
  assertLossTenant(
    await getLosses(sessionC),
    establishmentC,
    "Leitura autenticada do tenant C"
  );

  const directReadC = await sessionC.client
    .from("losses")
    .select("id,establishment_id");
  assert(
    !directReadC.error &&
      directReadC.data?.length === 1 &&
      directReadC.data[0].establishment_id === establishmentC,
    `RLS do tenant C ficou incorreta: ${formatError(directReadC.error)}`
  );

  const secondaryAB = await signIn(emailAB, password, establishmentA);
  const secondaryRefreshToken = secondaryAB.refreshToken;

  const globalSignOut = await sessionAB.client.auth.signOut();
  assert(!globalSignOut.error, `Logout global falhou: ${formatError(globalSignOut.error)}`);
  assert(
    sessionAB.authCookieCount() === 0,
    "Logout global não removeu os cookies SSR da sessão que iniciou a revogação."
  );

  const signedOutRoute = await getLosses(sessionAB);
  assert(
    signedOutRoute.response.status === 401,
    `Rota protegida após logout deveria retornar 401, retornou ${signedOutRoute.response.status}.`
  );

  await assertRefreshTokenRevoked(
    secondaryRefreshToken,
    "Logout global não revogou a segunda sessão"
  );

  const secondaryRefresh = await secondaryAB.client.auth.refreshSession();
  assert(
    secondaryRefresh.error || !secondaryRefresh.data.session,
    "Segunda sessão conseguiu renovar token após logout global."
  );

  const localSignOutC = await sessionC.client.auth.signOut({ scope: "local" });
  assert(!localSignOutC.error, `Logout local falhou: ${formatError(localSignOutC.error)}`);
  assert(sessionC.authCookieCount() === 0, "Logout local não removeu cookies SSR.");

  const report = {
    format: "gestify-auth-session-tenancy-smoke-v1",
    ok: true,
    commit: process.env.GITHUB_SHA ?? null,
    ref: process.env.GITHUB_REF_NAME ?? null,
    anonymousComplianceDenied: true,
    termsAcceptanceValidated: true,
    termsEvidenceRows: 1,
    sessionRefreshValidated: true,
    refreshTokenRotated: true,
    ssrCookiesValidated: true,
    tenantSwitchValidated: true,
    unauthorizedTenantCookieContained: true,
    directRlsIsolationValidated: true,
    globalRefreshRevocationValidated: true,
    protectedRouteDeniedAfterSignOut: true,
    localSignOutValidated: true,
    accessTokenRevocationModel:
      "Refresh tokens are revoked immediately; access token JWTs remain valid until expiry.",
    generatedAt: new Date().toISOString(),
  };

  writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
}

await main();
