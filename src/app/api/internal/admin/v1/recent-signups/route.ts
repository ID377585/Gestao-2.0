import { listGestifyRecentSignups } from "@/lib/admin/gestify-admin-data.server";
import { executeGestifyAdminRead } from "@/lib/admin/gestify-admin-route.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const days = Number(url.searchParams.get("days") ?? 30);
  const limit = Number(url.searchParams.get("limit") ?? 50);
  return executeGestifyAdminRead({
    request,
    action: "recent_signups",
    run: () => listGestifyRecentSignups({ days, limit }),
    responseCount: (data) => data.items.length,
  });
}
