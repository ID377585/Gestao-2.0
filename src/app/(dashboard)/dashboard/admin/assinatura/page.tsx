import {
  BadgeDollarSign,
  CalendarDays,
  CheckCircle2,
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
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-blue-50 p-3 text-blue-700 dark:bg-slate-800 dark:text-blue-300">
            <BadgeDollarSign className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-slate-100">
              Assinatura e plano
            </h1>
            <p className="text-sm text-gray-600 dark:text-slate-400">
              Acompanhe o plano da empresa ativa e prepare a cobrança mensal do Gestify.
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
            <BadgeDollarSign className="h-5 w-5 text-gray-400" />
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
              ? "Esta empresa está marcada como sem acesso no controle de assinatura."
              : "O acesso permanece liberado nesta etapa de preparação SaaS."}
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
            Esse campo será preenchido quando a integração de cobrança estiver ativa.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
          Uso e limites do plano
        </h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
          Nesta etapa os limites são apenas informativos. Nenhum cadastro será bloqueado automaticamente.
        </p>

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
        <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
          Preparação para cobrança mensal
        </h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-gray-200 p-4 dark:border-slate-800">
            <h3 className="font-medium text-gray-900 dark:text-slate-100">Pronto nesta etapa</h3>
            <ul className="mt-2 space-y-1 text-sm text-gray-600 dark:text-slate-400">
              <li>Empresa ativa por tenant</li>
              <li>Status de assinatura por empresa</li>
              <li>Planos Starter, Growth e Enterprise</li>
              <li>Uso atual comparado aos limites do plano</li>
              <li>Avisos reutilizáveis para 80%, 90% e 100% de uso</li>
              <li>Base para auditoria global por empresa</li>
            </ul>
          </div>

          <div className="rounded-xl border border-gray-200 p-4 dark:border-slate-800">
            <h3 className="font-medium text-gray-900 dark:text-slate-100">Próximos passos</h3>
            <ul className="mt-2 space-y-1 text-sm text-gray-600 dark:text-slate-400">
              <li>Integrar checkout/portal de pagamento</li>
              <li>Criar webhooks de assinatura</li>
              <li>Exibir avisos nos formulários de usuários e produtos</li>
              <li>Bloquear novos cadastros apenas após validação em produção</li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
