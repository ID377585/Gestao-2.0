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
  // LAYOUT (mantido 100% no desktop / corrigido no mobile)
  // =========================
  return (
    // ✅ MOBILE: vira viewport fixa (evita pull-to-refresh no body)
    <div className="h-[100dvh] md:min-h-screen bg-gray-50 overflow-hidden md:overflow-visible">
      {/* ✅ MOBILE: garante altura total para o <main> rolar por dentro */}
      <div className="flex h-full">
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

        {/* ✅ Spacer SOMENTE no desktop para reservar o espaço do sidebar */}
        <div
          className="hidden md:block shrink-0"
          style={{
            width: "var(--sidebar-w)",
            transition: "width 300ms ease",
          }}
        />

        {/* Conteúdo principal */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Topbar */}
          {/* ✅ Ajuste mínimo: reduz z-index do header sticky para não cobrir popovers/dropdowns */}
          <div className="sticky top-0 z-40 pointer-events-auto shrink-0">
            <Topbar />
          </div>

          {/* Main */}
          {/* ✅ MOBILE: scroll aqui + impede overscroll/pull-to-refresh */}
          <main className="relative z-0 flex-1 overflow-y-auto overscroll-y-contain touch-pan-y focus:outline-none">
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
