import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  RotateCcw,
  ShieldAlert,
  XCircle,
} from "lucide-react";

import { SubmitButton } from "@/app/nutricao/SubmitButton";
import {
  acceptNutritionNonconformity,
  cancelNutritionNonconformity,
  completeNutritionReinspection,
  getNutritionNonconformityDetail,
  scheduleNutritionReinspection,
  submitNutritionCorrection,
  validateNutritionCorrection,
} from "@/app/nutricao/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const dynamic = "force-dynamic";

type NonconformityPageProps = {
  params: Promise<{
    id: string;
  }>;
};

const statusLabels: Record<string, string> = {
  open: "Aberta",
  awaiting_acceptance: "Aguardando aceite",
  in_correction: "Em correção",
  awaiting_evidence: "Aguardando evidência",
  awaiting_validation: "Aguardando validação",
  reinspection_scheduled: "Reinspeção agendada",
  in_reinspection: "Em reinspeção",
  failed_reinspection: "Reprovada na reinspeção",
  closed: "Encerrada",
  canceled: "Cancelada",
};

const severityLabels: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  critical: "Crítica",
};

function formatDateTime(value?: string | null) {
  if (!value) return "Sem data";

  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Sao_Paulo",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function Pill({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: "slate" | "green" | "amber" | "red" | "blue";
}) {
  const tones = {
    slate:
      "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300",
    green:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
    amber:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200",
    red:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200",
    blue:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
      <span>{label}</span>
      {children}
    </label>
  );
}

function HiddenWorkflowFields({
  id,
  version,
}: {
  id: string;
  version: number;
}) {
  return (
    <>
      <input name="nonconformity_id" type="hidden" value={id} />
      <input name="version" type="hidden" value={version} />
    </>
  );
}

