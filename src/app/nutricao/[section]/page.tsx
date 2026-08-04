import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Database,
  FileClock,
  ShieldCheck,
} from "lucide-react";
import {
  getNutricaoSubmodule,
  NUTRICAO_SUBMODULES,
} from "@/lib/nutricao/navigation";

type NutricaoSectionPageProps = {
  params: Promise<{
    section: string;
  }>;
};

const implementationNotes: Record<string, string[]> = {
  vistorias: [
    "Modelos versionados e execuções ficam separados para preservar o histórico.",
    "Cada execução deve guardar snapshot do modelo usado.",
    "Conclusão de vistoria será imutável nas próximas fases.",
  ],
  "nao-conformidades": [
    "Ocorrências terão responsável, prazo, evidência e reinspeção.",
    "Cancelamento exige justificativa e não apaga histórico.",
    "Gravidade crítica deve gerar alerta e validação segregada.",
  ],
  temperaturas: [
    "Pontos de controle terão limites configuráveis por estabelecimento.",
    "Medição fora do limite poderá abrir não conformidade.",
    "Termômetros e vencimentos de calibração ficam rastreáveis.",
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
  relatorios: [
    "Relatórios serão gerados no servidor em PDF/DOCX.",
    "Cada geração terá versão, hash e trilha de entrega.",
    "Envios externos devem passar por fila e idempotência.",
  ],
};

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

          <span className="w-fit rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase text-amber-800 dark:border-amber-900/60 dark:bg-amber-950 dark:text-amber-200">
            Fundação
          </span>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <Database className="h-5 w-5 text-slate-500" />
            <h2 className="font-semibold text-slate-950 dark:text-white">
              Estado atual
            </h2>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Esta tela ainda não consulta registros reais porque a migration do módulo
            deve ser aplicada antes de liberar operações. O estado vazio é
            intencional para não criar dados artificiais.
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
    </div>
  );
}
