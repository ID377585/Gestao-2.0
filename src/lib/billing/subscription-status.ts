import "server-only";
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
};

const ACCESS_ALLOWED_STATUSES: SubscriptionStatus[] = ["trialing", "active", "not_configured"];

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export async function getCompanySubscriptionStatusWithClient(
  supabase: SupabaseServerClient,
  establishmentId: string
): Promise<CompanySubscriptionStatus> {
  try {
    const { data, error } = await supabase
      .from("company_subscriptions")
      .select("status, plan_slug, current_period_end")
      .eq("establishment_id", establishmentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      const code = String((error as any)?.code ?? "");
      if (code === "42P01" || code === "PGRST205" || code === "PGRST204") {
        return {
          establishmentId,
          status: "not_configured",
          planSlug: null,
          currentPeriodEnd: null,
          canAccessSystem: true,
        };
      }

      console.error("[getCompanySubscriptionStatus] subscription error:", error);
      return {
        establishmentId,
        status: "not_configured",
        planSlug: null,
        currentPeriodEnd: null,
        canAccessSystem: true,
      };
    }

    const status = String(data?.status ?? "not_configured") as SubscriptionStatus;

    return {
      establishmentId,
      status,
      planSlug: data?.plan_slug ? String(data.plan_slug) : null,
      currentPeriodEnd: data?.current_period_end ? String(data.current_period_end) : null,
      canAccessSystem: ACCESS_ALLOWED_STATUSES.includes(status),
    };
  } catch (error) {
    console.error("[getCompanySubscriptionStatus] unexpected error:", error);
    return {
      establishmentId,
      status: "not_configured",
      planSlug: null,
      currentPeriodEnd: null,
      canAccessSystem: true,
    };
  }
}

export async function getCompanySubscriptionStatus(
  establishmentId: string
): Promise<CompanySubscriptionStatus> {
  const supabase = await createSupabaseServerClient();
  return getCompanySubscriptionStatusWithClient(supabase, establishmentId);
}
