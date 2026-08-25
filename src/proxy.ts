import { NextResponse, type NextRequest } from "next/server";

import { middleware as runGestifyProxy } from "@/lib/network/proxy-handler";

const PROXY_TOTAL_BUDGET_MS = 8_000;

function proxyTimeoutResponse() {
  return NextResponse.json(
    {
      error: "Serviço de autenticação temporariamente indisponível.",
      code: "AUTH_UPSTREAM_TIMEOUT",
    },
    {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": "5",
      },
    }
  );
}

export default async function proxy(req: NextRequest) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const timeout = new Promise<NextResponse>((resolve) => {
      timeoutId = setTimeout(() => {
        console.error("[proxy] upstream timeout budget exceeded", {
          pathname: req.nextUrl.pathname,
          budget_ms: PROXY_TOTAL_BUDGET_MS,
        });
        resolve(proxyTimeoutResponse());
      }, PROXY_TOTAL_BUDGET_MS);
    });

    return await Promise.race([runGestifyProxy(req), timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/compras/:path*",
    "/financeiro/:path*",
    "/login",
    "/login/:path*",
    "/forgot-password",
    "/forgot-password/:path*",
    "/reset-password",
    "/reset-password/:path*",
    "/api/:path*",
  ],
};
