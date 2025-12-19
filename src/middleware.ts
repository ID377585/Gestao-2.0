import { NextRequest, NextResponse } from "next/server";
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

  /* =========================
     🔐 ROTAS PÚBLICAS
  ========================= */
  const isAuthRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password");

  // 1) Pega usuário (cookie -> supabase)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 2) Se não logado e tentando dashboard => manda pro login com redirect
  if (!user && pathname.startsWith("/dashboard")) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 3) Se logado e tentando rota de auth => manda pro dashboard
  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard/pedidos", req.url));
  }

  // 4) Se não é dashboard, deixa passar
  if (!pathname.startsWith("/dashboard")) {
    return res;
  }

  // 5) Se chegou aqui, é dashboard e usuário existe
  if (!user) return res; // segurança extra

  /* =========================
     👤 ROLE: fonte de verdade = memberships
  ========================= */

  // Fallback: metadata (caso você use isso no futuro)
  let role: Role | null =
    (user.user_metadata?.role as Role | undefined) ||
    (user.app_metadata?.role as Role | undefined) ||
    null;

  // ✅ Preferência: buscar role na tabela memberships
  // Ajuste o nome da coluna se for diferente (user_id / role / created_at)
  const { data: membership, error: membershipErr } = await supabase
    .from("memberships")
    .select("role, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!membershipErr && membership?.role) {
    role = membership.role as Role;
  }

  /* =========================
     🧭 MATRIZ DE PERMISSÕES
  ========================= */

  const roleAccess: Record<string, Role[]> = {
    "/dashboard/pedidos": [
      "admin",
      "operacao",
      "producao",
      "estoque",
      "fiscal",
      "entrega",
    ],
    "/dashboard/producao": ["admin", "producao"],
    "/dashboard/estoque": ["admin", "estoque"],
    "/dashboard/fiscal": ["admin", "fiscal"],
    "/dashboard/entrega": ["admin", "entrega"],
    "/dashboard/controladoria": ["admin"],
    "/dashboard/perdas": ["admin"],
    "/dashboard/transferencias": ["admin"],
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

/* =========================
   ⚙️ MATCHER
========================= */
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/login",
    "/forgot-password",
    "/reset-password",
  ],
};
