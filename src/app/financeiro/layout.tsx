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

export default async function FinanceiroLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("role, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (membershipError || !membership?.role) {
    redirect("/sem-acesso");
  }

  const role = membership.role as AllowedRole;

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

  return (
    <div className="h-[100dvh] overflow-hidden bg-gray-50 text-gray-900 dark:bg-slate-950 dark:text-slate-100 md:min-h-screen md:overflow-visible">
      <div className="flex h-full">
        <aside
          className="
            hidden md:fixed md:inset-y-0 md:flex md:flex-col
            border-r border-gray-200 bg-white
            dark:border-slate-800 dark:bg-slate-950
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

        <div
          className="hidden shrink-0 md:block"
          style={{
            width: "var(--sidebar-w)",
            transition: "width 300ms ease",
          }}
        />

        <div className="flex min-w-0 flex-1 flex-col bg-gray-50 text-gray-900 dark:bg-slate-950 dark:text-slate-100">
          <div className="sticky top-0 z-40 shrink-0 pointer-events-auto">
            <Topbar />
          </div>

          <main className="relative z-0 flex-1 overflow-y-auto overscroll-y-contain bg-gray-50 dark:bg-slate-950 touch-pan-y focus:outline-none">
            <div className="py-6">
              <div className="w-full px-4 sm:px-6 md:px-8">{children}</div>
            </div>
          </main>
        </div>
      </div>

      <div className="md:hidden">{/* mobile shell */}</div>
    </div>
  );
}
