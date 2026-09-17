import { listGestifyTrialAccounts } from "@/lib/admin/gestify-admin-data.server";
import { executeGestifyAdminRead } from "@/lib/admin/gestify-admin-route.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limit = Number(new URL(request.url).searchParams.get("limit") ?? 50);
  return executeGestifyAdminRead({
    request,
    action: "trial_accounts",
    run: () => listGestifyTrialAccounts(limit),
    responseCount: (data) => data.items.length,
  });
}
