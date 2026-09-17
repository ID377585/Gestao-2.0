import "server-only";

import { getBillingLimitCheck } from "@/lib/billing/limits";
import { getEstablishmentEntitlement } from "@/lib/compliance/legal.server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const MAX_COMPANY_PAGE = 100;
const MAX_USER_PAGE = 50;
const MAX_RECENT_DAYS = 90;

function clampInt(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function assertUuid(value: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error("invalid_establishment_id");
  }
}

export async function listGestifyCompanies(params: {
  status?: "active" | "inactive" | "all";
  limit?: number;
  offset?: number;
}) {
  const supabase = getSupabaseAdminClient();
  const limit = clampInt(params.limit ?? 50, 1, MAX_COMPANY_PAGE);
  const offset = Math.max(0, Math.trunc(params.offset ?? 0));
  let query = supabase
    .from("establishments")
    .select("id,name,is_active,created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (params.status === "active") query = query.eq("is_active", true);
  if (params.status === "inactive") query = query.eq("is_active", false);

  const { data: establishments, error, count } = await query;
  if (error) throw new Error(`companies_query_failed:${error.code ?? "unknown"}`);

  const ids = (establishments ?? []).map((row) => String(row.id));
  const [subscriptionsResult, entitlementsResult] = ids.length
    ? await Promise.all([
        supabase
          .from("company_subscriptions")
          .select("establishment_id,plan_slug,status,created_at")
          .in("establishment_id", ids)
          .order("created_at", { ascending: false }),
        supabase
          .from("establishment_entitlements")
          .select("establishment_id,plan_code,billing_status,contract_type,billing_policy,is_active,effective_at")
          .in("establishment_id", ids)
          .order("effective_at", { ascending: false }),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];

  if (subscriptionsResult.error) throw new Error("companies_subscription_join_failed");
  if (entitlementsResult.error) throw new Error("companies_entitlement_join_failed");

  const latestSubscription = new Map<string, any>();
  for (const row of subscriptionsResult.data ?? []) {
    const key = String(row.establishment_id);
    if (!latestSubscription.has(key)) latestSubscription.set(key, row);
  }
  const latestEntitlement = new Map<string, any>();
  for (const row of entitlementsResult.data ?? []) {
    const key = String(row.establishment_id);
    if (!latestEntitlement.has(key)) latestEntitlement.set(key, row);
  }

  return {
    total: count ?? 0,
    limit,
    offset,
    items: (establishments ?? []).map((row) => {
      const id = String(row.id);
      const subscription = latestSubscription.get(id) ?? null;
      const entitlement = latestEntitlement.get(id) ?? null;
      return {
        id,
        name: String(row.name),
        active: Boolean(row.is_active),
        createdAt: String(row.created_at),
        planCode: entitlement?.plan_code ?? subscription?.plan_slug ?? null,
        billingStatus: entitlement?.billing_status ?? subscription?.status ?? null,
        contractType: entitlement?.contract_type ?? null,
        billingPolicy: entitlement?.billing_policy ?? null,
      };
    }),
  };
}

export async function getGestifyCompanyDetails(establishmentId: string) {
  assertUuid(establishmentId);
  const supabase = getSupabaseAdminClient();
  const [{ data: establishment, error }, entitlement, subscription] = await Promise.all([
    supabase
      .from("establishments")
      .select("id,name,is_active,created_at")
      .eq("id", establishmentId)
      .maybeSingle(),
    getEstablishmentEntitlement(establishmentId),
    supabase
      .from("company_subscriptions")
      .select("plan_slug,status,current_period_start,current_period_end,trial_ends_at,canceled_at,created_at,updated_at")
      .eq("establishment_id", establishmentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (error) throw new Error("company_query_failed");
  if (!establishment) return null;
  if (subscription.error) throw new Error("subscription_query_failed");

  return {
    id: String(establishment.id),
    name: String(establishment.name),
    active: Boolean(establishment.is_active),
    createdAt: String(establishment.created_at),
    subscription: subscription.data
      ? {
          planSlug: subscription.data.plan_slug,
          status: subscription.data.status,
          currentPeriodStart: subscription.data.current_period_start,
          currentPeriodEnd: subscription.data.current_period_end,
          trialEndsAt: subscription.data.trial_ends_at,
          canceledAt: subscription.data.canceled_at,
        }
      : null,
    entitlement: entitlement
      ? {
          planCode: entitlement.plan_code,
          billingStatus: entitlement.billing_status,
          monthlyPriceBrl: entitlement.monthly_price_brl,
          effectiveMonthlyPriceBrl: entitlement.effective_monthly_price_brl,
          maxUsers: entitlement.max_users,
          maxEstablishments: entitlement.max_establishments,
          maxProducts: entitlement.max_products,
          maxTechnicalSheets: entitlement.max_technical_sheets,
          maxOrders: entitlement.max_orders,
          enabledModules: entitlement.enabled_modules,
          modules: entitlement.modules,
          billingPolicy: entitlement.billing_policy,
          automaticBillingAllowed: entitlement.automatic_billing_allowed,
          planReference: entitlement.plan_reference,
          contractType: entitlement.contract_type,
          effectiveAt: entitlement.effective_at,
          expiresAt: entitlement.expires_at,
          active: entitlement.is_active,
        }
      : null,
  };
}

export async function getGestifyCompanyUsers(establishmentId: string, requestedLimit = 50) {
  assertUuid(establishmentId);
  const supabase = getSupabaseAdminClient();
  const limit = clampInt(requestedLimit, 1, MAX_USER_PAGE);
  const { data: memberships, error } = await supabase
    .from("memberships")
    .select("user_id,role,is_active,created_at")
    .eq("establishment_id", establishmentId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error("company_users_query_failed");

  const items = await Promise.all(
    (memberships ?? []).map(async (membership) => {
      const userId = String(membership.user_id);
      if (process.env.GESTIFY_ADMIN_STAGING_DB_SECRET?.trim()) {
        const { data, error: profileError } = await supabase.rpc(
          "gestify_admin_staging_user_profile",
          { p_user_id: userId },
        );
        const profile = Array.isArray(data) ? data[0] : null;
        return {
          userId,
          role: membership.role,
          active: Boolean(membership.is_active),
          membershipCreatedAt: membership.created_at,
          accountCreatedAt: profileError ? null : profile?.created_at ?? null,
          lastSignInAt: profileError ? null : profile?.last_sign_in_at ?? null,
        };
      }

      const { data, error: authError } = await supabase.auth.admin.getUserById(userId);
      if (authError) {
        return {
          userId,
          role: membership.role,
          active: Boolean(membership.is_active),
          membershipCreatedAt: membership.created_at,
          accountCreatedAt: null,
          lastSignInAt: null,
        };
      }
      return {
        userId,
        role: membership.role,
        active: Boolean(membership.is_active),
        membershipCreatedAt: membership.created_at,
        accountCreatedAt: data.user?.created_at ?? null,
        lastSignInAt: data.user?.last_sign_in_at ?? null,
      };
    }),
  );

  return { limit, items };
}

export async function getGestifySubscriptionStatus(establishmentId: string) {
  assertUuid(establishmentId);
  const supabase = getSupabaseAdminClient();
  const [subscriptionResult, entitlement] = await Promise.all([
    supabase
      .from("company_subscriptions")
      .select("plan_slug,status,current_period_start,current_period_end,trial_ends_at,canceled_at,created_at,updated_at")
      .eq("establishment_id", establishmentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    getEstablishmentEntitlement(establishmentId),
  ]);
  if (subscriptionResult.error) throw new Error("subscription_query_failed");
  return {
    establishmentId,
    planSlug: entitlement?.plan_reference ?? subscriptionResult.data?.plan_slug ?? null,
    planCode: entitlement?.plan_code ?? null,
    status: subscriptionResult.data?.status ?? "not_configured",
    billingStatus: entitlement?.billing_status ?? null,
    currentPeriodStart: subscriptionResult.data?.current_period_start ?? null,
    currentPeriodEnd: subscriptionResult.data?.current_period_end ?? null,
    trialEndsAt: subscriptionResult.data?.trial_ends_at ?? null,
    canceledAt: subscriptionResult.data?.canceled_at ?? null,
    billingPolicy: entitlement?.billing_policy ?? null,
    automaticBillingAllowed: entitlement?.automatic_billing_allowed ?? null,
    effectiveMonthlyPriceBrl: entitlement?.effective_monthly_price_brl ?? null,
    amountSemantics: "contractual_recurring_amount_not_collected_revenue",
  };
}

export async function listGestifyTrialAccounts(limitRequested = 50) {
  const supabase = getSupabaseAdminClient();
  const limit = clampInt(limitRequested, 1, MAX_COMPANY_PAGE);
  const { data, error } = await supabase
    .from("company_subscriptions")
    .select("establishment_id,plan_slug,status,trial_ends_at,created_at,establishments(name,is_active)")
    .eq("status", "trialing")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error("trial_accounts_query_failed");
  return {
    limit,
    items: (data ?? []).map((row: any) => ({
      establishmentId: row.establishment_id,
      name: row.establishments?.name ?? null,
      establishmentActive: row.establishments?.is_active ?? null,
      planSlug: row.plan_slug,
      status: row.status,
      trialEndsAt: row.trial_ends_at,
      createdAt: row.created_at,
    })),
  };
}

export async function getGestifyPlanUsage(establishmentId: string) {
  assertUuid(establishmentId);
  const supabase = getSupabaseAdminClient();
  const [users, products, orders, technicalSheets, entitlement] = await Promise.all([
    getBillingLimitCheck({ supabaseAdmin: supabase, establishmentId, kind: "users" }),
    getBillingLimitCheck({ supabaseAdmin: supabase, establishmentId, kind: "products" }),
    getBillingLimitCheck({ supabaseAdmin: supabase, establishmentId, kind: "orders" }),
    getBillingLimitCheck({ supabaseAdmin: supabase, establishmentId, kind: "technicalSheets" }),
    getEstablishmentEntitlement(establishmentId),
  ]);
  return {
    establishmentId,
    planSlug: users.planSlug,
    planName: users.planName,
    usage: { users, products, orders, technicalSheets },
    enabledModules: entitlement?.enabled_modules ?? [],
    modules: entitlement?.modules ?? {},
  };
}

export async function listGestifyRecentSignups(params: { days?: number; limit?: number }) {
  const supabase = getSupabaseAdminClient();
  const days = clampInt(params.days ?? 30, 1, MAX_RECENT_DAYS);
  const limit = clampInt(params.limit ?? 50, 1, MAX_COMPANY_PAGE);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("establishments")
    .select("id,name,is_active,created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error("recent_signups_query_failed");
  return { days, limit, items: data ?? [] };
}

export async function getGestifyUserActivity(establishmentId: string, requestedLimit = 50) {
  const companyUsers = await getGestifyCompanyUsers(establishmentId, requestedLimit);
  const items = [...companyUsers.items].sort((a, b) => {
    const av = a.lastSignInAt ? Date.parse(a.lastSignInAt) : 0;
    const bv = b.lastSignInAt ? Date.parse(b.lastSignInAt) : 0;
    return bv - av;
  });
  return { limit: companyUsers.limit, items };
}

export async function getGestifyPlatformHealth() {
  const supabase = getSupabaseAdminClient();
  const startedAt = Date.now();
  const { count, error } = await supabase
    .from("establishments")
    .select("id", { count: "exact", head: true });
  return {
    checkedAt: new Date().toISOString(),
    database: {
      reachable: !error,
      latencyMs: Date.now() - startedAt,
      establishmentCountProbe: error ? null : count ?? 0,
    },
    adminBoundary: {
      enabled: process.env.GESTIFY_ADMIN_ENABLED === "true",
      readsEnabled: process.env.GESTIFY_ADMIN_READS_ENABLED === "true",
      writesEnabled: process.env.GESTIFY_ADMIN_WRITES_ENABLED === "true",
    },
    financialMetrics: {
      collectedMrrAvailable: false,
      billedMrrAvailable: false,
      reconciledOverdueAvailable: false,
      reconciledChurnAvailable: false,
    },
  };
}
