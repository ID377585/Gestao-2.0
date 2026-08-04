import Link from "next/link";
import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  Database,
  FileClock,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Thermometer,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createNutritionInspection,
  createNutritionNonconformity,
  createDocument,
  createPop,
  createReportDraft,
  createSanitationPlan,
  createSupplierAssessment,
  createTemperaturePoint,
  createTemperatureRecord,
  createTraining,
  listDocuments,
  listNutritionInspections,
  listNutritionNonconformities,
  listPops,
  listReports,
  listSanitationPlans,
  listSupplierAssessments,
  listTemperaturePoints,
  listTrainings,
} from "@/app/nutricao/actions";
import { SubmitButton } from "@/app/nutricao/SubmitButton";
import {
  getNutricaoSubmodule,
  NUTRICAO_SUBMODULES,
} from "@/lib/nutricao/navigation";

export const dynamic = "force-dynamic";

type NutricaoSectionPageProps = {
  params: Promise<{
    section: string;
  }>;
};

const implementationNotes: Record<string, string[]> = {
  pops: [
    "POP será versionado, com aprovação e bloqueio de edição da versão vigente.",
    "Leitura por colaboradores e QR Code serão conectados após o Storage privado.",
    "Documentos aprovados não serão sobrescritos; nova revisão cria nova versão.",
  ],
  higienizacao: [
    "Planos de higienização devem vir de POPs e fichas aprovadas.",
    "Não serão sugeridas diluições químicas livremente pelo sistema.",
    "Execuções poderão exigir evidência e verificação.",
  ],
  documentos: [
    "Arquivos devem ficar no bucket privado nutrition-files.",
    "Versões não sobrescrevem documentos anteriores.",
    "Validades alimentam alertas e próximos vencimentos.",
  ],
  treinamentos: [
    "Treinamentos terão validade, turmas, presença e reciclagem.",
    "Falhas recorrentes poderão gerar treinamentos corretivos.",
    "Certificados e evidências serão anexados no Storage privado.",
  ],
  fornecedores: [
    "A visão sanitária será separada da pontuação comercial.",
    "Avaliações poderão vincular documentos, ocorrências e planos de ação.",
    "A integração deve reutilizar o cadastro atual de fornecedores.",
  ],
  relatorios: [
    "Relatórios serão gerados no servidor em PDF/DOCX.",
    "Cada geração terá versão, hash e trilha de entrega.",
    "Envios externos devem passar por fila e idempotência.",
  ],
  configuracoes: [
    "Configurações definirão prazos por gravidade, geolocalização e escalonamento.",
    "Regras legais e operacionais devem ser ajustáveis por estabelecimento.",
    "Nenhuma credencial externa será exposta no navegador.",
  ],
  "planos-de-acao": [
    "Planos de ação usarão 5W2H sem obrigar campos financeiros.",
    "Cada item terá responsável, prazo, progresso, evidência e validação.",
    "Atualizações alimentarão a linha do tempo da não conformidade.",
  ],
};

const statusLabels: Record<string, string> = {
  scheduled: "Agendada",
  in_progress: "Em andamento",
  paused: "Pausada",
  completed: "Concluída",
  canceled: "Cancelada",
  overdue: "Vencida",
  open: "Aberta",
  awaiting_acceptance: "Aguardando aceite",
  in_correction: "Em correção",
  awaiting_evidence: "Aguardando evidência",
  awaiting_validation: "Aguardando validação",
  reinspection_scheduled: "Reinspeção agendada",
  closed: "Encerrada",
  within_limits: "Dentro do limite",
  out_of_limits: "Fora do limite",
  confirmed_exception: "Exceção confirmada",
  draft: "Rascunho",
  active: "Ativo",
  inactive: "Inativo",
  near_expiration: "Próximo do vencimento",
  expired: "Vencido",
  replaced: "Substituído",
  pending: "Pendente",
  approved: "Aprovado",
  approved_with_restriction: "Aprovado com restrição",
  suspended: "Suspenso",
  rejected: "Reprovado",
  generated: "Gerado",
  sent: "Enviado",
  failed: "Falhou",
};

const severityLabels: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  critical: "Crítica",
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
  children: ReactNode;
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

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
      {label}
      {children}
    </label>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
      {message}
    </div>
  );
}

