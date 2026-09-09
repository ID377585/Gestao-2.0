import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getBillingPlan } from "@/lib/billing/plans";
import { getCompanySubscriptionStatusWithClient } from "@/lib/billing/subscription-status";
import { getEstablishmentEntitlement } from "@/lib/compliance/legal.server";

export type BillingLimitKind =
  | "users"
  | "establishments"
  | "products"
  | "orders"
  | "technicalSheets";

export type BillingLimitCheck = {
  kind: BillingLimitKind;
  allowed: boolean;
  current: number;
  limit: number | null;
  planName: string;
  planSlug: string | null;
};

async function countActiveUsers(params: {
  supabaseAdmin: SupabaseClient<any, any, any>;
  establishmentId: string;
}) {
  const { count, error } = await params.supabaseAdmin
    .from("memberships")
    .select("*", { count: "exact", head: true })
    .eq("establishment_id", params.establishmentId)
    .eq("is_active", true);

  if (error) throw new Error("Não foi possível validar o limite de usuários do plano.");
  return count ?? 0;
}

async function countActiveProducts(params: {
  supabaseAdmin: SupabaseClient<any, any, any>;
  establishmentId: string;
}) {
  const { count, error } = await params.supabaseAdmin
    .from("products")
    .select("*", { count: "exact", head: true })
    .eq("establishment_id", params.establishmentId)
    .eq("is_active", true);

  if (error) throw new Error("Não foi possível validar o limite de produtos do plano.");
  return count ?? 0;
}

async function countOrders(params: {
  supabaseAdmin: SupabaseClient<any, any, any>;
  establishmentId: string;
}) {
  const { count, error } = await params.supabaseAdmin
    .from("orders")
    .select("*", { count: "exact", head: true })
    .eq("establishment_id", params.establishmentId);

  if (error) throw new Error("Não foi possível validar o limite de pedidos do plano.");
  return count ?? 0;
}

async function countTechnicalSheets(params: {
  supabaseAdmin: SupabaseClient<any, any, any>;
  establishmentId: string;
}) {
  const { count, error } = await params.supabaseAdmin
    .from("technical_sheets")
    .select("*", { count: "exact", head: true })
    .eq("establishment_id", params.establishmentId);

  if (error) throw new Error("Não foi possível validar o limite de fichas técnicas do plano.");
  return count ?? 0;
}

async function countUserEstablishments(params: {
  supabaseAdmin: SupabaseClient<any, any, any>;
  userId: string;
}) {
  const { count, error } = await params.supabaseAdmin
    .from("memberships")
    .select("establishment_id", { count: "exact", head: true })
    .eq("user_id", params.userId)
    .eq("is_active", true);

  if (error) throw new Error("Não foi possível validar o limite de empresas do plano.");
  return count ?? 0;
}

function entitlementLimit(
  entitlement: Awaited<ReturnType<typeof getEstablishmentEntitlement>>,
  kind: BillingLimitKind
) {
  if (!entitlement) return undefined;
  if (kind === "users") return entitlement.max_users as number | null;
  if (kind === "establishments") return entitlement.max_establishments as number | null;
  if (kind === "products") return entitlement.max_products as number | null;
  if (kind === "orders") return entitlement.max_orders as number | null;
  return entitlement.max_technical_sheets as number | null;
}

export async function getBillingLimitCheck(params: {
  supabaseAdmin: SupabaseClient<any, any, any>;
  establishmentId: string;
  kind: Exclude<BillingLimitKind, "establishments">;
}): Promise<BillingLimitCheck> {
  const [subscription, entitlement] = await Promise.all([
    getCompanySubscriptionStatusWithClient(params.supabaseAdmin, params.establishmentId),
    getEstablishmentEntitlement(params.establishmentId),
  ]);
  const plan = getBillingPlan(subscription.planSlug);
  const negotiatedLimit = entitlementLimit(entitlement, params.kind);
  const limit = negotiatedLimit !== undefined ? negotiatedLimit : plan?.limits[params.kind] ?? null;

  const current =
    params.kind === "users"
      ? await countActiveUsers(params)
      : params.kind === "products"
        ? await countActiveProducts(params)
        : params.kind === "orders"
          ? await countOrders(params)
          : await countTechnicalSheets(params);

  return {
    kind: params.kind,
    allowed: limit === null || current < limit,
    current,
    limit,
    planName: entitlement?.contract_type
      ? `${plan?.name ?? entitlement.plan_reference ?? "Plano"} - contrato especial`
      : plan?.name ?? "Plano não configurado",
    planSlug: subscription.planSlug,
  };
}

export async function assertBillingLimitAvailable(params: {
  supabaseAdmin: SupabaseClient<any, any, any>;
  establishmentId: string;
  kind: Exclude<BillingLimitKind, "establishments">;
}) {
  const check = await getBillingLimitCheck(params);
  if (!check.allowed) {
    const label =
      check.kind === "users"
        ? "usuários"
        : check.kind === "products"
          ? "produtos"
          : check.kind === "orders"
            ? "pedidos"
            : "fichas técnicas";
    throw new Error(
      `Limite de ${label} atingido no plano ${check.planName}. Uso atual: ${check.current}/${check.limit}.`
    );
  }
  return check;
}

export async function assertEstablishmentCreationLimitAvailable(params: {
  supabaseAdmin: SupabaseClient<any, any, any>;
  referenceEstablishmentId: string;
  userId: string;
}) {
  const [subscription, entitlement] = await Promise.all([
    getCompanySubscriptionStatusWithClient(
      params.supabaseAdmin,
      params.referenceEstablishmentId
    ),
    getEstablishmentEntitlement(params.referenceEstablishmentId),
  ]);
  const plan = getBillingPlan(subscription.planSlug);
  const negotiatedLimit = entitlementLimit(entitlement, "establishments");
  const limit = negotiatedLimit !== undefined ? negotiatedLimit : plan?.limits.establishments ?? null;
  const current = await countUserEstablishments(params);

  const check: BillingLimitCheck = {
    kind: "establishments",
    allowed: limit === null || current < limit,
    current,
    limit,
    planName: entitlement?.contract_type
      ? `${plan?.name ?? entitlement.plan_reference ?? "Plano"} - contrato especial`
      : plan?.name ?? "Plano não configurado",
    planSlug: subscription.planSlug,
  };

  if (!check.allowed) {
    throw new Error(
      `Limite de empresas atingido no plano ${check.planName}. Uso atual: ${check.current}/${check.limit}.`
    );
  }

  return check;
}
