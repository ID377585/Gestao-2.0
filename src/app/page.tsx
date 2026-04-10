import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";

const features = [
  {
    title: "Mais controle de estoque",
    description:
      "Acompanhe entradas, saídas, níveis críticos, inventários e saldo operacional em um único lugar.",
    icon: "📦",
  },
  {
    title: "Menos perdas e desperdícios",
    description:
      "Registre perdas, valide etiquetas e reduza falhas que impactam custo, margem e operação.",
    icon: "⚠️",
  },
  {
    title: "Etiquetas e rastreabilidade",
    description:
      "Imprima etiquetas com rapidez, organize lotes, revalidação e tenha mais segurança no processo.",
    icon: "🏷️",
  },
  {
    title: "Produção mais organizada",
    description:
      "Dê mais fluidez ao time com acompanhamento de pedidos, preparo, separação e produtividade.",
    icon: "👨‍🍳",
  },
  {
    title: "Mais agilidade no dia a dia",
    description:
      "Reduza retrabalho, centralize informações e economize tempo em processos que antes ficavam espalhados.",
    icon: "⏱️",
  },
  {
    title: "Gestão orientada por dados",
    description:
      "Tenha histórico, exportações e visão operacional para decidir melhor compras, produção e abastecimento.",
    icon: "📊",
  },
];

const modules = [
  "Pedidos",
  "Produção",
  "Estoque",
  "Inventário",
  "Etiquetas",
  "Perdas",
  "Produtividade",
  "Usuários",
];

