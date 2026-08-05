import {
  AlertTriangle,
  CalendarClock,
  ClipboardCheck,
  FileCheck2,
  FileText,
  GraduationCap,
  ListChecks,
  Settings,
  ShieldCheck,
  Sparkles,
  Thermometer,
  Truck,
  type LucideIcon,
} from "lucide-react";

export type NutricaoSubmodule = {
  slug: string;
  title: string;
  menuLabel: string;
  href: string;
  description: string;
  icon: LucideIcon;
  tone: string;
  status: "foundation" | "next";
};

export const NUTRICAO_SUBMODULES: NutricaoSubmodule[] = [
  {
    slug: "visao-geral",
    title: "Visão geral",
    menuLabel: "Visão geral",
    href: "/nutricao",
    description: "Indicadores, filtros, atividades recentes e próximos vencimentos.",
    icon: ShieldCheck,
    tone: "border-slate-200 bg-white",
    status: "foundation",
  },
  {
    slug: "vistorias",
    title: "Vistorias",
    menuLabel: "Vistorias",
    href: "/nutricao/vistorias",
    description: "Modelos versionados, agendamentos, execução e assinaturas.",
    icon: ClipboardCheck,
    tone: "border-emerald-200 bg-emerald-50",
    status: "foundation",
  },
  {
    slug: "temperaturas",
    title: "Temperaturas",
    menuLabel: "Temperaturas",
    href: "/nutricao/temperaturas",
    description: "Medições, limites, histórico e alertas de variação.",
    icon: Thermometer,
    tone: "border-sky-200 bg-sky-50",
    status: "foundation",
  },
  {
    slug: "pops",
    title: "POPs",
    menuLabel: "POPs",
    href: "/nutricao/pops",
    description: "Procedimentos, versões, aprovação e consulta operacional.",
    icon: FileCheck2,
    tone: "border-violet-200 bg-violet-50",
    status: "foundation",
  },
  {
    slug: "higienizacao",
    title: "Higienização",
    menuLabel: "Higienização",
    href: "/nutricao/higienizacao",
    description: "Rotinas, responsáveis, evidências e atrasos.",
    icon: ListChecks,
    tone: "border-cyan-200 bg-cyan-50",
    status: "foundation",
  },
  {
    slug: "nao-conformidades",
    title: "Não conformidades",
    menuLabel: "Não conformidades",
    href: "/nutricao/nao-conformidades",
    description: "Gravidade, responsável, prazo, evidência e reinspeção.",
    icon: AlertTriangle,
    tone: "border-rose-200 bg-rose-50",
    status: "foundation",
  },
  {
    slug: "planos-de-acao",
    title: "Planos de ação",
    menuLabel: "Planos de ação",
    href: "/nutricao/planos-de-acao",
    description: "Correções atribuídas, vencimentos e aprovações.",
    icon: CalendarClock,
    tone: "border-amber-200 bg-amber-50",
    status: "foundation",
  },
  {
    slug: "treinamentos",
    title: "Treinamentos",
    menuLabel: "Treinamentos",
    href: "/nutricao/treinamentos",
    description: "Participantes, validade, anexos e pendências.",
    icon: GraduationCap,
    tone: "border-indigo-200 bg-indigo-50",
    status: "foundation",
  },
  {
    slug: "documentos",
    title: "Documentos",
    menuLabel: "Documentos",
    href: "/nutricao/documentos",
    description: "Arquivos sanitários, validade, evidências e histórico.",
    icon: FileText,
    tone: "border-slate-200 bg-slate-50",
    status: "foundation",
  },
  {
    slug: "fornecedores",
    title: "Fornecedores",
    menuLabel: "Fornecedores",
    href: "/nutricao/fornecedores",
    description: "Avaliação sanitária, documentos e reincidências.",
    icon: Truck,
    tone: "border-orange-200 bg-orange-50",
    status: "foundation",
  },
  {
    slug: "relatorios",
    title: "Relatórios",
    menuLabel: "Relatórios",
    href: "/nutricao/relatorios",
    description: "Conformidade, pendências, reincidências e exportações.",
    icon: Sparkles,
    tone: "border-lime-200 bg-lime-50",
    status: "foundation",
  },
  {
    slug: "configuracoes",
    title: "Configurações",
    menuLabel: "Configurações",
    href: "/nutricao/configuracoes",
    description: "Prazos, gravidades, setores, modelos e destinatários.",
    icon: Settings,
    tone: "border-zinc-200 bg-zinc-50",
    status: "foundation",
  },
];

export function getNutricaoSubmodule(slug: string) {
  return NUTRICAO_SUBMODULES.find((item) => item.slug === slug) ?? null;
}
