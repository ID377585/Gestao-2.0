import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type AllowedRole =
  | "admin"
  | "operacao"
  | "producao"
  | "estoque"
  | "fiscal"
  | "entrega";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createSupabaseServerClient();

  // =========================
  // USUÁRIO LOGADO (robusto)
  // =========================
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  // =========================
  // MEMBERSHIP ATIVO (ROBUSTO - FONTE ÚNICA)
  // ✅ Usa SOMENTE public.memberships
  // Motivo: establishment_memberships está com RLS em recursão (42P17)
  // =========================
  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("role, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (membershipError || !membership?.role) {
    console.error("Membership check failed (memberships):", {
      message: membershipError?.message,
      code: (membershipError as any)?.code,
      user_id: user.id,
      email: user.email,
    });
    redirect("/sem-acesso");
  }

  const role = membership.role as AllowedRole;

  // =========================
  // ROLES PERMITIDOS
  // =========================
  const allowedRoles: AllowedRole[] = [
    "admin",
    "operacao",
    "producao",
    "estoque",
    "fiscal",
    "entrega",
  ];

  if (!allowedRoles.includes(role)) {
    redirect("/sem-acesso");
  }

  // =========================
  // LAYOUT (mantido 100%)
  // =========================
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Sidebar (Desktop) */}
        <aside
          className="
            hidden md:fixed md:inset-y-0 md:flex md:flex-col
            border-r border-gray-200 bg-white
          "
          style={{
            width: "var(--sidebar-w)",
            transition: "width 300ms ease",
            overflow: "hidden",
          }}
        >
          <div className="flex min-h-0 flex-1 flex-col">
            <Sidebar />
          </div>
        </aside>

        {/* Conteúdo principal */}
        <div
          className="flex min-w-0 flex-1 flex-col"
          style={{
            paddingLeft: "var(--sidebar-w)",
            transition: "padding-left 300ms ease",
          }}
        >
          {/* Topbar */}
          <div className="sticky top-0 z-50 pointer-events-auto">
            <Topbar />
          </div>

          {/* Main */}
          <main className="relative z-0 flex-1 overflow-y-auto focus:outline-none">
            <div className="py-6">
              {/* ✅ mantém seu ajuste para expandir a largura quando recolhe o sidebar */}
              <div className="w-full px-4 sm:px-6 md:px-8">{children}</div>
            </div>
          </main>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      <div className="md:hidden">{/* TODO: Implementar sidebar mobile */}</div>
    </div>
  );
}
