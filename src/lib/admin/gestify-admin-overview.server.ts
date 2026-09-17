import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/server";

export type GestifyPlatformOverview = {
  collectedAt: string;
  establishments: {
    total: number;
    active: number;
    inactive: number;
    createdLast30Days: number;
  };
  memberships: {
    active: number;
  };
  subscriptions: {
    active: number;
    trialing: number;
    pastDue: number;
    canceled: number;
  };
};

async function exactCount(
  table: string,
  configure?: (query: any) => any,
): Promise<number> {
  const supabase = getSupabaseAdminClient();
  let query = supabase.from(table).select("*", { count: "exact", head: true });
  if (configure) query = configure(query);
  const { count, error } = await query;
  if (error) {
    throw new Error(`Gestify admin count failed for ${table}: ${error.message}`);
  }
  return count ?? 0;
}

export async function getGestifyPlatformOverview(): Promise<GestifyPlatformOverview> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    establishmentsTotal,
    establishmentsActive,
    establishmentsInactive,
    establishmentsCreatedLast30Days,
    activeMemberships,
    subscriptionsActive,
    subscriptionsTrialing,
    subscriptionsPastDue,
    subscriptionsCanceled,
  ] = await Promise.all([
    exactCount("establishments"),
    exactCount("establishments", (query) => query.eq("is_active", true)),
    exactCount("establishments", (query) => query.eq("is_active", false)),
    exactCount("establishments", (query) => query.gte("created_at", thirtyDaysAgo)),
    exactCount("memberships", (query) => query.eq("is_active", true)),
    exactCount("company_subscriptions", (query) => query.eq("status", "active")),
    exactCount("company_subscriptions", (query) => query.eq("status", "trialing")),
    exactCount("company_subscriptions", (query) => query.eq("status", "past_due")),
    exactCount("company_subscriptions", (query) => query.eq("status", "canceled")),
  ]);

  return {
    collectedAt: now.toISOString(),
    establishments: {
      total: establishmentsTotal,
      active: establishmentsActive,
      inactive: establishmentsInactive,
      createdLast30Days: establishmentsCreatedLast30Days,
    },
    memberships: {
      active: activeMemberships,
    },
    subscriptions: {
      active: subscriptionsActive,
      trialing: subscriptionsTrialing,
      pastDue: subscriptionsPastDue,
      canceled: subscriptionsCanceled,
    },
  };
}
