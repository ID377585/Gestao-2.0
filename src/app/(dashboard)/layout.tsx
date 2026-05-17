import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import {
  ensureCurrentTermsAcceptedOrRedirect,
  touchUserAuthenticatedAccess,
} from "@/lib/auth/terms-compliance.server";
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

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  await ensureCurrentTermsAcceptedOrRedirect({
    userId: user.id,
    redirectPath: "/dashboard/pedidos",
    appMetadata: user.app_metadata as Record<string, unknown> | undefined,
  });
  await touchUserAuthenticatedAccess({
    userId: user.id,
    path: "/dashboard",
  });

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
            overflow: "visible",
            zIndex: 50,
          }}
        >
          <Sidebar />
        </aside>

        <main
          className="flex min-w-0 flex-1 flex-col md:min-h-screen"
          style={{
            marginLeft: "var(--sidebar-w)",
            transition: "margin-left 300ms ease",
          }}
        >
          <Topbar />
          <section className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-6">
            {children}
          </section>
        </main>
      </div>
    </div>
  );
}
