import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { InventoryMonthEndReminder } from "@/components/layout/InventoryMonthEndReminder";
import {
  ensureCurrentTermsAcceptedOrRedirect,
  touchUserAuthenticatedAccess,
} from "@/lib/auth/terms-compliance.server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/tenant/get-current-tenant";
import { getAllowedMenuSectionKeysForTenant } from "@/lib/tenant/module-access";
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
  const tenant = await getCurrentTenant();

  if (!tenant) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }

    redirect("/sem-acesso");
  }

  await ensureCurrentTermsAcceptedOrRedirect({
    userId: tenant.userId,
    redirectPath: "/dashboard/pedidos",
  });

  await touchUserAuthenticatedAccess({
    userId: tenant.userId,
    path: "/dashboard",
  });

  const role = tenant.role as AllowedRole;

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

  if (role === "admin") {
    const supabase = await createSupabaseServerClient();
    const { data: aal, error: aalError } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (aalError) {
      console.error("[admin-mfa] failed to inspect assurance level:", {
        message: aalError.message,
      });
      redirect("/mfa?redirect=%2Fdashboard%2Fpedidos");
    }

    if (aal.currentLevel !== "aal2") {
      redirect("/mfa?redirect=%2Fdashboard%2Fpedidos");
    }
  }

  const allowedSectionKeys = await getAllowedMenuSectionKeysForTenant(tenant);

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
            <Sidebar allowedSectionKeys={allowedSectionKeys} />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col transition-[padding-left] duration-300 ease-in-out md:pl-[var(--sidebar-w)]">
          <Topbar allowedSectionKeys={allowedSectionKeys} />

          <InventoryMonthEndReminder />

          <main className="min-h-0 flex-1 overflow-y-auto px-3 pb-5 pt-4 sm:px-4 md:p-8 md:pt-24">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
