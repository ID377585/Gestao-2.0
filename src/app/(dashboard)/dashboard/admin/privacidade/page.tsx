import Link from "next/link";
import {
  FileCheck2,
  FileText,
  LifeBuoy,
  LockKeyhole,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import {
  DPA_VERSION_ID,
  getEstablishmentEntitlement,
  listLegalAcceptances,
  listLegalDocuments,
  listPrivacyOperations,
} from "@/lib/compliance/legal.server";
import { getCurrentTenant } from "@/lib/tenant/get-current-tenant";
import {
  acceptDpaAction,
  createPrivacyRequestAction,
  reportSecurityIncidentAction,
  requestOffboardingAction,
} from "./actions";

function dateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

const legalLabels: Record<string, string> = {
  terms: "Termos do Serviço",
  privacy: "Política de Privacidade",
  cookies: "Política de Cookies",
  governance: "Governança e Proteção de Dados",
  accessibility: "Acessibilidade",
  dpa: "DPA",
  security: "Segurança da Informação",
};

export default async function PrivacyCenterPage() {
  const tenant = await getCurrentTenant();

  if (!tenant?.establishmentId) {
    return <main className="p-6">Empresa ativa não encontrada.</main>;
  }

  const [documents, acceptances, operations, entitlement] = await Promise.all([
    listLegalDocuments(),
    listLegalAcceptances({
      userId: tenant.userId,
      establishmentId: tenant.establishmentId,
    }),
    listPrivacyOperations(tenant.establishmentId),
    getEstablishmentEntitlement(tenant.establishmentId),
  ]);

  const acceptedVersionIds = new Set(
    acceptances.map((item) => String(item.document_version_id))
  );
  const dpaAccepted = acceptedVersionIds.has(DPA_VERSION_ID);
  const canAdminister = tenant.role === "admin";

  return (
    <main className="space-y-6 p-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-cyan-50 p-3 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-300">
                Jurídico, privacidade e compliance
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">
                Central de Privacidade e Dados
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
                Consulte documentos vigentes, histórico de aceite, solicitações LGPD,
                incidentes, suboperadores, retenção e o fluxo controlado de encerramento da empresa.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
            <p className="text-xs text-slate-500">Empresa em uso</p>
            <p className="mt-1 font-semibold text-slate-950 dark:text-white">
              {tenant.displayName ?? tenant.establishmentName ?? tenant.establishmentId}
            </p>
            <p className="mt-1 text-xs text-slate-500">Perfil: {tenant.role}</p>
          </div>
        </div>
      </section>

      {entitlement ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/30">
          <div className="flex items-start gap-3">
            <FileCheck2 className="mt-0.5 h-5 w-5 text-emerald-700 dark:text-emerald-300" />
            <div>
              <h2 className="font-semibold text-emerald-900 dark:text-emerald-200">
                Condição contratual específica
              </h2>
              <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-300">
                Política de cobrança: {entitlement.billing_policy}. Cobrança automática: {entitlement.automatic_billing_allowed ? "permitida" : "bloqueada"}.
              </p>
              <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
                Os limites negociados prevalecem sobre o catálogo genérico enquanto a condição estiver vigente.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-slate-500" />
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Documentos jurídicos</h2>
          </div>
          <div className="mt-4 space-y-3">
            {documents.map((document) => (
              <div key={document.version_id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      {legalLabels[String(document.document_type)] ?? document.title}
                    </p>
                    <p className="text-xs text-slate-500">
                      {document.version_label} · {document.status}
                    </p>
                  </div>
                  <Link href={String(document.slug)} className="text-sm font-medium text-blue-700 hover:underline dark:text-blue-300">
                    Visualizar
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-3">
            <LockKeyhole className="h-5 w-5 text-slate-500" />
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Histórico de aceites</h2>
          </div>
          <div className="mt-4 space-y-3">
            {acceptances.length ? acceptances.map((acceptance) => (
              <div key={`${acceptance.document_version_id}-${acceptance.accepted_at}`} className="rounded-xl border border-slate-200 p-4 text-sm dark:border-slate-800">
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  {legalLabels[String(acceptance.document_type)] ?? acceptance.document_type}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {acceptance.document_version_id} · aceito em {dateTime(acceptance.accepted_at)}
                </p>
              </div>
            )) : (
              <p className="text-sm text-slate-500">Nenhum aceite genérico registrado para esta empresa.</p>
            )}
          </div>

          {canAdminister && !dpaAccepted ? (
            <form action={acceptDpaAction} className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
              <p className="font-medium text-blue-900 dark:text-blue-200">Aceite empresarial do DPA v2.0</p>
              <label className="mt-3 flex items-start gap-2 text-sm text-blue-800 dark:text-blue-300">
                <input type="checkbox" name="authority" value="yes" required className="mt-1" />
                Declaro possuir poderes para representar esta empresa e aceito o DPA aplicável ao tratamento realizado pelo Gestify.
              </label>
              <button className="mt-3 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">
                Aceitar DPA
              </button>
            </form>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Solicitações LGPD</h2>
          {canAdminister ? (
            <form action={createPrivacyRequestAction} className="mt-4 grid gap-3">
              <select name="requestType" required className="rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700">
                <option value="access">Acesso</option>
                <option value="correction">Correção</option>
                <option value="deletion">Eliminação</option>
                <option value="anonymization">Anonimização</option>
                <option value="portability">Portabilidade</option>
                <option value="opposition">Oposição</option>
                <option value="consent_withdrawal">Revogação de consentimento</option>
                <option value="information">Informações</option>
              </select>
              <input name="subjectName" placeholder="Nome do titular" className="rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700" />
              <input name="subjectContact" placeholder="Contato do titular" className="rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700" />
              <textarea name="description" placeholder="Descrição da solicitação" className="min-h-24 rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700" />
              <button className="w-fit rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-950">Registrar solicitação</button>
            </form>
          ) : null}
          <div className="mt-5 space-y-2">
            {operations.requests.map((request) => (
              <div key={request.id} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
                <p className="font-medium">{request.request_type} · {request.status}</p>
                <p className="text-xs text-slate-500">{request.subject_name || "Titular não informado"} · {dateTime(request.created_at)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Incidentes de segurança</h2>
          </div>
          {canAdminister ? (
            <form action={reportSecurityIncidentAction} className="mt-4 grid gap-3">
              <input name="title" required placeholder="Título do incidente" className="rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700" />
              <textarea name="description" placeholder="Descrição inicial e evidências conhecidas" className="min-h-24 rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700" />
              <button className="w-fit rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800">Registrar incidente</button>
            </form>
          ) : null}
          <div className="mt-5 space-y-2">
            {operations.incidents.map((incident) => (
              <div key={incident.id} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
                <p className="font-medium">{incident.title}</p>
                <p className="text-xs text-slate-500">{incident.severity} · {incident.status} · {dateTime(incident.detected_at)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-3">
            <LifeBuoy className="h-5 w-5 text-slate-500" />
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Suboperadores</h2>
          </div>
          <div className="mt-4 space-y-3">
            {operations.subprocessors.map((provider) => (
              <div key={`${provider.provider}-${provider.service_category}`} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <p className="font-medium">{provider.provider}</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{provider.purpose}</p>
                <p className="mt-1 text-xs text-slate-500">Status: {provider.status} · Transferência internacional: {provider.international_transfer ? "pode ocorrer" : "não indicada"}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Retenção e descarte</h2>
          <p className="mt-1 text-sm text-slate-500">Automação destrutiva permanece desabilitada até validação técnica e jurídica de cada categoria.</p>
          <div className="mt-4 space-y-3">
            {operations.retention.map((policy) => (
              <div key={policy.category} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <p className="font-medium">{policy.category}</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{policy.rule_text}</p>
                <p className="mt-1 text-xs text-slate-500">Ação terminal: {policy.terminal_action} · Automação: {policy.automation_enabled ? "ativa" : "desativada"}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-red-200 bg-white p-5 shadow-sm dark:border-red-950 dark:bg-slate-950">
        <div className="flex items-start gap-3">
          <Trash2 className="mt-0.5 h-5 w-5 text-red-600" />
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Encerramento controlado do tenant</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Esta ação apenas inicia o workflow de offboarding. Ela não exclui dados nem interrompe automaticamente a empresa em uma única etapa.
            </p>
            {canAdminister ? (
              <form action={requestOffboardingAction} className="mt-4 grid gap-3 md:max-w-2xl">
                <textarea name="reason" placeholder="Motivo do encerramento" className="min-h-20 rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700" />
                <input name="confirmation" required placeholder='Digite ENCERRAR para confirmar' className="rounded-lg border border-red-300 bg-transparent px-3 py-2 text-sm dark:border-red-900" />
                <button className="w-fit rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800">Solicitar encerramento</button>
              </form>
            ) : null}
            <div className="mt-4 space-y-2">
              {operations.offboarding.map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
                  <p className="font-medium">Status: {item.status}</p>
                  <p className="text-xs text-slate-500">Solicitado em {dateTime(item.requested_at)} · janela de exportação até {dateTime(item.export_deadline_at)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
