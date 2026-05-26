import Link from "next/link";

export default function EngenhariaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="no-print border-b border-emerald-100 bg-emerald-50/90 px-4 py-3 text-slate-950 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-emerald-50/70">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-700">
              Engenharia
            </p>
            <p className="text-sm font-semibold text-slate-800">
              Nova área disponível: Tabela Nutricional das fichas técnicas.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/engenharia/tabela-nutricional"
              className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-800"
            >
              Tabela Nutricional
            </Link>
            <Link
              href="/engenharia/tabela-nutricional/produtos"
              className="rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-bold text-emerald-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-50"
            >
              Cadastrar Nutrientes
            </Link>
          </div>
        </div>
      </div>

      {children}
    </div>
  );
}
