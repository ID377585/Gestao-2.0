import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

type Role =
  | "cliente"
  | "operacao"
  | "producao"
  | "estoque"
  | "fiscal"
  | "admin"
  | "entrega";

function isRouteOrChild(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(route + "/");
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

  // Rotas públicas
  const isAuthRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password");

  // Pega usuário via cookie
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Não logado tentando dashboard -> login
  if (!user && pathname.startsWith("/dashboard")) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Logado indo para auth routes -> manda pro dashboard
  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard/pedidos", req.url));
  }

  // Se não é dashboard, libera
  if (!pathname.startsWith("/dashboard")) return res;

  // Role fallback (metadata)
  let role: Role | null =
    (user?.user_metadata?.role as Role | undefined) ||
    (user?.app_metadata?.role as Role | undefined) ||
    null;

  // Preferência: role na tabela memberships
  if (user) {
    const { data: membership } = await supabase
      .from("memberships")
      .select("role, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (membership?.role) role = membership.role as Role;
  }

  // Matriz de acesso (ajuste se quiser)
  const roleAccess: Record<string, Role[]> = {
    "/dashboard/pedidos": ["admin", "operacao", "producao", "estoque", "fiscal", "entrega"],
    "/dashboard/producao": ["admin", "producao"],
    "/dashboard/estoque": ["admin", "estoque"],
    "/dashboard/controladoria": ["admin"],
    "/dashboard/perdas": ["admin"],
    "/dashboard/transferencias": ["admin"],
    "/dashboard/admin": ["admin"],
  };

  for (const route of Object.keys(roleAccess)) {
    if (isRouteOrChild(pathname, route)) {
      const allowedRoles = roleAccess[route];
      if (!role || !allowedRoles.includes(role)) {
        return NextResponse.redirect(
          new URL("/dashboard/pedidos?erro=sem-permissao", req.url)
        );
      }
    }
  }

  return res;
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/forgot-password", "/reset-password"],
};
