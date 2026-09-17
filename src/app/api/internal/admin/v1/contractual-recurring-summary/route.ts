import { getGestifyContractualRecurringSummary } from "@/lib/admin/gestify-admin-extra.server";
import { executeGestifyAdminRead } from "@/lib/admin/gestify-admin-route.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return executeGestifyAdminRead({
    request,
    action: "contractual_recurring_summary",
    run: getGestifyContractualRecurringSummary,
  });
}
