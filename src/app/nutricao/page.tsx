import {
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { NUTRICAO_SUBMODULES } from "@/lib/nutricao/navigation";
import { getNutritionSummary } from "./actions";

export const dynamic = "force-dynamic";

const workflowSteps = [
  "Não conformidade",
  "Responsável",
  "Prazo",
  "Evidência",
  "Correção",
  "Reinspeção",
  "Encerramento",
];

export default async function NutricaoPage() {
  const summary = await getNutritionSummary();
  const summaryCards = [
    {
      title: "Vistorias hoje",
      value: summary.inspectionsToday,
      detail: "Agendadas para o dia atual no estabelecimento ativo.",
    },
    {
      title: "Em andamento",
      value: summary.inspectionsInProgress,
      detail: "Vistorias iniciadas ou pausadas aguardando conclusão.",
    },
    {
      title: "Não conformidades",
      value: summary.openNonconformities,
      detail: "Ocorrências abertas, em correção ou validação.",
    },
    {
      title: "Críticas",
      value: summary.criticalNonconformities,
      detail: "Ocorrências críticas que exigem prioridade operacional.",
    },
    {
      title: "Ações vencidas",
      value: summary.overdueActions,
      detail: "Itens de plano de ação fora do prazo configurado.",
    },
    {
      title: "Documentos a vencer",
      value: summary.expiringDocuments,
      detail: "Documentos com validade nos próximos 30 dias.",
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <section className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950 dark:text-emerald-200">
                <ShieldCheck className="h-4 w-4" />
                Nutrição
              </div>
              <h1 className="text-2xl font-bold text-slate-950 dark:text-white md:text-3xl">
                Segurança dos alimentos e controles sanitários
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                Central para vistorias, temperaturas, POPs, higienização,
                documentos, fornecedores e planos de ação por estabelecimento.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
              <p className="font-semibold text-slate-950 dark:text-white">
                Fase 1 ativa
              </p>
              <p className="mt-1">
                Indicadores e fluxos iniciais preparados por estabelecimento.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold uppercase text-slate-500 dark:text-slate-400">
            Ciclo obrigatório
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {workflowSteps.map((step) => (
              <span
                key={step}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
              >
                {step}
              </span>
            ))}
          </div>
        </div>
      </section>

      {summary.message ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm dark:border-amber-900/60 dark:bg-amber-950 dark:text-amber-100">
          <p className="font-semibold">Banco de Nutrição pendente</p>
          <p className="mt-1">{summary.message}</p>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {summaryCards.map((card) => (
          <div
            key={card.title}
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {card.title}
            </p>
            <p className="mt-2 text-lg font-bold text-slate-950 dark:text-white">
              {card.value}
            </p>
            <p className="mt-2 text-sm leading-5 text-slate-600 dark:text-slate-300">
              {card.detail}
            </p>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-950 dark:text-white">
              Submódulos
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Estrutura inicial prevista para o módulo Nutrição.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {NUTRICAO_SUBMODULES.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                href={item.href}
                key={item.title}
                className={`rounded-lg border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-950 ${item.tone}`}
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/70 bg-white text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-semibold text-slate-950 dark:text-white">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300">
                      {item.description}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
