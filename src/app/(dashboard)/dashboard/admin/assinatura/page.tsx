import {
  Activity,
  BadgeDollarSign,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Gauge,
  LockKeyhole,
  ShieldAlert,
} from "lucide-react";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";
import {
  getLimitWarning,
  getLimitWarningClassName,
} from "@/lib/billing/limit-warnings";
import { formatBillingPrice, getBillingPlan } from "@/lib/billing/plans";
import { getCompanySubscriptionStatus } from "@/lib/billing/subscription-status";
import { getCompanyPlanUsage, type PlanUsageMetric } from "@/lib/billing/usage-limits";

function getStatusLabel(status: string) {
  switch (status) {
    case "trialing":
      return "Período de teste";
    case "active":
      return "Assinatura ativa";
    case "past_due":
      return "Pagamento pendente";
    case "canceled":
      return "Assinatura cancelada";
    case "blocked":
      return "Acesso bloqueado";
    case "not_configured":
      return "Cobrança ainda não configurada";
    default:
      return "Status desconhecido";
  }
}

function formatDate(value?: string | null) {
  if (!value) return "Não definido";

  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "medium",
    }).format(new Date(value));
  } catch {
    return "Não definido";
  }
}

function formatLimit(metric: PlanUsageMetric) {
  if (metric.isUnlimited) return `${metric.used} de ilimitado`;
  return `${metric.used} de ${metric.limit}`;
}

export default async function AssinaturaPage() {
  const ctx = await getActiveMembershipOrRedirect();
  const establishmentId = ctx.establishmentId;

  const subscription = establishmentId
    ? await getCompanySubscriptionStatus(establishmentId)
    : null;

  const plan = getBillingPlan(subscription?.planSlug ?? null);
  const usage = establishmentId
    ? await getCompanyPlanUsage({ establishmentId, plan })
    : null;

  return (
    <main className="space-y-6 p-6">
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-blue-50 p-3 text-blue-700 dark:bg-slate-800 dark:text-blue-300">
              <BadgeDollarSign className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">
                Central SaaS
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-gray-900 dark:text-slate-100">
                Assinatura e plano
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-gray-600 dark:text-slate-400">
                Acompanhe a assinatura da empresa ativa, monitore os limites do plano e mantenha a operação dentro das regras comerciais do Gestify.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 px-4 py-3 text-sm dark:border-slate-800">
            <p className="text-xs text-gray-500 dark:text-slate-400">Empresa ativa</p>
            <p className="mt-1 font-semibold text-gray-900 dark:text-slate-100">
              Controle por tenant
            </p>
          </div>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-gray-500 dark:text-slate-400">Plano atual</p>
              <h2 className="mt-1 text-xl font-semibold text-gray-900 dark:text-slate-100">
                {plan?.name ?? "Não configurado"}
              </h2>
            </div>
            <CreditCard className="h-5 w-5 text-gray-400" />
          </div>
          <p className="mt-2 text-sm font-medium text-gray-900 dark:text-slate-100">
            {formatBillingPrice(plan)}
            {plan?.monthlyPriceInCents ? " / mês" : ""}
          </p>
          <p className="mt-3 text-sm text-gray-600 dark:text-slate-400">
            {plan?.description ?? "A empresa ainda não possui um plano comercial vinculado."}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-gray-500 dark:text-slate-400">Status</p>
              <h2 className="mt-1 text-xl font-semibold text-gray-900 dark:text-slate-100">
                {getStatusLabel(subscription?.status ?? "not_configured")}
              </h2>
            </div>
            {subscription?.canAccessSystem === false ? (
              <ShieldAlert className="h-5 w-5 text-red-500" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            )}
          </div>
          <p className="mt-3 text-sm text-gray-600 dark:text-slate-400">
            {subscription?.canAccessSystem === false
              ? "Esta empresa está sem acesso conforme o controle de assinatura."
              : "O acesso está liberado para a empresa ativa conforme o status atual."}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-gray-500 dark:text-slate-400">Próxima renovação</p>
              <h2 className="mt-1 text-xl font-semibold text-gray-900 dark:text-slate-100">
                {formatDate(subscription?.currentPeriodEnd)}
              </h2>
            </div>
            <CalendarDays className="h-5 w-5 text-gray-400" />
          </div>
          <p className="mt-3 text-sm text-gray-600 dark:text-slate-400">
            Data vinculada ao período vigente da assinatura quando disponível.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
              Uso e limites do plano
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
              Monitore a ocupação do plano em tempo real e antecipe ajustes antes de atingir os limites contratados.
            </p>
          </div>
          <Gauge className="h-5 w-5 text-gray-400" />
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {(usage?.metrics ?? []).map((metric) => {
            const warning = getLimitWarning(metric);

            return (
              <div
                key={metric.key}
                className="rounded-xl border border-gray-200 p-4 dark:border-slate-800"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-slate-400">
                      {metric.label}
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-slate-100">
                      {formatLimit(metric)}
                    </p>
                  </div>
                  {warning.severity === "danger" || warning.severity === "warning" ? (
                    <ShieldAlert className="h-5 w-5 text-amber-500" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  )}
                </div>

                {metric.percentage !== null ? (
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-blue-600"
                      style={{ width: `${metric.percentage}%` }}
                    />
                  </div>
                ) : null}

                <div
                  className={`mt-4 rounded-lg border px-3 py-2 text-xs ${getLimitWarningClassName(
                    warning.severity
                  )}`}
                >
                  <p className="font-semibold">{warning.title}</p>
                  <p className="mt-1 opacity-90">{warning.message}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
              Governança do plano
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-gray-600 dark:text-slate-400">
              A base de assinatura já está estruturada para operação multiempresa, controle de acesso, limites comerciais e auditoria por tenant.
            </p>
          </div>
          <Activity className="h-5 w-5 text-gray-400" />
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-gray-200 p-4 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <h3 className="font-medium text-gray-900 dark:text-slate-100">
                Operação ativa
              </h3>
            </div>
            <ul className="mt-3 space-y-2 text-sm text-gray-600 dark:text-slate-400">
              <li>Empresa ativa identificada por tenant.</li>
              <li>Status de assinatura aplicado por empresa.</li>
              <li>Planos Starter, Growth e Enterprise configurados.</li>
            </ul>
          </div>

          <div className="rounded-xl border border-gray-200 p-4 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-blue-500" />
              <h3 className="font-medium text-gray-900 dark:text-slate-100">
                Limites e avisos
              </h3>
            </div>
            <ul className="mt-3 space-y-2 text-sm text-gray-600 dark:text-slate-400">
              <li>Uso atual comparado automaticamente aos limites do plano.</li>
              <li>Alertas reutilizáveis em 80%, 90% e 100% de uso.</li>
              <li>Avisos integrados aos fluxos de usuários e produtos.</li>
            </ul>
          </div>

          <div className="rounded-xl border border-gray-200 p-4 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <LockKeyhole className="h-4 w-4 text-slate-500" />
              <h3 className="font-medium text-gray-900 dark:text-slate-100">
                Controle e auditoria
              </h3>
            </div>
            <ul className="mt-3 space-y-2 text-sm text-gray-600 dark:text-slate-400">
              <li>Base para auditoria global por empresa.</li>
              <li>Bloqueio de acesso respeitando o status da assinatura.</li>
              <li>Estrutura pronta para conciliação com checkout, portal e webhooks.</li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