export default async function NonconformityPage({
  params,
}: NonconformityPageProps) {
  const { id } = await params;
  const item = await getNutritionNonconformityDetail(id);

  if (!item) notFound();

  const canAccept = ["open", "awaiting_acceptance"].includes(item.status);
  const canCorrect = [
    "open",
    "awaiting_acceptance",
    "in_correction",
    "awaiting_evidence",
    "failed_reinspection",
  ].includes(item.status);
  const canValidate = item.status === "awaiting_validation";
  const canScheduleReinspection = [
    "awaiting_validation",
    "reinspection_scheduled",
    "failed_reinspection",
    "in_correction",
  ].includes(item.status);
  const canCompleteReinspection = item.reinspections.some(
    (reinspection) => reinspection.status !== "completed"
  );
  const canCancel = !["closed", "canceled"].includes(item.status);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-950 dark:bg-slate-950 dark:text-white sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-5">
        <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-start md:justify-between">
          <div>
            <Button asChild variant="ghost" size="sm" className="-ml-2 mb-3">
              <Link href="/nutricao/nao-conformidades">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Link>
            </Button>
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <ShieldAlert className="h-4 w-4 text-red-600" />
              <span>{item.code ?? "Ocorrência sem código"}</span>
              <span>•</span>
              <span>{item.sourceType}</span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950 dark:text-white">
              {item.title}
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
              {item.description ?? "Sem descrição detalhada."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Pill tone={item.status === "closed" ? "green" : "blue"}>
              {statusLabels[item.status] ?? item.status}
            </Pill>
            <Pill tone={item.severity === "critical" ? "red" : "amber"}>
              {severityLabels[item.severity] ?? item.severity}
            </Pill>
          </div>
        </div>

        <section className="grid gap-5 lg:grid-cols-[0.72fr_1.28fr]">
          <aside className="grid gap-5">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="font-semibold">Resumo</h2>
              <dl className="mt-4 grid gap-3 text-sm">
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Setor</dt>
                  <dd>{item.sector ?? "Sem setor"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Local</dt>
                  <dd>{item.location ?? "Sem local"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Categoria</dt>
                  <dd>{item.category ?? "Sem categoria"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Aberta em</dt>
                  <dd>{formatDateTime(item.openedAt)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Prazo</dt>
                  <dd>{formatDateTime(item.dueAt)}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="font-semibold">Histórico</h2>
              <div className="mt-4 grid gap-3">
                {item.timeline.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Nenhum evento registrado ainda.
                  </p>
                ) : (
                  item.timeline.map((event) => (
                    <div key={event.id} className="border-l border-slate-200 pl-3 dark:border-slate-800">
                      <p className="text-sm font-medium">{event.action}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {formatDateTime(event.createdAt)}
                        {event.reason ? ` • ${event.reason}` : ""}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>

          <div className="grid gap-5">
            <div className="grid gap-5 xl:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-blue-600" />
                  <h2 className="font-semibold">Aceite e correção</h2>
                </div>

                {canAccept ? (
                  <form action={acceptNutritionNonconformity} className="mt-4">
                    <HiddenWorkflowFields id={item.id} version={item.version} />
                    <SubmitButton pendingLabel="Aceitando...">
                      Aceitar ocorrência
                    </SubmitButton>
                  </form>
                ) : null}

                {canCorrect ? (
                  <form action={submitNutritionCorrection} className="mt-5 grid gap-4">
                    <HiddenWorkflowFields id={item.id} version={item.version} />
                    <Field label="Causa raiz">
                      <Textarea
                        name="root_cause"
                        defaultValue={item.rootCause ?? ""}
                        placeholder="Ex.: Falha no procedimento, equipamento, treinamento ou rotina."
                        required
                      />
                    </Field>
                    <Field label="Ação corretiva">
                      <Textarea
                        name="corrective_action"
                        defaultValue={item.correctiveAction ?? ""}
                        placeholder="Descreva a correção aplicada ou planejada."
                        required
                      />
                    </Field>
                    <Field label="Evidência da correção">
                      <Textarea
                        name="correction_evidence_summary"
                        defaultValue={item.correctionEvidenceSummary ?? ""}
                        placeholder="Informe evidência, arquivo, foto, conferência ou registro relacionado."
                        required
                      />
                    </Field>
                    <SubmitButton pendingLabel="Enviando...">
                      Enviar para validação
                    </SubmitButton>
                  </form>
                ) : (
                  <div className="mt-5 rounded-lg border border-slate-200 p-4 text-sm dark:border-slate-800">
                    <p className="font-medium">Correção informada</p>
                    <p className="mt-2 text-slate-600 dark:text-slate-300">
                      {item.correctiveAction ?? "Sem ação corretiva registrada."}
                    </p>
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <h2 className="font-semibold">Validação</h2>
                </div>

                {canValidate ? (
                  <form action={validateNutritionCorrection} className="mt-5 grid gap-4">
                    <HiddenWorkflowFields id={item.id} version={item.version} />
                    <Field label="Resultado">
                      <select
                        name="validation_result"
                        className="h-9 rounded-md border border-slate-300 bg-transparent px-3 text-sm dark:border-slate-700"
                        required
                      >
                        <option value="">Selecione</option>
                        <option value="approved">Aprovar correção</option>
                        <option value="rejected">Rejeitar e devolver</option>
                      </select>
                    </Field>
                    <Field label="Comentário da validação">
                      <Textarea name="validation_comment" />
                    </Field>
                    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                      <input name="needs_reinspection" type="checkbox" className="h-4 w-4" />
                      Exigir reinspeção antes de encerrar
                    </label>
                    <SubmitButton pendingLabel="Validando...">Salvar validação</SubmitButton>
                  </form>
                ) : (
                  <div className="mt-5 rounded-lg border border-slate-200 p-4 text-sm dark:border-slate-800">
                    <p className="font-medium">
                      {item.validationResult
                        ? item.validationResult === "approved"
                          ? "Correção aprovada"
                          : "Correção rejeitada"
                        : "Aguardando correção"}
                    </p>
                    <p className="mt-2 text-slate-600 dark:text-slate-300">
                      {item.validationComment ?? "Sem comentário de validação."}
                    </p>
                    {item.validationAt ? (
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        {formatDateTime(item.validationAt)}
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2">
                <RotateCcw className="h-5 w-5 text-amber-600" />
                <h2 className="font-semibold">Reinspeção</h2>
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-2">
                {canScheduleReinspection ? (
                  <form action={scheduleNutritionReinspection} className="grid gap-4">
                    <HiddenWorkflowFields id={item.id} version={item.version} />
                    <Field label="Data da reinspeção">
                      <Input name="scheduled_for" type="datetime-local" required />
                    </Field>
                    <Field label="Escopo">
                      <Textarea
                        name="scope"
                        placeholder="Ex.: Validar troca do equipamento, nova medição e registros do setor."
                      />
                    </Field>
                    <SubmitButton pendingLabel="Agendando...">
                      Agendar reinspeção
                    </SubmitButton>
                  </form>
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Reinspeção disponível após validação ou reprovação anterior.
                  </p>
                )}

                <div className="grid gap-3">
                  {item.reinspections.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Nenhuma reinspeção agendada.
                    </p>
                  ) : (
                    item.reinspections.map((reinspection) => (
                      <div
                        key={reinspection.id}
                        className="rounded-lg border border-slate-200 p-4 dark:border-slate-800"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium">
                            {formatDateTime(reinspection.scheduledFor)}
                          </p>
                          <Pill>{statusLabels[reinspection.status] ?? reinspection.status}</Pill>
                        </div>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                          {reinspection.scope ?? "Sem escopo definido."}
                        </p>
                        {reinspection.status !== "completed" && canCompleteReinspection ? (
                          <form
                            action={completeNutritionReinspection}
                            className="mt-4 grid gap-3"
                          >
                            <HiddenWorkflowFields id={item.id} version={item.version} />
                            <input
                              name="reinspection_id"
                              type="hidden"
                              value={reinspection.id}
                            />
                            <Field label="Resultado">
                              <select
                                name="result"
                                className="h-9 rounded-md border border-slate-300 bg-transparent px-3 text-sm dark:border-slate-700"
                                required
                              >
                                <option value="">Selecione</option>
                                <option value="approved">Aprovada</option>
                                <option value="rejected">Reprovada</option>
                              </select>
                            </Field>
                            <Field label="Comentário">
                              <Textarea name="result_comment" />
                            </Field>
                            <SubmitButton pendingLabel="Concluindo...">
                              Concluir reinspeção
                            </SubmitButton>
                          </form>
                        ) : null}
                        {reinspection.result ? (
                          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                            Resultado: {reinspection.result}
                            {reinspection.resultComment
                              ? ` • ${reinspection.resultComment}`
                              : ""}
                          </p>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {canCancel ? (
              <div className="rounded-lg border border-red-200 bg-white p-5 shadow-sm dark:border-red-900 dark:bg-slate-900">
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <h2 className="font-semibold">Cancelar ocorrência</h2>
                </div>
                <form action={cancelNutritionNonconformity} className="mt-5 grid gap-4">
                  <HiddenWorkflowFields id={item.id} version={item.version} />
                  <Field label="Justificativa obrigatória">
                    <Textarea name="cancel_reason" required />
                  </Field>
                  <SubmitButton pendingLabel="Cancelando...">Cancelar com justificativa</SubmitButton>
                </form>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
