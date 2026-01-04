export default function DashboardShellSkeleton() {
  return (
    <div className="min-h-[calc(100vh-0px)] bg-gray-50">
      {/* Topbar fake (sem linhas escuras) */}
      <div className="sticky top-0 z-50 h-16 bg-white border-b border-gray-100" />

      <div className="py-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
          <div className="animate-pulse space-y-6">
            {/* Header */}
            <div className="space-y-3">
              <div className="h-6 w-40 rounded bg-gray-200/80" />
              <div className="h-4 w-80 rounded bg-gray-200/60" />
            </div>

            {/* Cards */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
                <div className="p-6 space-y-4">
                  <div className="h-4 w-32 rounded bg-gray-200/80" />
                  <div className="h-3 w-full rounded bg-gray-200/60" />
                  <div className="h-3 w-5/6 rounded bg-gray-200/60" />
                  <div className="h-3 w-2/3 rounded bg-gray-200/60" />
                </div>
              </div>

              <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
                <div className="p-6 space-y-4">
                  <div className="h-4 w-32 rounded bg-gray-200/80" />
                  <div className="h-3 w-full rounded bg-gray-200/60" />
                  <div className="h-3 w-5/6 rounded bg-gray-200/60" />
                  <div className="h-3 w-2/3 rounded bg-gray-200/60" />
                </div>
              </div>
            </div>

            {/* “Tabela” fake (SEM borda preta) */}
            <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
              <div className="p-6 space-y-4">
                <div className="h-4 w-36 rounded bg-gray-200/80" />

                {/* linhas da tabela - usamos bg claro, sem border */}
                <div className="space-y-3">
                  <div className="h-10 w-full rounded bg-gray-200/40" />
                  <div className="h-10 w-full rounded bg-gray-200/40" />
                  <div className="h-10 w-full rounded bg-gray-200/40" />
                  <div className="h-10 w-full rounded bg-gray-200/40" />
                </div>
              </div>
            </div>

            {/* Rodapé fake */}
            <div className="h-10 w-48 rounded bg-gray-200/60" />
          </div>
        </div>
      </div>
    </div>
  );
}
