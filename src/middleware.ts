import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthenticated = Boolean(request.cookies.get("auth-session")?.value);

  // Protege dashboard
  if (pathname.startsWith("/dashboard") && !isAuthenticated) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // Se já estiver logado, evita voltar pro login
  if (pathname === "/login" && isAuthenticated) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard/pedidos";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
