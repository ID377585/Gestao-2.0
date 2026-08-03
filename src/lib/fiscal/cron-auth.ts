import "server-only";

import { type NextRequest } from "next/server";

import { authorizeCronSecret } from "@/lib/security/cron-secret";

export function isFiscalCronAuthorized(
  request: NextRequest,
  routeLabel = "rota fiscal"
) {
  return authorizeCronSecret(request, {
    routeLabel,
    envNames: ["FISCAL_SYNC_SECRET", "CRON_SECRET"],
    acceptedHeaderNames: ["x-fiscal-sync-secret", "x-cron-secret"],
    allowSecretQueryParam: true,
  }).authorized;
}
