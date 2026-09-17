import "server-only";

import { getEstablishmentEntitlement } from "@/lib/compliance/legal.server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function assertUuid(value: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error("invalid_establishment_id");
  }
}

export async function listGestifyPastDueSubscriptions(requestedLimit = 50) {
  const supabase = getSupabaseAdminClient();
  const limit = clamp(requestedLimit, 1, 100);
  const { data, error } = await supabase
    .from("company_subscriptions")
    .select("establishment_id,plan_slug,status,current_period_end,created_at,establishments(name,is_active)")
    .eq("status", "past_due")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error("past_due_query_failed");
  return {
    semantics: "subscription_status_past_due_not_reconciled_financial_overdue",
    limit,
    items: (data ?? []).map((row: any) => ({
      establishmentId: row.establishment_id,
      name: row.establishments?.name ?? null,
      establishmentActive: row.establishments?.is_active ?? null,
      planSlug: row.plan_slug,
      status: row.status,
      currentPeriodEnd: row.current_period_end,
      createdAt: row.created_at,
    })),
  };
}

export async function getGestifyEnabledModules(establishmentId: string) {
  assertUuid(establishmentId);
  const entitlement = await getEstablishmentEntitlement(establishmentId);
  return {
    establishmentId,
    source: "establishment_entitlements",
    telemetryAvailable: false,
    enabledModules: entitlement?.enabled_modules ?? [],
    modules: entitlement?.modules ?? {},
    entitlementActive: entitlement?.is_active ?? false,
    effectiveAt: entitlement?.effective_at ?? null,
    expiresAt: entitlement?.expires_at ?? null,
  };
}

export async function getGestifyContractualRecurringSummary() {
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("establishment_entitlements")
    .select("establishment_id,effective_monthly_price_brl,billing_policy,billing_status,is_active,expires_at")
    .eq("is_active", true);
  if (error) throw new Error("contractual_recurring_summary_failed");

  const eligible = (data ?? []).filter((row) => !row.expires_at || String(row.expires_at) > now);
  const contractedAmountBrl = eligible.reduce((total, row) => {
    const value = Number(row.effective_monthly_price_brl ?? 0);
    return total + (Number.isFinite(value) ? value : 0);
  }, 0);
  const complimentaryCount = eligible.filter((row) => row.billing_policy === "complimentary").length;
  const positiveAmountCount = eligible.filter(
    (row) => Number(row.effective_monthly_price_brl ?? 0) > 0,
  ).length;

  return {
    semantics: "contracted_recurring_amount_not_billed_or_collected_mrr",
    currency: "BRL",
    activeEntitlementCount: eligible.length,
    positiveContractAmountCount: positiveAmountCount,
    complimentaryCount,
    contractedRecurringAmountBrl: Number(contractedAmountBrl.toFixed(2)),
    billedMrrAvailable: false,
    collectedMrrAvailable: false,
    reconciledOverdueAvailable: false,
  };
}

export async function getGestifySubscriptionCancellationSummary(requestedDays = 30) {
  const supabase = getSupabaseAdminClient();
  const days = clamp(requestedDays, 1, 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error, count } = await supabase
    .from("company_subscriptions")
    .select("establishment_id,plan_slug,status,canceled_at,establishments(name,is_active)", {
      count: "exact",
    })
    .eq("status", "canceled")
    .gte("canceled_at", since)
    .order("canceled_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("subscription_cancellation_summary_failed");

  return {
    semantics: "subscription_cancellations_not_financial_churn_rate",
    days,
    cancellationCount: count ?? 0,
    financialChurnRateAvailable: false,
    items: (data ?? []).map((row: any) => ({
      establishmentId: row.establishment_id,
      name: row.establishments?.name ?? null,
      establishmentActive: row.establishments?.is_active ?? null,
      planSlug: row.plan_slug,
      canceledAt: row.canceled_at,
    })),
  };
}
