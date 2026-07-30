import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Boxes,
  CalendarDays,
  ChefHat,
  ClipboardCheck,
  FileText,
  LineChart,
  LogIn,
  Mail,
  PackageCheck,
  ShieldCheck,
  Tags,
  Users,
  Utensils,
  Warehouse,
} from "lucide-react";

import { GestifyLogo } from "@/components/brand/GestifyLogo";
import { Button } from "@/components/ui/button";
import { PublicFooter } from "@/components/site/PublicFooter";

export const publicNavLinks = [
  { label: "Inicio", href: "/" },
  { label: "Recursos", href: "/recursos" },
  { label: "Solucoes", href: "/solucoes" },
  { label: "Sobre", href: "/sobre" },
  { label: "Conteudos", href: "/conteudos" },
  { label: "Demonstracao", href: "/demonstracao" },
];

const heroImageUrl =
  "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=1800&q=80";

const metrics = [
  "Menos perdas",
  "Mais rastreabilidade",
  "Mais controle de estoque",
  "Mais previsibilidade operacional",
];

export const featureModules = [
  {
    title: "Estoque",
    description:
      "Controle saldos, entradas, saidas, inventarios, niveis minimos e movimentacoes com mais seguranca.",
    icon: Warehouse,
  },
  {
    title: "Fichas tecnicas",
    description:
      "Padronize receitas, rendimentos, custos por porcao, CMV e historico de alteracoes.",
    icon: ClipboardCheck,
  },
  {
    title: "Compras",
    description:
      "Organize fornecedores, pedidos, recebimentos, notas e custo atualizado dos insumos.",
    icon: PackageCheck,
  },
  {
    title: "Producao",
    description:
      "Acompanhe demandas, separacao, preparo e etapas internas com mais ritmo e menos improviso.",
    icon: ChefHat,
  },
  {
    title: "Etiquetas",
    description:
      "Gere identificacoes para lotes, validade, revalidacao e rastreabilidade da producao.",
    icon: Tags,
  },
  {
    title: "Financeiro",
    description:
      "Entenda custos, perdas, margem, DRE e indicadores que ajudam na tomada de decisao.",
    icon: BarChart3,
  },
  {
    title: "Produtos",
    description:
      "Cadastre insumos, embalagens, utensilios, setores, unidades, curva ABC, custos e dados de operacao.",
    icon: Boxes,
  },
  {
    title: "Usuarios e permissoes",
    description:
      "Controle acessos por perfil, estabelecimento e funcao, reduzindo risco de alteracoes indevidas.",
    icon: Users,
  },
  {
    title: "Indicadores",
    description:
      "Acompanhe produtividade, acuracidade, desperdicios e desempenho operacional com mais clareza.",
    icon: LineChart,
  },
];

const flowSteps = [
  "Cadastre produtos, unidades, setores e fornecedores.",
  "Monte fichas tecnicas com custo, rendimento e CMV.",
  "Registre compras, entradas, perdas e ajustes.",
  "Organize producao, etiquetas e inventarios.",
  "Analise indicadores para comprar melhor, produzir melhor e perder menos.",
];

export const solutions = [
  {
    title: "Restaurante",
    description:
      "Para restaurantes que precisam controlar compras, estoque, fichas tecnicas, producao, perdas e margem em um unico lugar.",
    points: [
      "Custo real por prato",
      "Controle de insumos criticos",
      "Historico de entradas e perdas",
      "Padronizacao de receitas",
      "Indicadores de CMV e margem",
    ],
  },
  {
    title: "Confeitaria",
    description:
      "Para operacoes com receitas detalhadas, rendimento sensivel, validade curta e necessidade alta de padronizacao.",
    points: [
      "Fichas tecnicas completas",
      "Controle por setor",
      "Etiquetas de validade",
      "Rastreabilidade de producao",
      "Analise de custo por porcao",
    ],
  },
  {
    title: "Bar",
    description:
      "Para controlar bebidas, preparos, perdas, entradas, insumos de alto giro e custo operacional.",
    points: [
      "Estoque por unidade",
      "Inventario recorrente",
      "Controle de perdas",
      "Curva ABC",
      "Compras com base em consumo",
    ],
  },
  {
    title: "Cozinha central",
    description:
      "Para operacoes que produzem, separam e distribuem internamente com necessidade de controle, escala e rastreabilidade.",
    points: [
      "Organizacao da producao",
      "Separacao por demanda",
      "Etiquetas e lotes",
      "Controle de setores",
      "Relatorios operacionais",
    ],
  },
];

