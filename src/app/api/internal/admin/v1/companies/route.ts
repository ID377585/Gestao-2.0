import { listGestifyCompanies } from "@/lib/admin/gestify-admin-data.server";
import { executeGestifyAdminRead } from "@/lib/admin/gestify-admin-route.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawStatus = url.searchParams.get("status") ?? "all";
  const status = rawStatus === "active" || rawStatus === "inactive" ? rawStatus : "all";
  const limit = Number(url.searchParams.get("limit") ?? 50);
  const offset = Number(url.searchParams.get("offset") ?? 0);
  return executeGestifyAdminRead({
    request,
    action: "list_companies",
    run: () => listGestifyCompanies({ status, limit, offset }),
    responseCount: (data) => data.items.length,
  });
}
