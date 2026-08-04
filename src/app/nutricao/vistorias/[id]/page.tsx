import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileWarning,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  completeInspection,
  getInspectionExecution,
  saveInspectionAnswer,
  startInspection,
} from "@/app/nutricao/actions";
import { SubmitButton } from "@/app/nutricao/SubmitButton";

export const dynamic = "force-dynamic";

type VistoriaExecutionPageProps = {
  params: Promise<{
    id: string;
  }>;
};

const statusLabels: Record<string, string> = {
  scheduled: "Agendada",
  in_progress: "Em andamento",
  paused: "Pausada",
  completed: "Concluída",
  canceled: "Cancelada",
  overdue: "Vencida",
  compliant: "Conforme",
  noncompliant: "Não conforme",
  not_applicable: "Não se aplica",
  approved: "Aprovada",
  approved_with_restrictions: "Aprovada com ressalvas",
  failed: "Reprovada",
};

function formatDateTime(value?: string | null) {
  if (!value) return "Sem data";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function Pill({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "green" | "amber" | "red";
}) {
  const classes = {
    slate:
      "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300",
    green:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950 dark:text-emerald-200",
    amber:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950 dark:text-amber-200",
    red: "border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950 dark:text-red-200",
  };

  return (
    <span className={`w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${classes[tone]}`}>
      {children}
    </span>
  );
}

function resultTone(status?: string | null) {
  if (status === "compliant" || status === "approved") return "green";
  if (status === "noncompliant" || status === "failed") return "red";
  return "amber";
}

export default async function VistoriaExecutionPage({
  params,
}: VistoriaExecutionPageProps) {
  const { id } = await params;
  const inspection = await getInspectionExecution(id);

  if (!inspection) {
    notFound();
  }

  const answeredCount = inspection.items.filter((item) => item.answer).length;
  const canEdit = !["completed", "canceled"].includes(inspection.status);
  const canStart = ["scheduled", "paused", "overdue"].includes(inspection.status);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Link
          href="/nutricao/vistorias"
          className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para Vistorias
        </Link>

        <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950 dark:text-emerald-200">
              <ClipboardCheck className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase text-emerald-700 dark:text-emerald-300">
                Execução de vistoria
              </p>
              <h1 className="mt-1 text-2xl font-bold text-slate-950 dark:text-white md:text-3xl">
                {inspection.title}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                {inspection.templateName ?? "Sem modelo vinculado"} •{" "}
                {inspection.sector ?? "Sem setor"} •{" "}
                {formatDateTime(inspection.scheduledFor)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Pill tone={inspection.status === "completed" ? "green" : "amber"}>
              {statusLabels[inspection.status] ?? inspection.status}
            </Pill>
            {inspection.result ? (
              <Pill tone={resultTone(inspection.result)}>
                {statusLabels[inspection.result] ?? inspection.result}
              </Pill>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">Itens</p>
          <p className="mt-2 text-lg font-bold text-slate-950 dark:text-white">
            {answeredCount}/{inspection.items.length}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">Conformes</p>
          <p className="mt-2 text-lg font-bold text-slate-950 dark:text-white">
            {inspection.compliantItems}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">Não conformes</p>
          <p className="mt-2 text-lg font-bold text-slate-950 dark:text-white">
            {inspection.noncompliantItems}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">Conformidade</p>
          <p className="mt-2 text-lg font-bold text-slate-950 dark:text-white">
            {inspection.compliancePercent == null
              ? "-"
              : `${inspection.compliancePercent}%`}
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <div>
            <p>
              Início: {formatDateTime(inspection.startedAt)} • Conclusão:{" "}
              {formatDateTime(inspection.completedAt)}
            </p>
            <p className="mt-1">
              Duração prevista: {inspection.expectedDurationMinutes ?? "-"} min
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {canStart ? (
            <form action={startInspection}>
              <input name="inspection_id" type="hidden" value={inspection.id} />
              <SubmitButton pendingLabel="Iniciando...">Iniciar vistoria</SubmitButton>
            </form>
          ) : null}

          {canEdit ? (
            <form action={completeInspection}>
              <input name="inspection_id" type="hidden" value={inspection.id} />
              <SubmitButton pendingLabel="Concluindo...">Concluir vistoria</SubmitButton>
            </form>
          ) : null}
        </div>
      </section>

      {inspection.items.length === 0 ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950 dark:text-amber-100">
          <div className="flex gap-3">
            <FileWarning className="h-5 w-5 shrink-0" />
            <p>
              Esta vistoria ainda não possui itens de checklist. Crie um modelo em
              Vistorias e agende uma nova execução com esse modelo.
            </p>
          </div>
        </section>
      ) : (
        <section className="grid gap-4">
          {inspection.items.map((item, index) => (
            <div
              key={item.id}
              className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                    {item.sectionTitle} • Item {index + 1}
                  </p>
                  <h2 className="mt-1 font-semibold text-slate-950 dark:text-white">
                    {item.title}
                  </h2>
                  {item.instruction ? (
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                      {item.instruction}
                    </p>
                  ) : null}
                </div>
                {item.answer ? (
                  <Pill tone={resultTone(item.answer.conformityStatus)}>
                    {statusLabels[item.answer.conformityStatus ?? ""] ??
                      item.answer.conformityStatus}
                  </Pill>
                ) : (
                  <Pill>Sem resposta</Pill>
                )}
              </div>

              {canEdit ? (
                <form action={saveInspectionAnswer} className="mt-5 grid gap-4">
                  <input name="inspection_id" type="hidden" value={inspection.id} />
                  <input name="item_id" type="hidden" value={item.id} />
                  <input name="section_id" type="hidden" value={item.sectionId ?? ""} />
                  <input name="response_type" type="hidden" value={item.responseType} />
                  <input name="item_title" type="hidden" value={item.title} />
                  <input name="severity" type="hidden" value={item.defaultSeverity} />
                  <input
                    name="create_nonconformity"
                    type="hidden"
                    value={String(item.createNonconformityOnFailure)}
                  />
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                    Resultado
                    <select
                      name="conformity_status"
                      className="h-9 rounded-md border border-slate-300 bg-transparent px-3 text-sm dark:border-slate-700"
                      defaultValue={item.answer?.conformityStatus ?? ""}
                      required
                    >
                      <option value="">Selecione</option>
                      <option value="compliant">Conforme</option>
                      <option value="noncompliant">Não conforme</option>
                      <option value="not_applicable">Não se aplica</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                    Observação
                    <Textarea
                      name="comment"
                      defaultValue={item.answer?.comment ?? ""}
                      placeholder="Registre evidências, justificativas ou ação imediata."
                      required={item.commentRequired}
                    />
                  </label>
                  <SubmitButton pendingLabel="Salvando...">
                    Salvar resposta
                  </SubmitButton>
                </form>
              ) : item.answer?.comment ? (
                <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-300">
                  {item.answer.comment}
                </p>
              ) : null}
            </div>
          ))}
        </section>
      )}

      {inspection.status === "completed" ? (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950 dark:text-emerald-100">
          <div className="flex gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <p>
              Vistoria concluída. As próximas fases vão adicionar assinatura em
              tela, evidências privadas e geração de PDF/DOCX versionados.
            </p>
          </div>
        </section>
      ) : null}
    </div>
  );
}