const timeline = [
  {
    year: "2010",
    title: "Inicio na gastronomia",
    text: "Contato direto com producao, disciplina, custo, padronizacao e impacto das pequenas falhas no resultado final.",
  },
  {
    year: "2018",
    title: "Primeiros controles estruturados",
    text: "Planilhas, fichas tecnicas, indicadores e processos mostraram que a operacao precisava de mais organizacao.",
  },
  {
    year: "2021",
    title: "Visao de produto",
    text: "A necessidade deixou de ser apenas controlar uma cozinha e passou a ser criar uma ferramenta para outras operacoes.",
  },
  {
    year: "2024",
    title: "Evolucao do sistema",
    text: "O Gestify ganhou modulos para estoque, fichas tecnicas, compras, perdas, etiquetas, producao e financeiro.",
  },
  {
    year: "2026",
    title: "Plataforma em expansao",
    text: "O foco passa a ser escalar uma solucao SaaS para restaurantes e operacoes alimenticias que precisam de controle real.",
  },
];

const articles = [
  {
    category: "Perdas",
    title: "Como reduzir perdas sem depender apenas da equipe",
    summary:
      "Processo, rastreabilidade e dados ajudam a separar falha operacional de falta de visibilidade.",
  },
  {
    category: "CMV e margem",
    title: "O que e CMV e por que ele decide a saude do restaurante",
    summary:
      "Entenda como custo de mercadoria vendida conecta compra, estoque, ficha tecnica e preco.",
  },
  {
    category: "Fichas tecnicas",
    title: "Ficha tecnica: o documento que protege sua margem",
    summary:
      "Padronizar receita, rendimento e custo evita decisoes no escuro e reduz retrabalho.",
  },
  {
    category: "Estoque",
    title: "Estoque minimo, medio e maximo: como evitar compra no escuro",
    summary:
      "Politicas simples de estoque ajudam a comprar melhor e manter insumos criticos sob controle.",
  },
  {
    category: "Inventario",
    title: "Inventario em restaurante: como transformar contagem em decisao",
    summary:
      "A contagem fisica vira gestao quando e comparada ao saldo teorico e ao historico de movimentos.",
  },
  {
    category: "Operacao",
    title: "Por que planilhas param de funcionar quando a operacao cresce",
    summary:
      "Quando processos e equipes aumentam, dados soltos criam atraso, inconsistencias e pouca confianca.",
  },
];

function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[#E2E6EA] bg-white/90 backdrop-blur">
      <div className="mx-auto flex min-h-20 max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <Link href="/" className="w-fit">
          <GestifyLogo
            size={48}
            showText
            subtitle="Gestao gastronomica em uma unica plataforma"
          />
        </Link>

        <nav className="flex flex-wrap items-center gap-1 text-sm font-semibold text-[#4B5563]">
          {publicNavLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 transition hover:bg-[#F1F4F7] hover:text-[#17212B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8A640]"
            >
              {link.label}
            </Link>
          ))}
          <Button
            asChild
            className="ml-1 bg-[#17212B] text-white hover:bg-[#243241]"
          >
            <Link href="/login">
              <LogIn className="size-4" />
              Entrar
            </Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}

export function PublicPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F7F8FA] text-[#1F2328]">
      <PublicHeader />
      <main>{children}</main>
      <PublicFooter />
    </div>
  );
}

function SectionIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      {eyebrow ? (
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#8B6B25]">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-3 text-3xl font-black tracking-tight text-[#17212B] sm:text-4xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 text-base leading-8 text-[#5F6875] sm:text-lg">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function ModuleGrid({ limit }: { limit?: number }) {
  const items = typeof limit === "number" ? featureModules.slice(0, limit) : featureModules;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((module) => {
        const Icon = module.icon;
        return (
          <article
            key={module.title}
            className="rounded-lg border border-[#E2E6EA] bg-white p-6 shadow-[0_8px_24px_rgba(23,33,43,0.05)]"
          >
            <div className="flex size-11 items-center justify-center rounded-md bg-[#E7EDF3] text-[#17212B]">
              <Icon className="size-5" />
            </div>
            <h3 className="mt-5 text-xl font-black text-[#17212B]">
              {module.title}
            </h3>
            <p className="mt-3 text-sm leading-7 text-[#5F6875]">
              {module.description}
            </p>
          </article>
        );
      })}
    </div>
  );
}

function KitchenVisual() {
  return (
    <div className="overflow-hidden rounded-lg border border-white/20 bg-white/10 shadow-2xl shadow-black/25">
      <div
        className="min-h-[360px] bg-cover bg-center"
        style={{ backgroundImage: `url(${heroImageUrl})` }}
      >
        <div className="flex min-h-[360px] flex-col justify-end bg-gradient-to-t from-[#17212B]/90 via-[#17212B]/45 to-transparent p-6 text-white">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#F2D38D]">
            Operacao conectada
          </p>
          <p className="mt-3 max-w-md text-2xl font-black">
            Estoque, compras, producao e indicadores no mesmo ritmo.
          </p>
        </div>
      </div>
    </div>
  );
}

