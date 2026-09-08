export default function Loading() {
  return (
    <main
      className="flex min-h-[60vh] items-center justify-center bg-gray-50 px-4 py-12 text-slate-900 dark:bg-slate-950 dark:text-slate-100"
      aria-busy="true"
    >
      <section
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-blue-100 dark:bg-blue-950" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-3 w-full animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
          </div>
        </div>
        <p className="mt-5 text-sm text-slate-600 dark:text-slate-300">
          Carregando informações do Gestify…
        </p>
      </section>
    </main>
  );
}
