import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getBillingPlan } from "@/lib/billing/plans";
import { getCompanySubscriptionStatusWithClient } from "@/lib/billing/subscription-status";

export type BillingLimitKind = "users" | "establishments" | "products";

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

  if (error) {
    console.error("Erro ao contar usuários ativos do plano:", error);
    throw new Error("Não foi possível validar o limite de usuários do plano.");
  }

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

  if (error) {
    console.error("Erro ao contar produtos ativos do plano:", error);
    throw new Error("Não foi possível validar o limite de produtos do plano.");
  }

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

  if (error) {
    console.error("Erro ao contar empresas ativas do usuário:", error);
    throw new Error("Não foi possível validar o limite de empresas do plano.");
  }

  return count ?? 0;
}

export async function getBillingLimitCheck(params: {
  supabaseAdmin: SupabaseClient<any, any, any>;
  establishmentId: string;
  kind: Exclude<BillingLimitKind, "establishments">;
}): Promise<BillingLimitCheck> {
  const subscription = await getCompanySubscriptionStatusWithClient(
    params.supabaseAdmin,
    params.establishmentId
  );
  const plan = getBillingPlan(subscription.planSlug);
  const limit = plan?.limits[params.kind] ?? null;

  const current =
    params.kind === "users"
      ? await countActiveUsers(params)
      : await countActiveProducts(params);

  return {
    kind: params.kind,
    allowed: limit === null || current < limit,
    current,
    limit,
    planName: plan?.name ?? "Plano não configurado",
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
    const label = check.kind === "users" ? "usuários" : "produtos";
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
  const subscription = await getCompanySubscriptionStatusWithClient(
    params.supabaseAdmin,
    params.referenceEstablishmentId
  );
  const plan = getBillingPlan(subscription.planSlug);
  const limit = plan?.limits.establishments ?? null;
  const current = await countUserEstablishments(params);

  const check: BillingLimitCheck = {
    kind: "establishments",
    allowed: limit === null || current < limit,
    current,
    limit,
    planName: plan?.name ?? "Plano não configurado",
    planSlug: subscription.planSlug,
  };

  if (!check.allowed) {
    throw new Error(
      `Limite de empresas atingido no plano ${check.planName}. Uso atual: ${check.current}/${check.limit}.`
    );
  }

  return check;
}