export function PublicHomePage() {
  return (
    <PublicPageShell>
      <section className="bg-[#17212B]">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-20">
          <div className="flex flex-col justify-center text-white">
            <p className="w-fit rounded-md border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-[#F2D38D]">
              Plataforma SaaS para gestao gastronomica
            </p>
            <h1 className="mt-6 max-w-4xl text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Gestao inteligente para restaurantes que precisam de controle real
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200">
              O Gestify centraliza estoque, compras, fichas tecnicas, producao,
              etiquetas, perdas, financeiro e indicadores em uma unica plataforma
              para operacoes alimenticias.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="bg-[#D8A640] text-[#17212B] hover:bg-[#E8BD5C]"
              >
                <Link href="/login">
                  Acessar sistema
                  <LogIn className="size-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/25 bg-white/5 text-white hover:bg-white hover:text-[#17212B]"
              >
                <Link href="/demonstracao">
                  Agendar demonstracao
                  <CalendarDays className="size-4" />
                </Link>
              </Button>
            </div>
            <div className="mt-10 grid gap-3 sm:grid-cols-2">
              {metrics.map((metric) => (
                <div
                  key={metric}
                className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/10 px-4 py-3"
                >
                  <BadgeCheck className="size-5 text-[#D8A640]" />
                  <span className="text-sm font-semibold">{metric}</span>
                </div>
              ))}
            </div>
          </div>

          <KitchenVisual />
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <SectionIntro
            eyebrow="O que o Gestify resolve"
            title="Menos planilhas, menos retrabalho, mais clareza no dia a dia"
            description="Quando pedidos, estoque, compras, fichas tecnicas e producao ficam espalhados, a operacao perde tempo, margem e confiabilidade. O Gestify organiza esses processos em um ambiente unico para que gestores e equipes trabalhem com dados mais consistentes."
          />
          <div className="mt-12">
            <ModuleGrid limit={6} />
          </div>
        </div>
      </section>

      <section className="bg-[#F7F8FA]">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:px-8">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#8B6B25]">
              Fluxo Gestify
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-[#17212B] sm:text-4xl">
              Do cadastro ao resultado: uma operacao mais conectada
            </h2>
            <p className="mt-5 text-base leading-8 text-[#5F6875]">
              A plataforma organiza o caminho operacional inteiro, do insumo ao
              indicador, para reduzir decisao improvisada.
            </p>
          </div>
          <div className="space-y-3">
            {flowSteps.map((step, index) => (
              <div
                key={step}
                className="flex gap-4 rounded-lg border border-[#E2E6EA] bg-white p-5"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-[#17212B] text-sm font-black text-white">
                  {index + 1}
                </span>
                <p className="self-center text-sm font-semibold leading-7 text-[#313A46]">
                  {step}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PublicCta />
    </PublicPageShell>
  );
}

export function RecursosPageContent() {
  return (
    <PublicPageShell>
      <PublicHero
        eyebrow="Recursos"
        title="Recursos criados para a rotina real de restaurantes"
        description="O Gestify foi pensado para quem precisa controlar insumos, producao, equipe e margem sem depender de controles soltos."
      />
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <ModuleGrid />
        </div>
      </section>
      <PublicCta />
    </PublicPageShell>
  );
}

export function SolucoesPageContent() {
  return (
    <PublicPageShell>
      <PublicHero
        eyebrow="Solucoes"
        title="Solucoes para diferentes tipos de operacao gastronomica"
        description="O Gestify se adapta a restaurantes, bares, confeitarias, cozinhas de producao e negocios alimenticios que precisam crescer com processo."
      />
      <section className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 py-20 sm:px-6 md:grid-cols-2 lg:px-8">
          {solutions.map((solution) => (
            <article
              key={solution.title}
              className="rounded-lg border border-[#E2E6EA] bg-[#F7F8FA] p-6"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-md bg-[#17212B] text-white">
                  <Utensils className="size-5" />
                </div>
                <h2 className="text-2xl font-black text-[#17212B]">
                  {solution.title}
                </h2>
              </div>
              <p className="mt-5 text-sm leading-7 text-[#5F6875]">
                {solution.description}
              </p>
              <div className="mt-5 grid gap-2">
                {solution.points.map((point) => (
                  <div key={point} className="flex items-start gap-2">
                    <ShieldCheck className="mt-0.5 size-4 text-[#8B6B25]" />
                    <span className="text-sm font-semibold text-[#313A46]">
                      {point}
                    </span>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
      <PublicCta />
    </PublicPageShell>
  );
}

export function SobrePageContent() {
  return (
    <PublicPageShell>
      <PublicHero
        eyebrow="Sobre"
        title="Criado a partir da rotina real de uma operacao gastronomica"
        description="O Gestify nasceu da necessidade de resolver problemas que aparecem todos os dias dentro de restaurantes: estoque impreciso, compras sem base confiavel, fichas tecnicas desatualizadas, perdas sem rastreabilidade e decisoes tomadas com informacoes espalhadas."
      />
      <section className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div>
            <h2 className="text-3xl font-black text-[#17212B]">
              Tecnologia com pe na operacao
            </h2>
            <p className="mt-5 text-base leading-8 text-[#5F6875]">
              A plataforma une experiencia pratica de operacao com tecnologia
              para transformar processos manuais em uma gestao mais clara,
              padronizada e previsivel.
            </p>
            <div className="mt-8 rounded-lg border border-[#E2E6EA] bg-[#F7F8FA] p-6">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#8B6B25]">
                Manifesto
              </p>
              <p className="mt-4 text-base leading-8 text-[#313A46]">
                Acreditamos que uma boa operacao nao depende apenas de talento.
                Ela depende de processo, clareza, padronizacao, dados e
                disciplina. O Gestify existe para ajudar negocios gastronomicos
                a reduzir perdas, tomar decisoes melhores e crescer com mais
                seguranca.
              </p>
            </div>
          </div>
          <div className="space-y-4">
            {timeline.map((item) => (
              <article
                key={item.year}
                className="rounded-lg border border-[#E2E6EA] bg-[#F7F8FA] p-5"
              >
                <p className="text-sm font-black text-[#8B6B25]">{item.year}</p>
                <h3 className="mt-2 text-lg font-black text-[#17212B]">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-7 text-[#5F6875]">
                  {item.text}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <PublicCta />
    </PublicPageShell>
  );
}

export function ConteudosPageContent() {
  return (
    <PublicPageShell>
      <PublicHero
        eyebrow="Conteudos"
        title="Conteudos para uma gestao gastronomica mais inteligente"
        description="Guias, ideias e boas praticas sobre estoque, CMV, fichas tecnicas, compras, perdas e produtividade."
      />
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-wrap gap-2">
            {[
              "Estoque",
              "CMV e margem",
              "Fichas tecnicas",
              "Compras",
              "Producao",
              "Perdas",
              "Gestao financeira",
            ].map((category) => (
              <span
                key={category}
                className="rounded-md border border-[#E2E6EA] bg-[#F7F8FA] px-3 py-2 text-sm font-semibold text-[#4B5563]"
              >
                {category}
              </span>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {articles.map((article) => (
              <article
                key={article.title}
                className="rounded-lg border border-[#E2E6EA] bg-[#F7F8FA] p-6"
              >
                <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#8B6B25]">
                  {article.category}
                </p>
                <h2 className="mt-4 text-xl font-black leading-snug text-[#17212B]">
                  {article.title}
                </h2>
                <p className="mt-3 text-sm leading-7 text-[#5F6875]">
                  {article.summary}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <PublicCta />
    </PublicPageShell>
  );
}

export function PublicHero({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className="bg-[#17212B]">
      <div className="mx-auto max-w-7xl px-4 py-16 text-white sm:px-6 lg:px-8 lg:py-20">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#F2D38D]">
          {eyebrow}
        </p>
        <h1 className="mt-4 max-w-4xl text-4xl font-black leading-tight tracking-tight sm:text-5xl">
          {title}
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-200">
          {description}
        </p>
      </div>
    </section>
  );
}

export function PublicCta() {
  return (
    <section className="bg-[#17212B]">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-14 text-white sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#F2D38D]">
            Proximo passo
          </p>
          <h2 className="mt-3 max-w-3xl text-3xl font-black tracking-tight">
            Veja como o Gestify pode organizar sua operacao.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
            A demonstracao ajuda a entender se a plataforma faz sentido para o
            seu momento e quais processos devem ser priorizados.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            asChild
            className="bg-[#D8A640] text-[#17212B] hover:bg-[#E8BD5C]"
          >
            <Link href="/demonstracao">
              Solicitar demonstracao
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="border-white/25 bg-white/5 text-white hover:bg-white hover:text-[#17212B]"
          >
            <Link href="/login">
              Acessar sistema
              <LogIn className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

export function DemoSupportBlock() {
  return (
    <div className="rounded-lg border border-[#E2E6EA] bg-white p-6">
      <div className="flex size-11 items-center justify-center rounded-md bg-[#E7EDF3] text-[#17212B]">
        <Mail className="size-5" />
      </div>
      <h2 className="mt-5 text-2xl font-black text-[#17212B]">
        Uma conversa objetiva sobre sua operacao
      </h2>
      <p className="mt-4 text-sm leading-7 text-[#5F6875]">
        Conte um pouco sobre seu restaurante ou operacao. Vamos entender seu
        momento e indicar a melhor forma de usar o Gestify. Se ainda nao for o
        momento ideal, o contato tambem serve para orientar quais processos
        organizar primeiro.
      </p>
      <div className="mt-6 grid gap-3">
        {[
          "Controle de estoque",
          "Fichas tecnicas e CMV",
          "Compras e fornecedores",
          "Producao e etiquetas",
          "Financeiro e indicadores",
        ].map((item) => (
          <div key={item} className="flex items-center gap-2 text-sm font-semibold text-[#313A46]">
            <FileText className="size-4 text-[#8B6B25]" />
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
