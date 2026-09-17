import "server-only";

import { getEstablishmentEntitlement } from "@/lib/compliance/legal.server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

function clamp(value: number, min: number, max: number) {
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
