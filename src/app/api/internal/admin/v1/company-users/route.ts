import { getGestifyCompanyUsers } from "@/lib/admin/gestify-admin-data.server";
import { executeGestifyAdminRead } from "@/lib/admin/gestify-admin-route.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const establishmentId = url.searchParams.get("establishment_id") ?? "";
  const limit = Number(url.searchParams.get("limit") ?? 50);
  return executeGestifyAdminRead({
    request,
    action: "company_users",
    targetEstablishmentId: establishmentId || null,
    run: () => getGestifyCompanyUsers(establishmentId, limit),
    responseCount: (data) => data.items.length,
  });
}
