import { getGestifyEnabledModules } from "@/lib/admin/gestify-admin-extra.server";
import { executeGestifyAdminRead } from "@/lib/admin/gestify-admin-route.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const establishmentId = new URL(request.url).searchParams.get("establishment_id") ?? "";
  return executeGestifyAdminRead({
    request,
    action: "enabled_modules",
    targetEstablishmentId: establishmentId || null,
    run: () => getGestifyEnabledModules(establishmentId),
  });
}
