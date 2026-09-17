import { getGestifySubscriptionCancellationSummary } from "@/lib/admin/gestify-admin-extra.server";
import { executeGestifyAdminRead } from "@/lib/admin/gestify-admin-route.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const days = Number(new URL(request.url).searchParams.get("days") ?? 30);
  return executeGestifyAdminRead({
    request,
    action: "subscription_cancellation_summary",
    run: () => getGestifySubscriptionCancellationSummary(days),
    responseCount: (data) => data.items.length,
  });
}
