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
  process.env.GESTIFY_LOSSES_SMOKE_REPORT_FILE ??
  ".artifacts/supabase-migration-smoke/authenticated-losses-report.json";

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

function asNumber(value) {
  const number = Number(value);
  assert(Number.isFinite(number), `Valor numérico inválido: ${String(value)}`);
  return number;
}

function closeTo(actual, expected, message) {
  const delta = Math.abs(asNumber(actual) - expected);
  assert(delta < 0.000001, `${message}: esperado ${expected}, recebido ${actual}`);
}

function formatError(error) {
  if (!error) return "erro desconhecido";

  return [error.message, error.code, error.details, error.hint]
    .filter(Boolean)
    .join(" | ");
}

function assertAccessDenied(error, message) {
  const code = String(error?.code ?? "");
  const text = formatError(error).toLowerCase();
  const denied =
    code === "42501" ||
    code === "PGRST202" ||
    text.includes("permission denied") ||
    text.includes("row-level security") ||
    text.includes("could not find the function") ||
    text.includes("schema cache");

  assert(denied, `${message}: ${formatError(error)}`);
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

async function updateRows(table, values, filters) {
  let query = admin.from(table).update(values);

  for (const [column, value] of Object.entries(filters)) {
    query = query.eq(column, value);
  }

  const { error } = await query;
  if (error) {
    throw new Error(`Falha ao atualizar ${table}: ${formatError(error)}`);
  }
}

async function readSingle(table, columns, filters) {
  let query = admin.from(table).select(columns);

  for (const [column, value] of Object.entries(filters)) {
    query = query.eq(column, value);
  }

  const { data, error } = await query.single();
  if (error) {
    throw new Error(`Falha ao consultar ${table}: ${formatError(error)}`);
  }

  return data;
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
  };
}

async function signIn(email, password, establishmentId) {
  const session = createCookieAuthenticatedClient();
  const { data, error } = await session.client.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session?.access_token || !data.user) {
    throw new Error(`Falha ao autenticar fixture: ${formatError(error)}`);
  }

  session.setTenant(establishmentId);
  assert(session.cookieJar.size > 1, "Sessão autenticada não gerou cookies SSR.");
  return session;
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

