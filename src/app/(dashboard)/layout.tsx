import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Sidebar (Desktop) */}
        <aside className="hidden md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col">
          <div className="flex min-h-0 flex-1 flex-col bg-white border-r border-gray-200">
            <Sidebar />
          </div>
        </aside>

        {/* Conteúdo principal */}
        <div className="flex min-w-0 flex-1 flex-col md:pl-64">
          {/* Topbar: precisa ficar acima de tudo para não perder clique */}
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
        {/* TODO: Implementar sidebar mobile com overlay */}
      </div>
    </div>
  );
}
