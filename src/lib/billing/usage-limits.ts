import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BillingPlan } from "@/lib/billing/plans";
import { listCurrentUserTenants } from "@/lib/tenant/get-current-tenant";

export type PlanUsageMetric = {
  key: "users" | "establishments" | "products";
  label: string;
  used: number;
  limit: number | null;
  percentage: number | null;
  isUnlimited: boolean;
  isNearLimit: boolean;
  isAtLimit: boolean;
};

export type CompanyPlanUsage = {
  establishmentId: string;
  metrics: PlanUsageMetric[];
};

async function safeCount(params: {
  table: string;
  establishmentId?: string | null;
  applyEstablishmentFilter?: boolean;
}) {
  const supabase = await createSupabaseServerClient();

  try {
    let query = supabase.from(params.table).select("*", {
      count: "exact",
      head: true,
    });

    if (params.applyEstablishmentFilter && params.establishmentId) {
      query = query.eq("establishment_id", params.establishmentId);
    }

    const { count, error } = await query;

    if (error) {
      const code = String((error as any)?.code ?? "");
      if (code === "42P01" || code === "42703" || code === "PGRST205") {
        return 0;
      }

      console.error("[billing.safeCount] error", {
        table: params.table,
        message: error.message,
        code: (error as any)?.code,
      });
      return 0;
    }

    return Number(count ?? 0);
  } catch (error) {
    console.error("[billing.safeCount] unexpected error", {
      table: params.table,
      error,
    });
    return 0;
  }
}

function buildMetric(params: {
  key: PlanUsageMetric["key"];
  label: string;
  used: number;
  limit: number | null;
}): PlanUsageMetric {
  const isUnlimited = params.limit === null;
  const percentage =
    params.limit && params.limit > 0
      ? Math.min(100, Math.round((params.used / params.limit) * 100))
      : null;

  return {
    key: params.key,
    label: params.label,
    used: params.used,
    limit: params.limit,
    percentage,
    isUnlimited,
    isNearLimit: percentage !== null && percentage >= 80 && percentage < 100,
    isAtLimit: percentage !== null && percentage >= 100,
  };
}

export async function getCompanyPlanUsage(params: {
  establishmentId: string;
  plan: BillingPlan | null;
}): Promise<CompanyPlanUsage> {
  const [usersCount, tenants, productsCount] = await Promise.all([
    safeCount({
      table: "memberships",
      establishmentId: params.establishmentId,
      applyEstablishmentFilter: true,
    }),
    listCurrentUserTenants(),
    safeCount({
      table: "products",
      establishmentId: params.establishmentId,
      applyEstablishmentFilter: true,
    }),
  ]);
  const establishmentsCount = tenants.filter(
    (tenant) => tenant.is_active && tenant.establishment_id
  ).length;

  return {
    establishmentId: params.establishmentId,
    metrics: [
      buildMetric({
        key: "users",
        label: "Usuários",
        used: usersCount,
        limit: params.plan?.limits.users ?? null,
      }),
      buildMetric({
        key: "establishments",
        label: "Empresas/estabelecimentos",
        used: establishmentsCount,
        limit: params.plan?.limits.establishments ?? null,
      }),
      buildMetric({
        key: "products",
        label: "Produtos/insumos",
        used: productsCount,
        limit: params.plan?.limits.products ?? null,
      }),
    ],
  };
}
