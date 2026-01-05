import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

function isAuthRoute(pathname: string) {
  return (
    pathname.startsWith("/login") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password")
  );
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          res.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          res.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const pathname = req.nextUrl.pathname;

  // ✅ Mais confiável/leve que getUser no middleware
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Não logado tentando dashboard -> login
  if (!session && pathname.startsWith("/dashboard")) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Logado indo para login/forgot/reset -> manda pro dashboard
  if (session && isAuthRoute(pathname)) {
    return NextResponse.redirect(new URL("/dashboard/pedidos", req.url));
  }

  // ✅ NÃO validar role/membership aqui
  return res;
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/forgot-password", "/reset-password"],
};
