import { getGestifyPlatformHealth } from "@/lib/admin/gestify-admin-data.server";
import { executeGestifyAdminRead } from "@/lib/admin/gestify-admin-route.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return executeGestifyAdminRead({
    request,
    action: "platform_health",
    run: getGestifyPlatformHealth,
  });
}
