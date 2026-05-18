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

export default async function ComprasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  await ensureCurrentTermsAcceptedOrRedirect({
    userId: user.id,
    redirectPath: "/compras",
  });
  await touchUserAuthenticatedAccess({
    userId: user.id,
    path: "/compras",
  });

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
            overflow: "visible",
            zIndex: 50,
          }}
        >
          <div className="flex min-h-0 flex-1 flex-col">
            <Sidebar />
          </div>
        </aside>

        <div
          className="flex min-w-0 flex-1 flex-col"
          style={{
            paddingLeft: "var(--sidebar-w)",
            transition: "padding-left 300ms ease",
          }}
        >
          <Topbar />
          <main className="min-h-0 flex-1 overflow-y-auto p-4 pt-20 md:p-8 md:pt-24">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
