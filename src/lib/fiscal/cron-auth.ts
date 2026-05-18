import "server-only";

import { type NextRequest } from "next/server";

export function isFiscalCronAuthorized(
  request: NextRequest,
  routeLabel = "rota fiscal"
) {
  const configuredSecrets = [
    process.env.FISCAL_SYNC_SECRET,
    process.env.CRON_SECRET,
  ].filter((value): value is string => Boolean(value));

  if (configuredSecrets.length === 0) {
    console.error(
      `${routeLabel}: FISCAL_SYNC_SECRET ou CRON_SECRET não configurado.`
    );
    return false;
  }

  const headerSecret = request.headers.get("x-fiscal-sync-secret");
  const bearer = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  const querySecret = request.nextUrl.searchParams.get("secret");

  return [headerSecret, bearer, querySecret].some(
    (value) => typeof value === "string" && configuredSecrets.includes(value)
  );
}
