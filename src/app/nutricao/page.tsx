import {
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { NUTRICAO_SUBMODULES } from "@/lib/nutricao/navigation";

const summaryCards = [
  {
    title: "Vistorias",
    value: "Estrutura inicial",
    detail: "Modelos, agenda e execução serão conectados nas próximas fases.",
  },
  {
    title: "Não conformidades",
    value: "Ciclo rastreável",
    detail: "Ocorrência, responsável, prazo, evidência, reinspeção e encerramento.",
  },
  {
    title: "Documentos",
    value: "Controle sanitário",
    detail: "POPs, treinamentos, evidências e vencimentos no mesmo módulo.",
  },
  {
    title: "Permissões",
    value: "Por estabelecimento",
    detail: "Acesso controlado pelo módulo Nutrição no cadastro de usuários.",
  },
];

const workflowSteps = [
  "Não conformidade",
  "Responsável",
  "Prazo",
  "Evidência",
  "Correção",
  "Reinspeção",
  "Encerramento",
];

export default function NutricaoPage() {
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
                Menu, permissão e rota principal preparados para evolução segura.
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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
