import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  CircleSlash,
  ShieldAlert,
} from "lucide-react";

type CompanyRiskAlertsProps = {
  attentionCount: number;
  restrictedCount: number;
  notConfiguredCount: number;
};

export function CompanyRiskAlerts({
  attentionCount,
  restrictedCount,
  notConfiguredCount,
}: CompanyRiskAlertsProps) {
  const hasRisks = attentionCount > 0 || restrictedCount > 0 || notConfiguredCount > 0;

  if (!hasRisks) {
    return (
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900 shadow-sm dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <h2 className="font-semibold">Nenhum alerta crítico de empresas</h2>
            <p className="mt-1 text-sm opacity-90">
              As empresas vinculadas estão sem pendências críticas de assinatura ou configuração neste momento.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950 shadow-sm dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <h2 className="font-semibold">Atenção necessária em empresas</h2>
            <p className="mt-1 text-sm opacity-90">
              Existem empresas que precisam de revisão de assinatura, liberação ou configuração comercial.
            </p>
          </div>
        </div>

        <Link
          href="/dashboard/admin/assinatura"
          className="inline-flex w-fit items-center justify-center rounded-xl bg-amber-800 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          Revisar assinatura
        </Link>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {attentionCount > 0 ? (
          <Link
            href="/dashboard/admin/empresas?status=past_due"
            aria-label={`Filtrar ${attentionCount} empresa${attentionCount === 1 ? "" : "s"} com pagamento pendente`}
            className="rounded-xl border border-amber-300 bg-white/60 p-4 hover:bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 dark:border-amber-800 dark:bg-amber-950/30 dark:hover:bg-amber-950/50"
          >
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4" />
              Pagamento pendente
            </div>
            <p className="mt-2 text-2xl font-semibold">{attentionCount}</p>
            <p className="mt-1 text-xs opacity-80">Clique para filtrar empresas em atenção.</p>
          </Link>
        ) : null}

        {restrictedCount > 0 ? (
          <div className="rounded-xl border border-red-300 bg-white/60 p-4 text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
            <div className="flex items-center gap-2 font-medium">
              <ShieldAlert className="h-4 w-4" />
              Restritas
            </div>
            <p className="mt-2 text-2xl font-semibold">{restrictedCount}</p>
            <p className="mt-1 text-xs opacity-80">Bloqueadas ou canceladas exigem validação.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href="/dashboard/admin/empresas?status=blocked"
                className="rounded-lg bg-red-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-400"
              >
                Ver bloqueadas
              </Link>
              <Link
                href="/dashboard/admin/empresas?status=canceled"
                className="rounded-lg border border-red-300 px-2.5 py-1.5 text-xs font-semibold text-red-900 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400 dark:border-red-800 dark:text-red-200 dark:hover:bg-red-950/50"
              >
                Ver canceladas
              </Link>
            </div>
          </div>
        ) : null}

        {notConfiguredCount > 0 ? (
          <Link
            href="/dashboard/admin/empresas?status=not_configured"
            aria-label={`Filtrar ${notConfiguredCount} empresa${notConfiguredCount === 1 ? "" : "s"} sem assinatura configurada`}
            className="rounded-xl border border-gray-300 bg-white/60 p-4 text-gray-800 hover:bg-white focus:outline-none focus:ring-2 focus:ring-gray-400 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-200 dark:hover:bg-slate-900"
          >
            <div className="flex items-center gap-2 font-medium">
              <CircleSlash className="h-4 w-4" />
              Não configuradas
            </div>
            <p className="mt-2 text-2xl font-semibold">{notConfiguredCount}</p>
            <p className="mt-1 text-xs opacity-80">Empresas sem assinatura configurada.</p>
          </Link>
        ) : null}
      </div>
    </section>
  );
}