const pains = [
  "Falta de controle real do estoque",
  "Perdas por validade, falhas e desperdícios",
  "Produção desorganizada e retrabalho",
  "Dificuldade para rastrear etiquetas e lotes",
  "Compras feitas sem base confiável",
  "Informações espalhadas em planilhas e anotações",
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.14),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(37,99,235,0.18),_transparent_30%)] pointer-events-none" />

      <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 to-green-500 shadow-lg shadow-green-500/20">
              <span className="text-lg font-bold text-white">G2</span>
            </div>

            <div>
              <p className="text-2xl font-bold tracking-tight">Gestify</p>
              <p className="text-xs text-slate-400">
                Gestão inteligente para restaurantes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button
                variant="outline"
                className="border-white/20 bg-transparent text-white hover:bg-white hover:text-slate-950"
              >
                Entrar
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="mx-auto grid max-w-7xl gap-14 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-28">
            <div className="flex flex-col justify-center">
              <div className="mb-6 inline-flex w-fit items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-300">
                Mais controle, menos perdas, mais tempo para operar
              </div>

              <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
                Controle pedidos, estoque, produção e etiquetas em uma única
                plataforma.
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
                O Gestify ajuda restaurantes e operações alimentícias a
                organizarem o dia a dia com mais agilidade, menos desperdício e
                mais previsibilidade operacional.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/login">
                  <Button
                    size="lg"
                    className="h-12 rounded-xl bg-gradient-to-r from-blue-600 to-green-500 px-8 text-base font-semibold text-white hover:from-blue-500 hover:to-green-400"
                  >
                    Acessar sistema
                  </Button>
                </Link>

                <a href="#recursos">
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 rounded-xl border-white/15 bg-white/5 px-8 text-base text-white hover:bg-white hover:text-slate-950"
                  >
                    Ver recursos
                  </Button>
                </a>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-2xl font-bold text-white">+ controle</p>
                  <p className="mt-1 text-sm text-slate-400">
                    sobre estoque, perdas e operação
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-2xl font-bold text-white">- retrabalho</p>
                  <p className="mt-1 text-sm text-slate-400">
                    com processos mais claros e centralizados
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-2xl font-bold text-white">+ agilidade</p>
                  <p className="mt-1 text-sm text-slate-400">
                    para produzir, conferir e decidir
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center">
              <div className="w-full rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/30 backdrop-blur">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Card className="border-white/10 bg-slate-900/70 text-white">
                    <CardContent className="p-5">
                      <div className="text-sm text-slate-400">Estoque</div>
                      <div className="mt-2 text-3xl font-bold">Controle ativo</div>
                      <p className="mt-2 text-sm text-slate-300">
                        Visualize níveis críticos, inventário e saldo operacional.
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-white/10 bg-slate-900/70 text-white">
                    <CardContent className="p-5">
                      <div className="text-sm text-slate-400">Etiquetas</div>
                      <div className="mt-2 text-3xl font-bold">Mais rastreio</div>
                      <p className="mt-2 text-sm text-slate-300">
                        Imprima, valide e acompanhe etiquetas com mais organização.
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-white/10 bg-slate-900/70 text-white">
                    <CardContent className="p-5">
                      <div className="text-sm text-slate-400">Perdas</div>
                      <div className="mt-2 text-3xl font-bold">Menos desperdício</div>
                      <p className="mt-2 text-sm text-slate-300">
                        Registre ocorrências e reduza impacto operacional e financeiro.
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-white/10 bg-slate-900/70 text-white">
                    <CardContent className="p-5">
                      <div className="text-sm text-slate-400">Produção</div>
                      <div className="mt-2 text-3xl font-bold">Fluxo melhor</div>
                      <p className="mt-2 text-sm text-slate-300">
                        Organize pedidos, preparo e produtividade em um só ambiente.
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-5">
                  <p className="text-sm font-medium text-emerald-300">
                    Resultado esperado
                  </p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    Mais clareza operacional para decidir melhor, comprar melhor e perder menos.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="recursos" className="border-y border-white/10 bg-slate-900/60">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-300">
                Recursos que fortalecem a operação
              </p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Uma plataforma pensada para reduzir falhas e otimizar tempo
              </h2>
              <p className="mt-4 text-lg text-slate-400">
                Em vez de operar com informações soltas, sua equipe trabalha com
                mais organização, mais velocidade e mais previsibilidade.
              </p>
            </div>

            <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {features.map((feature) => (
                <Card
                  key={feature.title}
                  className="rounded-3xl border-white/10 bg-white/5 text-white"
                >
                  <CardContent className="p-6">
                    <div className="mb-4 text-3xl">{feature.icon}</div>
                    <h3 className="text-xl font-semibold">{feature.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-300">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-slate-950">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">
                O que o Gestify ajuda a resolver
              </p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Menos caos operacional. Mais controle real no dia a dia.
              </h2>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-400">
                Quando pedidos, estoque, perdas, etiquetas e produção ficam
                desconectados, a operação perde tempo, margem e previsibilidade.
                O Gestify centraliza isso para apoiar uma gestão mais eficiente.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                {modules.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
              <h3 className="text-2xl font-semibold text-white">
                Dores comuns da operação
              </h3>

              <div className="mt-6 space-y-4">
                {pains.map((pain) => (
                  <div
                    key={pain}
                    className="flex items-start gap-3 rounded-2xl border border-white/8 bg-slate-900/70 p-4"
                  >
                    <span className="mt-0.5 text-emerald-300">✓</span>
                    <p className="text-slate-200">{pain}</p>
                  </div>
                ))}
              </div>

              <div className="mt-8 rounded-2xl bg-gradient-to-r from-blue-600/20 to-green-500/20 p-5">
                <p className="text-sm text-slate-300">
                  Com processos mais centralizados, sua operação ganha mais ritmo,
                  mais segurança e mais capacidade de crescimento.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-white/10 bg-slate-900/70">
          <div className="mx-auto max-w-7xl px-4 py-20 text-center sm:px-6 lg:px-8">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-300">
              Pronto para centralizar a operação?
            </p>

            <h2 className="mx-auto mt-4 max-w-4xl text-3xl font-bold tracking-tight text-white sm:text-5xl">
              Menos planilhas, menos retrabalho, mais controle para o seu restaurante.
            </h2>

            <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
              Acesse o sistema e concentre pedidos, estoque, produção, perdas,
              etiquetas e produtividade em um único ambiente.
            </p>

            <div className="mt-8">
              <Link href="/login">
                <Button
                  size="lg"
                  className="h-12 rounded-xl bg-gradient-to-r from-blue-600 to-green-500 px-8 text-base font-semibold text-white hover:from-blue-500 hover:to-green-400"
                >
                  Entrar no sistema
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-slate-950">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-slate-400 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <p>© 2026 Gestify. Plataforma de gestão para restaurantes e operações alimentícias.</p>
          <p>gestify.app</p>
        </div>
      </footer>
    </div>
  );
}