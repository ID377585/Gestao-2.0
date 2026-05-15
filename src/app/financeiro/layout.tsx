import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import {
  ensureCurrentTermsAcceptedOrRedirect,
  touchUserAuthenticatedAccess,
} from "@/lib/auth/terms-compliance.server";
import { requireModuleAccess } from "@/lib/auth/module-access.server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

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

  await ensureCurrentTermsAcceptedOrRedirect({
    userId: user.id,
    redirectPath: "/financeiro",
  });
  await touchUserAuthenticatedAccess({
    userId: user.id,
    path: "/financeiro",
  });

  const access = await requireModuleAccess(user.id, "financeiro");

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
            <Sidebar modulePermissions={access.permissions} />
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
