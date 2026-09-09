import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getEstablishmentEntitlement } from "@/lib/compliance/legal.server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "blocked"
  | "not_configured";

export type CompanySubscriptionStatus = {
  establishmentId: string;
  status: SubscriptionStatus;
  planSlug: string | null;
  currentPeriodEnd: string | null;
  canAccessSystem: boolean;
  billingPolicy?: string | null;
};

const ACCESS_ALLOWED_STATUSES: SubscriptionStatus[] = ["trialing", "active", "not_configured"];

export async function getCompanySubscriptionStatusWithClient(
  supabase: SupabaseClient<any, any, any>,
  establishmentId: string
): Promise<CompanySubscriptionStatus> {
  try {
    const [subscriptionResult, entitlement] = await Promise.all([
      supabase
        .from("company_subscriptions")
        .select("status, plan_slug, current_period_end")
        .eq("establishment_id", establishmentId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      getEstablishmentEntitlement(establishmentId),
    ]);

    const { data, error } = subscriptionResult;
    const complimentary = entitlement?.billing_policy === "complimentary";

    if (error) {
      const code = String((error as any)?.code ?? "");
      if (code === "42P01" || code === "PGRST205" || code === "PGRST204") {
        return {
          establishmentId,
          status: "not_configured",
          planSlug: entitlement?.plan_reference ? String(entitlement.plan_reference) : null,
          currentPeriodEnd: null,
          canAccessSystem: true,
          billingPolicy: entitlement?.billing_policy ?? null,
        };
      }

      console.error("[getCompanySubscriptionStatus] subscription error:", error);
      return {
        establishmentId,
        status: "not_configured",
        planSlug: entitlement?.plan_reference ? String(entitlement.plan_reference) : null,
        currentPeriodEnd: null,
        canAccessSystem: true,
        billingPolicy: entitlement?.billing_policy ?? null,
      };
    }

    const status = String(data?.status ?? "not_configured") as SubscriptionStatus;

    return {
      establishmentId,
      status,
      planSlug: entitlement?.plan_reference
        ? String(entitlement.plan_reference)
        : data?.plan_slug
          ? String(data.plan_slug)
          : null,
      currentPeriodEnd: complimentary
        ? null
        : data?.current_period_end
          ? String(data.current_period_end)
          : null,
      canAccessSystem: complimentary || ACCESS_ALLOWED_STATUSES.includes(status),
      billingPolicy: entitlement?.billing_policy ?? null,
    };
  } catch (error) {
    console.error("[getCompanySubscriptionStatus] unexpected error:", error);
    return {
      establishmentId,
      status: "not_configured",
      planSlug: null,
      currentPeriodEnd: null,
      canAccessSystem: true,
      billingPolicy: null,
    };
  }
}

export async function getCompanySubscriptionStatus(
  establishmentId: string
): Promise<CompanySubscriptionStatus> {
  const supabase = await createSupabaseServerClient();
  return getCompanySubscriptionStatusWithClient(supabase, establishmentId);
}