async function postLoss(session, payload, idempotencyKey) {
  return appRequest("/api/losses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: session?.cookieHeader?.() ?? "",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
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

async function main() {
  const suffix = randomUUID().slice(0, 8);
  const password = `Gestify-Smoke-${suffix}-A9!`;
  const establishmentA = randomUUID();
  const establishmentB = randomUUID();
  const productA = randomUUID();
  const labelA = randomUUID();
  const labelCodeA = `SMOKE-LABEL-${suffix}`;
  const emailA = `gestify-smoke-a-${suffix}@example.test`;
  const emailB = `gestify-smoke-b-${suffix}@example.test`;

  const userA = await createFixtureUser({
    email: emailA,
    password,
    fullName: "Gestify Smoke Estoque A",
    role: "estoque",
  });
  const userB = await createFixtureUser({
    email: emailB,
    password,
    fullName: "Gestify Smoke Estoque B",
    role: "estoque",
  });

  await insertRows("establishments", [
    { id: establishmentA, name: "Gestify Smoke Tenant A", is_active: true },
    { id: establishmentB, name: "Gestify Smoke Tenant B", is_active: true },
  ]);

  // Auth hooks may already create the profile, so this is the only fixture
  // write that intentionally uses UPSERT. Every other identifier is unique in
  // the disposable database and therefore uses INSERT without assuming an
  // optional historical unique constraint.
  await upsertRows(
    "profiles",
    [
      { id: userA.id, full_name: "Gestify Smoke Estoque A", role: "estoque" },
      { id: userB.id, full_name: "Gestify Smoke Estoque B", role: "estoque" },
    ],
    "id"
  );

  await insertRows("memberships", [
    {
      user_id: userA.id,
      establishment_id: establishmentA,
      role: "estoque",
      is_active: true,
    },
    {
      user_id: userB.id,
      establishment_id: establishmentB,
      role: "estoque",
      is_active: true,
    },
  ]);

  await insertRows("establishment_memberships", [
    {
      user_id: userA.id,
      establishment_id: establishmentA,
      role: "estoque",
      is_active: true,
    },
    {
      user_id: userB.id,
      establishment_id: establishmentB,
      role: "estoque",
      is_active: true,
    },
  ]);

  await insertRows("fiscal_company_profiles", [
    {
      establishment_id: establishmentA,
      razao_social: "Gestify Smoke Tenant A LTDA",
      nome_fantasia: "Smoke A",
      cnpj: "90000000000001",
    },
    {
      establishment_id: establishmentB,
      razao_social: "Gestify Smoke Tenant B LTDA",
      nome_fantasia: "Smoke B",
      cnpj: "90000000000002",
    },
  ]);

  await insertRows("user_module_permissions", [
    {
      establishment_id: establishmentA,
      user_id: userA.id,
      module_key: "estoque",
      can_access: true,
    },
    {
      establishment_id: establishmentB,
      user_id: userB.id,
      module_key: "estoque",
      can_access: false,
    },
  ]);

  await insertRows("products", [
    {
      id: productA,
      establishment_id: establishmentA,
      name: "Produto Smoke A",
      sku: `SMOKE-${suffix}`,
      default_unit_label: "KG",
      product_type: "INSU",
      is_active: true,
      price: 0,
    },
  ]);

  await insertRows("stock_balances", [
    {
      establishment_id: establishmentA,
      product_id: productA,
      quantity: 10,
      unit_label: "KG",
      location: "Estoque Principal",
    },
  ]);

  await insertRows("inventory_labels", [
    {
      id: labelA,
      establishment_id: establishmentA,
      product_id: productA,
      label_code: labelCodeA,
      qty: 5,
      qty_balance: 5,
      used_qty: 0,
      unit_label: "KG",
      status: "available",
      created_by: userA.id,
    },
  ]);

  const sessionA = await signIn(emailA, password, establishmentA);
  const sessionB = await signIn(emailB, password, establishmentB);

  const unauthenticated = await postLoss(
    null,
    { product_id: productA, qty: 1, unit_label: "KG", reason: "Quebra" },
    `unauth-${suffix}`
  );
  assert(
    unauthenticated.response.status === 401,
    `POST anônimo deveria retornar 401, retornou ${unauthenticated.response.status}.`
  );

  const deniedByModule = await postLoss(
    sessionB,
    { product_id: productA, qty: 1, unit_label: "KG", reason: "Quebra" },
    `module-denied-${suffix}`
  );
  assert(
    deniedByModule.response.status === 403,
    `Usuário sem módulo Estoque deveria retornar 403, retornou ${deniedByModule.response.status}.`
  );

  const directRpcAttempt = await sessionA.client.rpc("register_loss", {
    p_establishment_id: establishmentA,
    p_product_id: productA,
    p_qty: 0.1,
    p_unit_label: "KG",
    p_reason: "Quebra",
    p_reason_detail: null,
    p_lot: null,
    p_label_code: null,
    p_user_id: userA.id,
    p_allow_negative: false,
  });
  assertAccessDenied(
    directRpcAttempt.error,
    "RPC register_loss ficou executável diretamente por authenticated"
  );

  const directInsertAttempt = await sessionA.client.from("losses").insert({
    establishment_id: establishmentA,
    user_id: userA.id,
    product_id: productA,
    product_name: "Produto Smoke A",
    sku: `SMOKE-${suffix}`,
    unit_label: "KG",
    qty: 0.1,
    reason: "Quebra",
  });
  assertAccessDenied(
    directInsertAttempt.error,
    "Tabela losses aceitou INSERT direto de authenticated"
  );

  const noLabelPayload = {
    product_id: productA,
    qty: 2,
    unit_label: "KG",
    reason: "Quebra",
    reason_detail: "Teste automatizado sem etiqueta",
    lot: `LOT-${suffix}`,
  };
  const firstKey = `loss-no-label-${suffix}`;
  const noLabel = await postLoss(sessionA, noLabelPayload, firstKey);
  assert(
    noLabel.response.status === 200 && noLabel.body?.success === true,
    `Perda sem etiqueta falhou: HTTP ${noLabel.response.status} ${JSON.stringify(noLabel.body)}`
  );
  closeTo(noLabel.body.result.stock_before, 10, "Saldo anterior sem etiqueta");
  closeTo(noLabel.body.result.stock_after, 8, "Saldo posterior sem etiqueta");
  assert(noLabel.body.result.label_id == null, "Perda sem etiqueta retornou label_id.");

  let stock = await readSingle("stock_balances", "quantity", {
    establishment_id: establishmentA,
    product_id: productA,
  });
  closeTo(stock.quantity, 8, "Saldo persistido após perda sem etiqueta");
  assert(
    (await countRows("losses", { establishment_id: establishmentA })) === 1,
    "Perda sem etiqueta não gerou exatamente um registro."
  );
  assert(
    (await countRows("stock_movements", {
      establishment_id: establishmentA,
      product_id: productA,
      source: "register_loss",
    })) === 1,
    "Perda sem etiqueta não gerou exatamente um stock_movement."
  );
  assert(
    (await countRows("inventory_movements", {
      establishment_id: establishmentA,
      product_id: productA,
      movement_type: "OUT_LOSS",
    })) === 0,
    "Perda sem etiqueta gerou inventory_movement indevido."
  );

  const replay = await postLoss(sessionA, noLabelPayload, firstKey);
  assert(
    replay.response.status === 200 && replay.body?.success === true,
    `Replay idempotente falhou: HTTP ${replay.response.status} ${JSON.stringify(replay.body)}`
  );
  assert(
    replay.response.headers.get("idempotency-replayed") === "true",
    "Replay idempotente não retornou o header Idempotency-Replayed."
  );
  stock = await readSingle("stock_balances", "quantity", {
    establishment_id: establishmentA,
    product_id: productA,
  });
  closeTo(stock.quantity, 8, "Replay idempotente alterou estoque");
  assert(
    (await countRows("losses", { establishment_id: establishmentA })) === 1,
    "Replay idempotente duplicou a perda."
  );

  const conflictingReplay = await postLoss(
    sessionA,
    { ...noLabelPayload, qty: 1 },
    firstKey
  );
  assert(
    conflictingReplay.response.status === 400,
    `Reuso da mesma chave com payload diferente deveria retornar 400, retornou ${conflictingReplay.response.status}.`
  );
  stock = await readSingle("stock_balances", "quantity", {
    establishment_id: establishmentA,
    product_id: productA,
  });
  closeTo(stock.quantity, 8, "Conflito de idempotência alterou estoque");

  const insufficient = await postLoss(
    sessionA,
    {
      product_id: productA,
      qty: 50,
      unit_label: "KG",
      reason: "Quebra",
      reason_detail: "Teste de rollback por saldo insuficiente",
    },
    `loss-insufficient-${suffix}`
  );
  assert(
    insufficient.response.status === 400,
    `Saldo insuficiente deveria retornar 400, retornou ${insufficient.response.status}.`
  );
  stock = await readSingle("stock_balances", "quantity", {
    establishment_id: establishmentA,
    product_id: productA,
  });
  closeTo(stock.quantity, 8, "Falha por saldo insuficiente alterou estoque");
  assert(
    (await countRows("losses", { establishment_id: establishmentA })) === 1,
    "Falha por saldo insuficiente deixou perda parcial."
  );

  const labelPayload = {
    product_id: productA,
    qty: 1.5,
    unit_label: "KG",
    reason: "Vencimento",
    reason_detail: "Teste automatizado com etiqueta",
    qrcode: labelCodeA,
  };
  const withLabel = await postLoss(
    sessionA,
    labelPayload,
    `loss-with-label-${suffix}`
  );
  assert(
    withLabel.response.status === 200 && withLabel.body?.success === true,
    `Perda com etiqueta falhou: HTTP ${withLabel.response.status} ${JSON.stringify(withLabel.body)}`
  );
  closeTo(withLabel.body.result.stock_before, 8, "Saldo anterior com etiqueta");
  closeTo(withLabel.body.result.stock_after, 6.5, "Saldo posterior com etiqueta");
  closeTo(withLabel.body.result.label_before, 5, "Saldo anterior da etiqueta");
  closeTo(withLabel.body.result.label_after, 3.5, "Saldo posterior da etiqueta");
  assert(
    withLabel.body.result.label_id === labelA,
    "Perda com etiqueta retornou label_id incorreto."
  );

  stock = await readSingle("stock_balances", "quantity", {
    establishment_id: establishmentA,
    product_id: productA,
  });
  closeTo(stock.quantity, 6.5, "Saldo persistido após perda com etiqueta");

  const label = await readSingle(
    "inventory_labels",
    "qty_balance,used_qty,last_action,movement_id",
    { id: labelA }
  );
  closeTo(label.qty_balance, 3.5, "Saldo persistido da etiqueta");
  closeTo(label.used_qty, 1.5, "Quantidade utilizada da etiqueta");
  assert(label.last_action === "perda", "Etiqueta não registrou last_action=perda.");
  assert(Boolean(label.movement_id), "Etiqueta não foi vinculada ao movimento.");

  assert(
    (await countRows("losses", { establishment_id: establishmentA })) === 2,
    "Fluxos com e sem etiqueta não geraram exatamente duas perdas."
  );
  assert(
    (await countRows("stock_movements", {
      establishment_id: establishmentA,
      product_id: productA,
      source: "register_loss",
    })) === 1,
    "Perda com etiqueta duplicou o caminho de stock_movements."
  );
  assert(
    (await countRows("inventory_movements", {
      establishment_id: establishmentA,
      product_id: productA,
      movement_type: "OUT_LOSS",
    })) === 1,
    "Perda com etiqueta não gerou exatamente um inventory_movement OUT_LOSS."
  );
  assert(
    (await countRows("stock_balance_audit", {
      establishment_id: establishmentA,
      product_id: productA,
      reason: "register_loss",
    })) === 2,
    "Auditoria de saldo não registrou exatamente as duas perdas concluídas."
  );

  const completedIdempotency = await readSingle(
    "api_idempotency_keys",
    "status,response_status,response_body",
    {
      establishment_id: establishmentA,
      user_id: userA.id,
      operation: "losses.register",
      idempotency_key: firstKey,
    }
  );
  assert(
    completedIdempotency.status === "completed" &&
      completedIdempotency.response_status === 200,
    "Registro idempotente concluído ficou em estado inválido."
  );

  await updateRows(
    "user_module_permissions",
    { can_access: true },
    {
      establishment_id: establishmentB,
      user_id: userB.id,
      module_key: "estoque",
    }
  );

  const crossTenant = await postLoss(
    sessionB,
    {
      product_id: productA,
      qty: 0.5,
      unit_label: "KG",
      reason: "Quebra",
      reason_detail: "Tentativa cruzada entre tenants",
    },
    `loss-cross-tenant-${suffix}`
  );
  assert(
    crossTenant.response.status === 400,
    `Tentativa cross-tenant deveria retornar 400, retornou ${crossTenant.response.status}.`
  );
  stock = await readSingle("stock_balances", "quantity", {
    establishment_id: establishmentA,
    product_id: productA,
  });
  closeTo(stock.quantity, 6.5, "Tentativa cross-tenant alterou estoque A");
  assert(
    (await countRows("losses", { establishment_id: establishmentA })) === 2,
    "Tentativa cross-tenant criou perda no tenant A."
  );

  const getA = await getLosses(sessionA);
  assert(
    getA.response.status === 200 && Array.isArray(getA.body?.losses),
    `GET de perdas do tenant A falhou: HTTP ${getA.response.status}`
  );
  assert(getA.body.losses.length === 2, "Tenant A não recebeu suas duas perdas.");
  assert(
    getA.body.losses.every(
      (loss) => loss.establishment_id === establishmentA
    ),
    "GET do tenant A retornou linha de outro tenant."
  );

  const getB = await getLosses(sessionB);
  assert(
    getB.response.status === 200 && Array.isArray(getB.body?.losses),
    `GET de perdas do tenant B falhou: HTTP ${getB.response.status}`
  );
  assert(getB.body.losses.length === 0, "Tenant B visualizou perdas do tenant A.");

  const directReadA = await sessionA.client
    .from("losses")
    .select("id,establishment_id");
  assert(
    !directReadA.error && directReadA.data?.length === 2,
    `RLS não permitiu leitura das próprias perdas: ${formatError(directReadA.error)}`
  );
  assert(
    directReadA.data.every((loss) => loss.establishment_id === establishmentA),
    "RLS retornou perda de outro tenant para o usuário A."
  );

  const directReadB = await sessionB.client
    .from("losses")
    .select("id,establishment_id");
  assert(
    !directReadB.error && directReadB.data?.length === 0,
    `RLS expôs perdas do tenant A ao usuário B: ${formatError(directReadB.error)}`
  );

  const report = {
    format: "gestify-authenticated-losses-smoke-v1",
    ok: true,
    commit: process.env.GITHUB_SHA ?? null,
    ref: process.env.GITHUB_REF_NAME ?? null,
    anonymousDenied: true,
    modulePermissionDenied: true,
    directAuthenticatedRpcDenied: true,
    directAuthenticatedInsertDenied: true,
    tenantIsolationValidated: true,
    noLabelFlowValidated: true,
    labelFlowValidated: true,
    singleStockMutationPathValidated: true,
    insufficientBalanceRollbackValidated: true,
    idempotentReplayValidated: true,
    auditRows: 2,
    finalStock: 6.5,
    finalLabelBalance: 3.5,
    generatedAt: new Date().toISOString(),
  };

  writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
}

await main();
