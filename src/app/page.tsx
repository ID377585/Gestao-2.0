import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { GestifyLogo } from "@/components/brand/GestifyLogo";
import { PublicFooter } from "@/components/site/PublicFooter";

const features = [
  {
    title: "Controle de estoque com mais precisão",
    description:
      "Acompanhe saldos, níveis críticos, inventários, entradas e saídas em uma operação mais organizada.",
    icon: "📦",
  },
  {
    title: "Redução de perdas e desperdícios",
    description:
      "Registre perdas, acompanhe ocorrências e tenha mais clareza sobre o que impacta seu custo operacional.",
    icon: "⚠️",
  },
  {
    title: "Etiquetas e rastreabilidade",
    description:
      "Imprima etiquetas, organize lotes, revalidações e ganhe mais segurança no fluxo de produção e separação.",
    icon: "🏷️",
  },
  {
    title: "Mais agilidade na produção",
    description:
      "Estruture melhor pedidos, preparo, separação e etapas da operação para reduzir retrabalho.",
    icon: "⚙️",
  },
  {
    title: "Mais tempo para gerir",
    description:
      "Centralize informações em uma plataforma única e reduza o caos de processos espalhados.",
    icon: "⏱️",
  },
  {
    title: "Decisões com base em dados",
    description:
      "Use relatórios, histórico e visão operacional para comprar melhor, produzir melhor e perder menos.",
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

const painPoints = [
  "Falta de controle real do estoque",
  "Desperdícios que reduzem a margem",
  "Produção desorganizada e retrabalho",
  "Etiquetas e lotes sem rastreabilidade clara",
  "Compras sem base operacional confiável",
  "Informações espalhadas em planilhas e anotações",
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.18),transparent_28%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.16),transparent_24%),linear-gradient(to_bottom,rgba(15,23,42,0.96),rgba(2,6,23,1))]" />

      <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/75 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <GestifyLogo
            size={52}
            showText
            subtitle="Gestão inteligente para restaurantes"
            textClassName="hidden sm:block"
          />

          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button
                variant="outline"
                className="border-white/15 bg-white/5 text-white hover:bg-white hover:text-slate-950"
              >
                Entrar
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="relative">
        <section className="overflow-hidden">
          <div className="mx-auto grid max-w-7xl gap-14 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-28">
            <div className="flex flex-col justify-center">
              <div className="mb-6 inline-flex w-fit items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-300">
                Mais controle, menos perdas, mais eficiência operacional
              </div>

              <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
                O sistema que ajuda sua operação a ganhar tempo, controle e previsibilidade.
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
                O Gestify centraliza pedidos, produção, estoque, perdas, etiquetas e
                produtividade em uma única plataforma moderna para restaurantes e operações
                alimentícias.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/login">
                  <Button
                    size="lg"
                    className="h-12 rounded-xl bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 px-8 text-base font-semibold text-white hover:from-blue-500 hover:via-cyan-400 hover:to-emerald-400"
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
                  <p className="text-2xl font-bold text-white">+ agilidade</p>
                  <p className="mt-1 text-sm text-slate-400">
                    no controle do dia a dia
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-2xl font-bold text-white">- desperdício</p>
                  <p className="mt-1 text-sm text-slate-400">
                    com mais rastreabilidade
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-2xl font-bold text-white">+ controle</p>
                  <p className="mt-1 text-sm text-slate-400">
                    sobre estoque e operação
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
                        Visualize níveis críticos, inventários e movimentação com mais clareza.
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-white/10 bg-slate-900/70 text-white">
                    <CardContent className="p-5">
                      <div className="text-sm text-slate-400">Etiquetas</div>
                      <div className="mt-2 text-3xl font-bold">Mais rastreio</div>
                      <p className="mt-2 text-sm text-slate-300">
                        Organize lotes, impressão e identificação com rapidez.
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-white/10 bg-slate-900/70 text-white">
                    <CardContent className="p-5">
                      <div className="text-sm text-slate-400">Perdas</div>
                      <div className="mt-2 text-3xl font-bold">Menos impacto</div>
                      <p className="mt-2 text-sm text-slate-300">
                        Registre causas e reduza desperdícios que afetam sua margem.
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-white/10 bg-slate-900/70 text-white">
                    <CardContent className="p-5">
                      <div className="text-sm text-slate-400">Produção</div>
                      <div className="mt-2 text-3xl font-bold">Fluxo melhor</div>
                      <p className="mt-2 text-sm text-slate-300">
                        Mais organização para produzir, separar e entregar melhor.
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-5">
                  <p className="text-sm font-medium text-emerald-300">
                    Resultado esperado
                  </p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    Mais eficiência operacional para comprar melhor, produzir melhor e perder menos.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="recursos" className="border-y border-white/10 bg-slate-900/60">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
                Recursos que fortalecem a operação
              </p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Uma plataforma pensada para reduzir falhas e otimizar tempo
              </h2>
              <p className="mt-4 text-lg text-slate-400">
                Em vez de operar com informações soltas, sua equipe trabalha com mais
                organização, mais velocidade e mais previsibilidade.
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
                Quando pedidos, estoque, perdas, etiquetas e produção ficam desconectados,
                a operação perde tempo, margem e previsibilidade. O Gestify concentra
                tudo isso em um único ambiente.
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
                {painPoints.map((pain) => (
                  <div
                    key={pain}
                    className="flex items-start gap-3 rounded-2xl border border-white/8 bg-slate-900/70 p-4"
                  >
                    <span className="mt-0.5 text-emerald-300">✓</span>
                    <p className="text-slate-200">{pain}</p>
                  </div>
                ))}
              </div>

              <div className="mt-8 rounded-2xl bg-gradient-to-r from-blue-600/20 to-emerald-500/20 p-5">
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
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
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
                  className="h-12 rounded-xl bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 px-8 text-base font-semibold text-white hover:from-blue-500 hover:via-cyan-400 hover:to-emerald-400"
                >
                  Entrar no sistema
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
