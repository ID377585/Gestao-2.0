import Link from "next/link";
import { Building2, CheckCircle2, ShieldCheck, Users } from "lucide-react";
import { getCurrentTenant, listCurrentUserTenants } from "@/lib/tenant/get-current-tenant";
import { getBillingPlan } from "@/lib/billing/plans";
import { getCompanySubscriptionStatus } from "@/lib/billing/subscription-status";
import type { TenantMembershipRole } from "@/lib/tenant/types";
import { createCompanyFromAdminPageAction } from "./actions";

function getRoleLabel(role?: TenantMembershipRole | string | null) {
  switch (String(role ?? "").trim()) {
    case "admin":
      return "Administrador";
    case "operacao":
      return "Operação";
    case "producao":
      return "Produção";
    case "estoque":
      return "Estoque";
    case "fiscal":
      return "Fiscal";
    case "entrega":
      return "Entrega";
    case "cliente":
      return "Cliente";
    default:
      return "Usuário";
  }
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function getTenantName(params: {
  display_name?: string | null;
  establishment_name?: string | null;
  establishment_id?: string | null;
}) {
  const displayName = String(params.display_name ?? "").trim();
  if (displayName) return displayName;

  const establishmentName = String(params.establishment_name ?? "").trim();
  if (establishmentName) return establishmentName;

  return params.establishment_id ? params.establishment_id.slice(0, 8) : "Sem empresa";
}

function isCompanyCreationEnabled() {
  return process.env.GESTIFY_ENABLE_COMPANY_CREATION === "true";
}

export default async function EmpresasPage() {
  const [currentTenant, tenants] = await Promise.all([
    getCurrentTenant(),
    listCurrentUserTenants(),
  ]);

  const activeTenants = tenants.filter(
    (tenant) => tenant.is_active && tenant.establishment_id
  );
  const canCreateCompany =
    isCompanyCreationEnabled() && currentTenant?.role === "admin";

  const subscriptionByEstablishmentId = new Map<
    string,
    Awaited<ReturnType<typeof getCompanySubscriptionStatus>>
  >();

  await Promise.all(
    activeTenants.map(async (tenant) => {
      if (!tenant.establishment_id) return;
      const subscription = await getCompanySubscriptionStatus(tenant.establishment_id);
      subscriptionByEstablishmentId.set(tenant.establishment_id, subscription);
    })
  );

  return (
    <main className="space-y-6 p-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-blue-50 p-3 text-blue-700 dark:bg-slate-800 dark:text-blue-300">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-slate-100">
              Minhas empresas
            </h1>
            <p className="text-sm text-gray-600 dark:text-slate-400">
              Consulte as empresas vinculadas ao seu usuário e cadastre novas empresas de forma controlada.
            </p>
          </div>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-gray-500 dark:text-slate-400">Empresas ativas</p>
              <h2 className="mt-1 text-2xl font-semibold text-gray-900 dark:text-slate-100">
                {activeTenants.length}
              </h2>
            </div>
            <Building2 className="h-5 w-5 text-gray-400" />
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-gray-500 dark:text-slate-400">Empresa ativa</p>
              <h2 className="mt-1 truncate text-lg font-semibold text-gray-900 dark:text-slate-100">
                {currentTenant?.displayName ?? currentTenant?.establishmentName ?? "Não carregada"}
              </h2>
            </div>
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-gray-500 dark:text-slate-400">Modo</p>
              <h2 className="mt-1 text-lg font-semibold text-gray-900 dark:text-slate-100">
                Multiempresa controlado
              </h2>
            </div>
            <ShieldCheck className="h-5 w-5 text-blue-500" />
          </div>
          <p className="mt-3 text-sm text-gray-600 dark:text-slate-400">
            A criação de novas empresas fica liberada apenas em ambiente controlado.
          </p>
        </div>
      </section>

      {canCreateCompany ? (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
              Cadastrar nova empresa
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
              A nova empresa será vinculada ao seu usuário como administrador, com permissões padrão e assinatura inicial.
            </p>
          </div>

          <form action={createCompanyFromAdminPageAction} className="grid gap-4 md:grid-cols-[1fr_220px_auto] md:items-end">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-slate-300" htmlFor="company-name">
                Nome da empresa
              </label>
              <input
                id="company-name"
                name="name"
                type="text"
                required
                maxLength={120}
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-blue-950"
                placeholder="Ex.: Santino"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-slate-300" htmlFor="plan-slug">
                Plano inicial
              </label>
              <select
                id="plan-slug"
                name="plan_slug"
                defaultValue="starter"
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-blue-950"
              >
                <option value="starter">Starter</option>
                <option value="growth">Growth</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>

            <div className="flex flex-col gap-3 md:items-end">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
                <input name="select_as_active" type="checkbox" className="h-4 w-4 rounded border-gray-300" />
                Ativar após criar
              </label>
              <button
                type="submit"
                className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                Criar empresa
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="border-b border-gray-200 p-5 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
            Vínculos do usuário
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
            A troca de empresa ativa continua disponível no seletor do topo quando houver mais de uma empresa.
          </p>
        </div>

        {activeTenants.length === 0 ? (
          <div className="p-6 text-sm text-gray-600 dark:text-slate-400">
            Nenhuma empresa ativa encontrada para o seu usuário.
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-slate-800">
            {activeTenants.map((tenant) => {
              const tenantName = getTenantName(tenant);
              const isCurrent =
                Boolean(currentTenant?.establishmentId) &&
                currentTenant?.establishmentId === tenant.establishment_id;
              const subscription = tenant.establishment_id
                ? subscriptionByEstablishmentId.get(tenant.establishment_id)
                : null;
              const plan = getBillingPlan(subscription?.planSlug ?? null);

              return (
                <div
                  key={tenant.id}
                  className="grid gap-4 p-5 md:grid-cols-[1.4fr_0.8fr_0.8fr_auto] md:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-base font-semibold text-gray-900 dark:text-slate-100">
                        {tenantName}
                      </h3>
                      {isCurrent ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                          Ativa agora
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 break-all text-xs text-gray-500 dark:text-slate-400">
                      {tenant.establishment_id}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 dark:text-slate-400">Perfil</p>
                    <p className="mt-1 text-sm font-medium text-gray-900 dark:text-slate-100">
                      {getRoleLabel(tenant.role)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 dark:text-slate-400">Vinculado em</p>
                    <p className="mt-1 text-sm font-medium text-gray-900 dark:text-slate-100">
                      {formatDate(tenant.created_at)}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 md:items-end">
                    <span className="inline-flex w-fit items-center gap-1 rounded-full border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 dark:border-slate-700 dark:text-slate-300">
                      <Users className="h-3 w-3" />
                      {plan?.name ?? "Plano não configurado"}
                    </span>
                    {tenant.establishment_id ? (
                      <Link
                        href="/dashboard/admin/assinatura"
                        className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-300"
                      >
                        Ver assinatura
                      </Link>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
