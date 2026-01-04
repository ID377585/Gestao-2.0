import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // =========================
  // SUPABASE SERVER
  // =========================
  const supabase = createSupabaseServerClient();

  // =========================
  // USUÁRIO LOGADO
  // =========================
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  // =========================
  // MEMBERSHIP ATIVO
  // =========================
  const { data: membership, error: membershipError } = await supabase
    .from("establishment_memberships")
    .select("establishment_id, role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .single();

  if (membershipError || !membership) {
    redirect("/sem-acesso");
  }

  // =========================
  // ROLES PERMITIDOS
  // =========================
  const allowedRoles = [
    "admin",
    "operacao",
    "producao",
    "estoque",
    "fiscal",
    "entrega",
  ] as const;

  if (!allowedRoles.includes(membership.role as (typeof allowedRoles)[number])) {
    redirect("/sem-acesso");
  }

  // =========================
  // LAYOUT
  // =========================
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 
        ✅ Sidebar width controlado por CSS var:
        - aberto: 16rem
        - fechado: 0rem
        A var será definida no client (Sidebar/Topbar).
        Se nada definir, o fallback fica 16rem no desktop.
      */}
      <div
        className="flex"
        style={
          {
            // fallback desktop (se seu sidebar ainda não setar a var)
            ["--sidebar-w" as any]: "16rem",
          } as React.CSSProperties
        }
      >
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
              <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
                {children}
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      <div className="md:hidden">
        {/* TODO: Implementar sidebar mobile */}
      </div>
    </div>
  );
}