async function VistoriasSection() {
  const inspections = await listNutritionInspections();

  return (
    <section className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <Plus className="h-5 w-5 text-emerald-600" />
          <h2 className="font-semibold text-slate-950 dark:text-white">
            Agendar vistoria
          </h2>
        </div>

        <form action={createNutritionInspection} className="mt-5 grid gap-4">
          <Field label="Título">
            <Input name="title" placeholder="Ex.: Vistoria semanal da cozinha" required />
          </Field>
          <Field label="Tipo">
            <select
              name="inspection_type"
              className="h-9 rounded-md border border-slate-300 bg-transparent px-3 text-sm dark:border-slate-700"
              defaultValue="vistoria"
            >
              <option value="vistoria">Vistoria</option>
              <option value="auditoria">Auditoria</option>
              <option value="rotina">Rotina operacional</option>
              <option value="reinspecao">Reinspeção</option>
            </select>
          </Field>
          <Field label="Setor">
            <Input name="sector" placeholder="Ex.: Cozinha quente" />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Data e hora">
              <Input name="scheduled_for" type="datetime-local" />
            </Field>
            <Field label="Duração prevista (min)">
              <Input name="expected_duration_minutes" type="number" min="1" max="1440" />
            </Field>
          </div>
          <SubmitButton pendingLabel="Agendando...">Agendar vistoria</SubmitButton>
        </form>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-slate-950 dark:text-white">
            Vistorias recentes
          </h2>
          <Pill>{inspections.length}</Pill>
        </div>

        <div className="mt-5 grid gap-3">
          {inspections.length === 0 ? (
            <EmptyState message="Nenhuma vistoria encontrada para este estabelecimento." />
          ) : (
            inspections.map((inspection) => (
              <div
                key={inspection.id}
                className="rounded-lg border border-slate-200 p-4 dark:border-slate-800"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-semibold text-slate-950 dark:text-white">
                      {inspection.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {inspection.sector ?? "Sem setor"} • {formatDateTime(inspection.scheduledFor)}
                    </p>
                  </div>
                  <Pill tone={inspection.status === "completed" ? "green" : "amber"}>
                    {statusLabels[inspection.status] ?? inspection.status}
                  </Pill>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

async function NonconformidadesSection() {
  const items = await listNutritionNonconformities();

  return (
    <section className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-red-600" />
          <h2 className="font-semibold text-slate-950 dark:text-white">
            Abrir não conformidade
          </h2>
        </div>

        <form action={createNutritionNonconformity} className="mt-5 grid gap-4">
          <Field label="Título">
            <Input name="title" placeholder="Ex.: Câmara fria acima do limite" required />
          </Field>
          <Field label="Descrição">
            <Textarea name="description" placeholder="Descreva o que foi identificado." />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Setor">
              <Input name="sector" placeholder="Ex.: Estoque frio" />
            </Field>
            <Field label="Local">
              <Input name="location" placeholder="Ex.: Câmara 01" />
            </Field>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Categoria">
              <Input name="category" placeholder="Ex.: Temperatura" />
            </Field>
            <Field label="Gravidade">
              <select
                name="severity"
                className="h-9 rounded-md border border-slate-300 bg-transparent px-3 text-sm dark:border-slate-700"
                defaultValue="medium"
              >
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
                <option value="critical">Crítica</option>
              </select>
            </Field>
          </div>
          <Field label="Prazo">
            <Input name="due_at" type="datetime-local" />
          </Field>
          <Field label="Medida imediata">
            <Textarea
              name="immediate_containment"
              placeholder="Ex.: Isolar produto, transferir para outro equipamento, acionar manutenção."
            />
          </Field>
          <SubmitButton pendingLabel="Abrindo...">Abrir ocorrência</SubmitButton>
        </form>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-slate-950 dark:text-white">
            Ocorrências abertas
          </h2>
          <Pill>{items.length}</Pill>
        </div>

        <div className="mt-5 grid gap-3">
          {items.length === 0 ? (
            <EmptyState message="Nenhuma não conformidade encontrada para este estabelecimento." />
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-slate-200 p-4 dark:border-slate-800"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-semibold text-slate-950 dark:text-white">
                      {item.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {item.sector ?? "Sem setor"} • Prazo: {formatDateTime(item.dueAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Pill tone={item.severity === "critical" ? "red" : "amber"}>
                      {severityLabels[item.severity] ?? item.severity}
                    </Pill>
                    <Pill>{statusLabels[item.status] ?? item.status}</Pill>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

async function TemperaturasSection() {
  const points = await listTemperaturePoints();

  return (
    <section className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
      <div className="grid gap-5">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <Thermometer className="h-5 w-5 text-sky-600" />
            <h2 className="font-semibold text-slate-950 dark:text-white">
              Ponto de controle
            </h2>
          </div>

          <form action={createTemperaturePoint} className="mt-5 grid gap-4">
            <Field label="Nome">
              <Input name="name" placeholder="Ex.: Geladeira confeitaria" required />
            </Field>
            <Field label="Tipo de controle">
              <select
                name="control_type"
                className="h-9 rounded-md border border-slate-300 bg-transparent px-3 text-sm dark:border-slate-700"
                defaultValue="geladeira"
              >
                <option value="geladeira">Geladeira</option>
                <option value="freezer">Freezer</option>
                <option value="camara">Câmara</option>
                <option value="recebimento">Recebimento</option>
                <option value="coccao">Cocção</option>
                <option value="resfriamento">Resfriamento</option>
                <option value="reaquecimento">Reaquecimento</option>
                <option value="distribuicao">Distribuição</option>
                <option value="transporte">Transporte</option>
              </select>
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Setor">
                <Input name="sector" placeholder="Ex.: Confeitaria" />
              </Field>
              <Field label="Equipamento/produto">
                <Input name="equipment_or_product" placeholder="Ex.: Geladeira G01" />
              </Field>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Mínimo">
                <Input name="min_value" type="number" step="0.1" />
              </Field>
              <Field label="Máximo">
                <Input name="max_value" type="number" step="0.1" />
              </Field>
              <Field label="Unidade">
                <Input name="unit" defaultValue="C" />
              </Field>
            </div>
            <Field label="Ação corretiva padrão">
              <Textarea name="default_corrective_action" />
            </Field>
            <SubmitButton pendingLabel="Criando...">Criar ponto</SubmitButton>
          </form>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-semibold text-slate-950 dark:text-white">
            Registrar medição
          </h2>
          <form action={createTemperatureRecord} className="mt-5 grid gap-4">
            <Field label="Ponto de controle">
              <select
                name="point_id"
                className="h-9 rounded-md border border-slate-300 bg-transparent px-3 text-sm dark:border-slate-700"
                required
              >
                <option value="">Selecione</option>
                {points.map((point) => (
                  <option key={point.id} value={point.id}>
                    {point.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Temperatura">
              <Input name="measured_value" type="number" step="0.1" required />
            </Field>
            <Field label="Observação">
              <Textarea name="observation" />
            </Field>
            <Field label="Ação imediata se fora do limite">
              <Textarea name="immediate_action" />
            </Field>
            <SubmitButton pendingLabel="Registrando...">Registrar temperatura</SubmitButton>
          </form>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-slate-950 dark:text-white">
            Pontos cadastrados
          </h2>
          <Pill>{points.length}</Pill>
        </div>

        <div className="mt-5 grid gap-3">
          {points.length === 0 ? (
            <EmptyState message="Nenhum ponto de temperatura encontrado para este estabelecimento." />
          ) : (
            points.map((point) => (
              <div
                key={point.id}
                className="rounded-lg border border-slate-200 p-4 dark:border-slate-800"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-semibold text-slate-950 dark:text-white">
                      {point.name}
                    </p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {point.sector ?? "Sem setor"} • {point.minValue ?? "-"} a{" "}
                      {point.maxValue ?? "-"} {point.unit}
                    </p>
                    {point.latestRecord ? (
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        Última medição: {point.latestRecord.measuredValue} {point.unit} em{" "}
                        {formatDateTime(point.latestRecord.measuredAt)}
                      </p>
                    ) : null}
                  </div>
                  <Pill tone={point.latestRecord?.status === "out_of_limits" ? "red" : "green"}>
                    {point.latestRecord
                      ? statusLabels[point.latestRecord.status] ?? point.latestRecord.status
                      : "Sem medição"}
                  </Pill>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

async function PopsSection() {
  const items = await listPops();

  return (
    <RegistrySection
      title="Cadastrar POP"
      count={items.length}
      form={
        <form action={createPop} className="grid gap-4">
          <Field label="Código">
            <Input name="code" placeholder="Ex.: POP-HIG-001" />
          </Field>
          <Field label="Título">
            <Input name="title" placeholder="Ex.: Higienização de bancadas" required />
          </Field>
          <Field label="Objetivo">
            <Textarea name="objective" />
          </Field>
          <Field label="Abrangência">
            <Textarea name="scope" />
          </Field>
          <Field label="Setores aplicáveis, separados por vírgula">
            <Input name="applicable_sectors" placeholder="Cozinha, Confeitaria" />
          </Field>
          <Field label="Próxima revisão">
            <Input name="next_review_at" type="date" />
          </Field>
          <SubmitButton>Criar POP</SubmitButton>
        </form>
      }
      list={
        items.length === 0 ? (
          <EmptyState message="Nenhum POP cadastrado para este estabelecimento." />
        ) : (
          items.map((item) => (
            <RegistryCard
              key={item.id}
              title={item.title}
              description={`${item.code ?? "Sem código"} • Revisão: ${item.nextReviewAt ?? "sem data"}`}
              status={item.status}
            />
          ))
        )
      }
    />
  );
}

async function HigienizacaoSection() {
  const items = await listSanitationPlans();

  return (
    <RegistrySection
      title="Plano de higienização"
      count={items.length}
      form={
        <form action={createSanitationPlan} className="grid gap-4">
          <Field label="Nome do plano">
            <Input name="name" placeholder="Ex.: Higienização diária da praça fria" required />
          </Field>
          <Field label="Ambiente, superfície ou equipamento">
            <Input name="target_item" placeholder="Ex.: Bancada inox" required />
          </Field>
          <Field label="Setor">
            <Input name="sector" />
          </Field>
          <Field label="Método">
            <Textarea name="method" />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Produto regularizado">
              <Input name="product_name" />
            </Field>
            <Field label="Diluição/concentração aprovada">
              <Input name="dilution_or_concentration" />
            </Field>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Tempo de contato">
              <Input name="contact_time" />
            </Field>
            <Field label="EPI necessário">
              <Input name="required_ppe" />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input name="evidence_required" type="checkbox" className="h-4 w-4" />
            Exigir evidência na execução
          </label>
          <SubmitButton>Criar plano</SubmitButton>
        </form>
      }
      list={
        items.length === 0 ? (
          <EmptyState message="Nenhum plano de higienização cadastrado." />
        ) : (
          items.map((item) => (
            <RegistryCard
              key={item.id}
              title={item.name}
              description={`${item.sector ?? "Sem setor"} • ${item.targetItem}${item.productName ? ` • ${item.productName}` : ""}`}
              status={item.status}
              extra={item.evidenceRequired ? "Exige evidência" : "Evidência opcional"}
            />
          ))
        )
      }
    />
  );
}

async function DocumentosSection() {
  const items = await listDocuments();

  return (
    <RegistrySection
      title="Cadastrar documento"
      count={items.length}
      form={
        <form action={createDocument} className="grid gap-4">
          <Field label="Tipo">
            <Input name="document_type" placeholder="Ex.: Licença sanitária" required />
          </Field>
          <Field label="Título">
            <Input name="title" required />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Número">
              <Input name="document_number" />
            </Field>
            <Field label="Emissor">
              <Input name="issuer" />
            </Field>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Emissão">
              <Input name="issued_at" type="date" />
            </Field>
            <Field label="Validade">
              <Input name="valid_until" type="date" />
            </Field>
          </div>
          <Field label="Visibilidade">
            <select
              name="visibility"
              className="h-9 rounded-md border border-slate-300 bg-transparent px-3 text-sm dark:border-slate-700"
              defaultValue="internal"
            >
              <option value="internal">Interna</option>
              <option value="restricted">Restrita</option>
              <option value="external_share">Compartilhável</option>
            </select>
          </Field>
          <SubmitButton>Cadastrar documento</SubmitButton>
        </form>
      }
      list={
        items.length === 0 ? (
          <EmptyState message="Nenhum documento sanitário cadastrado." />
        ) : (
          items.map((item) => (
            <RegistryCard
              key={item.id}
              title={item.title}
              description={`${item.documentType} • Validade: ${item.validUntil ?? "sem data"}`}
              status={item.status}
              extra={item.issuer ?? item.visibility}
            />
          ))
        )
      }
    />
  );
}

async function TreinamentosSection() {
  const items = await listTrainings();

  return (
    <RegistrySection
      title="Cadastrar treinamento"
      count={items.length}
      form={
        <form action={createTraining} className="grid gap-4">
          <Field label="Título">
            <Input name="title" required />
          </Field>
          <Field label="Descrição">
            <Textarea name="description" />
          </Field>
          <Field label="Instrutor">
            <Input name="instructor" />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Carga horária (min)">
              <Input name="workload_minutes" type="number" min="1" />
            </Field>
            <Field label="Validade (dias)">
              <Input name="validity_days" type="number" min="1" />
            </Field>
          </div>
          <SubmitButton>Cadastrar treinamento</SubmitButton>
        </form>
      }
      list={
        items.length === 0 ? (
          <EmptyState message="Nenhum treinamento cadastrado." />
        ) : (
          items.map((item) => (
            <RegistryCard
              key={item.id}
              title={item.title}
              description={`${item.instructor ?? "Sem instrutor"} • ${item.workloadMinutes ?? "-"} min`}
              status={item.status}
              extra={item.validityDays ? `Validade: ${item.validityDays} dias` : "Sem validade definida"}
            />
          ))
        )
      }
    />
  );
}

async function FornecedoresSection() {
  const items = await listSupplierAssessments();

  return (
    <RegistrySection
      title="Avaliação sanitária"
      count={items.length}
      form={
        <form action={createSupplierAssessment} className="grid gap-4">
          <Field label="Fornecedor">
            <Input name="supplier_name" required />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Data">
              <Input name="assessment_date" type="date" />
            </Field>
            <Field label="Pontuação de qualidade">
              <Input name="quality_score" type="number" min="0" max="100" step="0.1" />
            </Field>
          </div>
          <Field label="Status sanitário">
            <select
              name="sanitary_status"
              className="h-9 rounded-md border border-slate-300 bg-transparent px-3 text-sm dark:border-slate-700"
              defaultValue="pending"
            >
              <option value="pending">Pendente</option>
              <option value="approved">Aprovado</option>
              <option value="approved_with_restriction">Aprovado com restrição</option>
              <option value="suspended">Suspenso</option>
              <option value="rejected">Reprovado</option>
            </select>
          </Field>
          <Field label="Observações">
            <Textarea name="notes" />
          </Field>
          <SubmitButton>Cadastrar avaliação</SubmitButton>
        </form>
      }
      list={
        items.length === 0 ? (
          <EmptyState message="Nenhuma avaliação sanitária de fornecedor cadastrada." />
        ) : (
          items.map((item) => (
            <RegistryCard
              key={item.id}
              title={item.supplierName}
              description={`Avaliado em ${item.assessmentDate}`}
              status={item.sanitaryStatus}
              extra={item.qualityScore == null ? "Sem pontuação" : `${item.qualityScore}/100`}
            />
          ))
        )
      }
    />
  );
}

async function RelatoriosSection() {
  const items = await listReports();

  return (
    <RegistrySection
      title="Preparar relatório"
      count={items.length}
      form={
        <form action={createReportDraft} className="grid gap-4">
          <Field label="Título">
            <Input name="title" required />
          </Field>
          <Field label="Tipo">
            <Input name="report_type" placeholder="Ex.: vistorias_por_periodo" required />
          </Field>
          <Field label="Formato">
            <select
              name="format"
              className="h-9 rounded-md border border-slate-300 bg-transparent px-3 text-sm dark:border-slate-700"
              defaultValue="pdf"
            >
              <option value="pdf">PDF</option>
              <option value="docx">DOCX</option>
              <option value="xlsx">XLSX</option>
              <option value="html">HTML</option>
            </select>
          </Field>
          <SubmitButton>Preparar rascunho</SubmitButton>
        </form>
      }
      list={
        items.length === 0 ? (
          <EmptyState message="Nenhum relatório preparado." />
        ) : (
          items.map((item) => (
            <RegistryCard
              key={item.id}
              title={item.title}
              description={`${item.reportType} • ${item.format.toUpperCase()}`}
              status={item.status}
              extra={item.generatedAt ? formatDateTime(item.generatedAt) : "Ainda não gerado"}
            />
          ))
        )
      }
    />
  );
}

function RegistrySection({
  title,
  count,
  form,
  list,
}: {
  title: string;
  count: number;
  form: ReactNode;
  list: ReactNode;
}) {
  return (
    <section className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-semibold text-slate-950 dark:text-white">{title}</h2>
        <div className="mt-5">{form}</div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-slate-950 dark:text-white">
            Registros
          </h2>
          <Pill>{count}</Pill>
        </div>
        <div className="mt-5 grid gap-3">{list}</div>
      </div>
    </section>
  );
}

function RegistryCard({
  title,
  description,
  status,
  extra,
}: {
  title: string;
  description: string;
  status: string;
  extra?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="font-semibold text-slate-950 dark:text-white">{title}</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {description}
          </p>
          {extra ? (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {extra}
            </p>
          ) : null}
        </div>
        <Pill>{statusLabels[status] ?? status}</Pill>
      </div>
    </div>
  );
}

function PreparedSection({ notes }: { notes: string[] }) {
  return (
    <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <Database className="h-5 w-5 text-slate-500" />
          <h2 className="font-semibold text-slate-950 dark:text-white">
            Estado atual
          </h2>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
          A estrutura de banco e navegação já está prevista. Esta parte será
          ativada por etapa para preservar dados, permissões e desempenho.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          <h2 className="font-semibold text-slate-950 dark:text-white">
            Próximas garantias
          </h2>
        </div>
        <ul className="mt-4 space-y-3">
          {notes.map((note) => (
            <li
              key={note}
              className="flex gap-3 text-sm leading-6 text-slate-600 dark:text-slate-300"
            >
              <FileClock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <span>{note}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function generateStaticParams() {
  return NUTRICAO_SUBMODULES.filter((item) => item.slug !== "visao-geral").map(
    (item) => ({
      section: item.slug,
    })
  );
}

export default async function NutricaoSectionPage({
  params,
}: NutricaoSectionPageProps) {
  const { section } = await params;

  if (section === "visao-geral") {
    redirect("/nutricao");
  }

  const module = getNutricaoSubmodule(section);

  if (!module) {
    notFound();
  }

  const Icon = module.icon;
  const notes =
    implementationNotes[module.slug] ??
    [
      "Estrutura de navegação preparada para a próxima etapa funcional.",
      "As tabelas centrais do módulo foram previstas na migration de fundação.",
      "Nenhum dado fictício é exibido ou gravado nesta tela.",
    ];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Link
          href="/nutricao"
          className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para Nutrição
        </Link>

        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
              <Icon className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase text-emerald-700 dark:text-emerald-300">
                Nutrição
              </p>
              <h1 className="mt-1 text-2xl font-bold text-slate-950 dark:text-white md:text-3xl">
                {module.title}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                {module.description}
              </p>
            </div>
          </div>

          <Button asChild variant="outline">
            <Link href="/nutricao">
              <CalendarClock className="h-4 w-4" />
              Visão geral
            </Link>
          </Button>
        </div>
      </div>

      {module.slug === "vistorias" ? <VistoriasSection /> : null}
      {module.slug === "nao-conformidades" ? <NonconformidadesSection /> : null}
      {module.slug === "temperaturas" ? <TemperaturasSection /> : null}
      {module.slug === "pops" ? <PopsSection /> : null}
      {module.slug === "higienizacao" ? <HigienizacaoSection /> : null}
      {module.slug === "documentos" ? <DocumentosSection /> : null}
      {module.slug === "treinamentos" ? <TreinamentosSection /> : null}
      {module.slug === "fornecedores" ? <FornecedoresSection /> : null}
      {module.slug === "relatorios" ? <RelatoriosSection /> : null}
      {![
        "vistorias",
        "nao-conformidades",
        "temperaturas",
        "pops",
        "higienizacao",
        "documentos",
        "treinamentos",
        "fornecedores",
        "relatorios",
      ].includes(module.slug) ? (
        <PreparedSection notes={notes} />
      ) : null}
    </div>
  );
}
