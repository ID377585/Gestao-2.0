import Link from "next/link";
import {
  BarChart3,
  Building2,
  CheckCircle2,
  CircleSlash,
  Factory,
  HeartPulse,
  Info,
  Search,
  ShieldCheck,
  Users,
  XCircle,
} from "lucide-react";
import { getCurrentTenant, listCurrentUserTenants } from "@/lib/tenant/get-current-tenant";
import { getBillingPlan } from "@/lib/billing/plans";
import { getCompanySubscriptionStatus } from "@/lib/billing/subscription-status";
import type { TenantMembershipRole } from "@/lib/tenant/types";
import { CompanyRowActions } from "./CompanyRowActions";
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

function getStatusLabel(status?: string | null) {
  switch (String(status ?? "not_configured").trim()) {
    case "trialing":
      return "Teste";
    case "active":
      return "Ativa";
    case "past_due":
      return "Pagamento pendente";
    case "canceled":
      return "Cancelada";
    case "blocked":
      return "Bloqueada";
    case "not_configured":
      return "Não configurada";
    default:
      return "Status desconhecido";
  }
}

function getStatusClassName(status?: string | null) {
  switch (String(status ?? "not_configured").trim()) {
    case "active":
    case "trialing":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300";
    case "past_due":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300";
    case "blocked":
    case "canceled":
      return "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300";
    default:
      return "border-gray-200 bg-gray-50 text-gray-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300";
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

function getQueryValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function shortId(value?: string | null) {
  const id = String(value ?? "").trim();
  if (!id) return "—";
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}...${id.slice(-4)}`;
}

function percentage(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function isCompanyCreationEnabled() {
  return process.env.GESTIFY_ENABLE_COMPANY_CREATION === "true";
}

export default async function EmpresasPage({
  searchParams,
}: {
  searchParams?: Promise<{
    q?: string | string[];
    plan?: string | string[];
    status?: string | string[];
    created?: string | string[];
  }>;
}) {
  const resolvedSearchParams = await searchParams;
  const [currentTenant, tenants] = await Promise.all([
    getCurrentTenant(),
    listCurrentUserTenants(),
  ]);

  const activeTenants = tenants.filter(
    (tenant) => tenant.is_active && tenant.establishment_id
  );
  const companyCreationEnabled = isCompanyCreationEnabled();
  const canCreateCompany = companyCreationEnabled && currentTenant?.role === "admin";

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

  const q = getQueryValue(resolvedSearchParams?.q).trim().toLowerCase();
  const planFilter = getQueryValue(resolvedSearchParams?.plan).trim();
  const statusFilter = getQueryValue(resolvedSearchParams?.status).trim();
  const created = getQueryValue(resolvedSearchParams?.created).trim() === "1";
  const hasFilters = Boolean(q || planFilter || statusFilter);

  const activeSubscriptionCount = activeTenants.filter((tenant) => {
    const subscription = tenant.establishment_id
      ? subscriptionByEstablishmentId.get(tenant.establishment_id)
      : null;
    return subscription?.status === "active" || subscription?.status === "trialing";
  }).length;

  const withoutPlanCount = activeTenants.filter((tenant) => {
    const subscription = tenant.establishment_id
      ? subscriptionByEstablishmentId.get(tenant.establishment_id)
      : null;
    const plan = getBillingPlan(subscription?.planSlug ?? null);
    return !plan;
  }).length;

  const planCounts = activeTenants.reduce(
    (acc, tenant) => {
      const subscription = tenant.establishment_id
        ? subscriptionByEstablishmentId.get(tenant.establishment_id)
        : null;
      const plan = getBillingPlan(subscription?.planSlug ?? null);
      const key = plan?.slug === "growth" || plan?.slug === "enterprise" ? plan.slug : plan?.slug === "starter" ? "starter" : "not_configured";
      acc[key] += 1;
      return acc;
    },
    { starter: 0, growth: 0, enterprise: 0, not_configured: 0 }
  );

  const statusCounts = activeTenants.reduce(
    (acc, tenant) => {
      const subscription = tenant.establishment_id
        ? subscriptionByEstablishmentId.get(tenant.establishment_id)
        : null;
      const status = String(subscription?.status ?? "not_configured");
      if (status === "active" || status === "trialing") acc.ok += 1;
      else if (status === "past_due") acc.attention += 1;
      else if (status === "blocked" || status === "canceled") acc.restricted += 1;
      else acc.notConfigured += 1;
      return acc;
    },
    { ok: 0, attention: 0, restricted: 0, notConfigured: 0 }
  );

  const filteredTenants = activeTenants.filter((tenant) => {
    const tenantName = getTenantName(tenant).toLowerCase();
    const subscription = tenant.establishment_id
      ? subscriptionByEstablishmentId.get(tenant.establishment_id)
      : null;
    const plan = getBillingPlan(subscription?.planSlug ?? null);
    const status = String(subscription?.status ?? "not_configured");
    const planSlug = String(subscription?.planSlug ?? "not_configured");

    const matchesQuery =
      !q ||
      tenantName.includes(q) ||
      String(tenant.establishment_id ?? "").toLowerCase().includes(q);
    const matchesPlan = !planFilter || planFilter === planSlug || (!plan && planFilter === "not_configured");
    const matchesStatus = !statusFilter || statusFilter === status;

    return matchesQuery && matchesPlan && matchesStatus;
  });

  return (
    <main className="space-y-6 p-6">
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-blue-50 p-3 text-blue-700 dark:bg-slate-800 dark:text-blue-300">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">
                Central multiempresa
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-gray-900 dark:text-slate-100">
                Empresas e unidades
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-gray-600 dark:text-slate-400">
                Gerencie os vínculos multiempresa, acompanhe planos, permissões e status operacional de cada tenant.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 px-4 py-3 text-sm dark:border-slate-800">
            <p className="text-xs text-gray-500 dark:text-slate-400">Seu perfil atual</p>
            <p className="mt-1 font-semibold text-gray-900 dark:text-slate-100">
              {getRoleLabel(currentTenant?.role)}
            </p>
          </div>
        </div>
      </div>

      {created ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          Empresa criada com sucesso. Os vínculos, permissões padrão e assinatura inicial foram preparados.
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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
              <p className="text-sm text-gray-500 dark:text-slate-400">Empresa em uso</p>
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
              <p className="text-sm text-gray-500 dark:text-slate-400">Assinaturas ok</p>
              <h2 className="mt-1 text-2xl font-semibold text-gray-900 dark:text-slate-100">
                {activeSubscriptionCount}
              </h2>
            </div>
            <ShieldCheck className="h-5 w-5 text-blue-500" />
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-gray-500 dark:text-slate-400">Sem plano</p>
              <h2 className="mt-1 text-2xl font-semibold text-gray-900 dark:text-slate-100">
                {withoutPlanCount}
              </h2>
            </div>
            <CircleSlash className="h-5 w-5 text-gray-400" />
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-gray-500 dark:text-slate-400">Criação</p>
              <h2 className="mt-1 text-lg font-semibold text-gray-900 dark:text-slate-100">
                {canCreateCompany ? "Liberada" : "Restrita"}
              </h2>
            </div>
            <Factory className="h-5 w-5 text-gray-400" />
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                Distribuição por plano
              </h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
                Visão rápida da carteira de empresas vinculadas ao seu usuário.
              </p>
            </div>
            <BarChart3 className="h-5 w-5 text-gray-400" />
          </div>

          <div className="mt-5 space-y-4">
            {[
              { label: "Starter", value: planCounts.starter },
              { label: "Growth", value: planCounts.growth },
              { label: "Enterprise", value: planCounts.enterprise },
              { label: "Sem plano", value: planCounts.not_configured },
            ].map((item) => {
              const pct = percentage(item.value, activeTenants.length);
              return (
                <div key={item.label}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-gray-700 dark:text-slate-300">{item.label}</span>
                    <span className="text-gray-500 dark:text-slate-400">
                      {item.value} empresa{item.value === 1 ? "" : "s"} · {pct}%
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-800">
                    <div className="h-full rounded-full bg-blue-600" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                Saúde das assinaturas
              </h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
                Acompanhe empresas operando normalmente, em atenção ou com restrição.
              </p>
            </div>
            <HeartPulse className="h-5 w-5 text-gray-400" />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              { label: "Operando", value: statusCounts.ok, className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300" },
              { label: "Atenção", value: statusCounts.attention, className: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300" },
              { label: "Restritas", value: statusCounts.restricted, className: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300" },
              { label: "Não configuradas", value: statusCounts.notConfigured, className: "border-gray-200 bg-gray-50 text-gray-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300" },
            ].map((item) => (
              <div key={item.label} className={`rounded-xl border p-4 ${item.className}`}>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold">{item.value}</p>
                <p className="mt-1 text-xs opacity-80">
                  {percentage(item.value, activeTenants.length)}% da carteira
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {canCreateCompany ? (
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
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
          </div>

          <aside className="rounded-2xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-900 dark:border-blue-950 dark:bg-blue-950/30 dark:text-blue-200">
            <div className="flex items-center gap-2 font-semibold">
              <Info className="h-4 w-4" />
              O que será preparado
            </div>
            <ul className="mt-3 space-y-2">
              <li>Vínculo do usuário atual como administrador.</li>
              <li>Permissões iniciais para a nova empresa.</li>
              <li>Assinatura inicial conforme o plano selecionado.</li>
              <li>Atualização das páginas de usuários e assinatura após a criação.</li>
            </ul>
          </aside>
        </section>
      ) : (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-slate-100 p-2 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                Criação de empresas restrita
              </h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
                Novas empresas só podem ser criadas por administradores e quando a liberação administrativa estiver ativa neste ambiente.
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="border-b border-gray-200 p-5 dark:border-slate-800">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                Empresas vinculadas
              </h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
                Consulte permissões, assinatura e atalhos administrativos de cada empresa vinculada ao seu usuário.
              </p>
            </div>

            <form method="get" className="grid gap-3 sm:grid-cols-[minmax(220px,1fr)_180px_190px_auto] lg:min-w-[720px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  name="q"
                  defaultValue={q}
                  placeholder="Buscar empresa ou ID..."
                  className="w-full rounded-xl border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-blue-950"
                />
              </div>

              <select
                name="plan"
                defaultValue={planFilter}
                className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-blue-950"
              >
                <option value="">Todos os planos</option>
                <option value="starter">Starter</option>
                <option value="growth">Growth</option>
                <option value="enterprise">Enterprise</option>
                <option value="not_configured">Sem plano</option>
              </select>

              <select
                name="status"
                defaultValue={statusFilter}
                className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-blue-950"
              >
                <option value="">Todos os status</option>
                <option value="active">Ativa</option>
                <option value="trialing">Teste</option>
                <option value="past_due">Pagamento pendente</option>
                <option value="blocked">Bloqueada</option>
                <option value="canceled">Cancelada</option>
                <option value="not_configured">Não configurada</option>
              </select>

              <button
                type="submit"
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                Filtrar
              </button>
            </form>
          </div>

          <div className="mt-4 flex flex-col gap-2 text-xs text-gray-500 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <p>
              Exibindo {filteredTenants.length} de {activeTenants.length} empresas ativas.
            </p>
            {hasFilters ? (
              <Link
                href="/dashboard/admin/empresas"
                className="inline-flex w-fit items-center gap-1 font-medium text-blue-700 hover:underline dark:text-blue-300"
              >
                <XCircle className="h-3.5 w-3.5" />
                Limpar filtros
              </Link>
            ) : null}
          </div>
        </div>

        {activeTenants.length === 0 ? (
          <div className="p-6 text-sm text-gray-600 dark:text-slate-400">
            Nenhuma empresa ativa encontrada para o seu usuário.
          </div>
        ) : filteredTenants.length === 0 ? (
          <div className="p-6 text-sm text-gray-600 dark:text-slate-400">
            Nenhuma empresa encontrada com os filtros selecionados.
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-slate-800">
            {filteredTenants.map((tenant) => {
              const tenantName = getTenantName(tenant);
              const isCurrent =
                Boolean(currentTenant?.establishmentId) &&
                currentTenant?.establishmentId === tenant.establishment_id;
              const subscription = tenant.establishment_id
                ? subscriptionByEstablishmentId.get(tenant.establishment_id)
                : null;
              const plan = getBillingPlan(subscription?.planSlug ?? null);
              const establishmentId = String(tenant.establishment_id ?? "");

              return (
                <div
                  key={tenant.id}
                  className="grid gap-4 p-5 xl:grid-cols-[1.4fr_0.7fr_0.8fr_0.8fr_auto] xl:items-center"
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
                    <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                      ID: <span className="font-mono">{shortId(establishmentId)}</span>
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 dark:text-slate-400">Perfil</p>
                    <p className="mt-1 text-sm font-medium text-gray-900 dark:text-slate-100">
                      {getRoleLabel(tenant.role)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 dark:text-slate-400">Plano</p>
                    <p className="mt-1 inline-flex w-fit items-center gap-1 rounded-full border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 dark:border-slate-700 dark:text-slate-300">
                      <Users className="h-3 w-3" />
                      {plan?.name ?? "Não configurado"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 dark:text-slate-400">Assinatura</p>
                    <p
                      className={`mt-1 inline-flex w-fit rounded-full border px-2 py-1 text-xs font-medium ${getStatusClassName(
                        subscription?.status
                      )}`}
                    >
                      {getStatusLabel(subscription?.status)}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 xl:items-end">
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      Vinculado em {formatDate(tenant.created_at)}
                    </p>
                    <div className="flex flex-wrap gap-3 text-xs font-medium xl:justify-end">
                      <Link
                        href="/dashboard/admin/assinatura"
                        className="text-blue-700 hover:underline dark:text-blue-300"
                      >
                        Ver assinatura
                      </Link>
                      <Link
                        href="/dashboard/admin/usuarios"
                        className="text-blue-700 hover:underline dark:text-blue-300"
                      >
                        Usuários
                      </Link>
                    </div>
                    <CompanyRowActions establishmentId={establishmentId} isCurrent={isCurrent} />
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
