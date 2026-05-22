import Link from "next/link";

import { GestifyLogo } from "@/components/brand/GestifyLogo";

function City404Illustration() {
  return (
    <svg
      id="errorSVG"
      className="error-svg"
      data-name="errorSVG"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1120 645"
      role="img"
      aria-labelledby="error-title error-description"
    >
      <title id="error-title">Página 404 não encontrada</title>
      <desc id="error-description">
        Ilustração isométrica de uma cidade em tons de cinza com carros em movimento
        e o número 404.
      </desc>

      <defs>
        <linearGradient id="buildingTop" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#eeeeee" />
          <stop offset="100%" stopColor="#c9c9c9" />
        </linearGradient>

        <linearGradient id="buildingSide" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#bdbdbd" />
          <stop offset="100%" stopColor="#858585" />
        </linearGradient>

        <linearGradient id="dark404" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#777777" />
          <stop offset="100%" stopColor="#4f4f4f" />
        </linearGradient>
      </defs>

      <rect width="1120" height="645" fill="#ffffff" />

      {/* Estradas principais */}
      <g id="roads" opacity="0.95">
        <polygon
          points="0,340 30,323 1120,619 1120,645 1078,645"
          fill="#d7d7d7"
        />
        <polygon
          points="0,420 392,194 419,210 0,452"
          fill="#d7d7d7"
        />
        <polygon
          points="88,160 1120,756 1090,773 58,177"
          fill="#d7d7d7"
        />
        <polygon
          points="310,530 604,360 636,378 342,548"
          fill="#d7d7d7"
        />
        <polygon
          points="70,390 374,214 408,234 104,410"
          fill="#d7d7d7"
        />

        <polygon
          points="0,360 16,351 1110,646 1094,655"
          fill="#ffffff"
          opacity="0.9"
        />
        <polygon
          points="0,436 400,205 412,212 0,451"
          fill="#ffffff"
          opacity="0.9"
        />
        <polygon
          points="102,164 1120,752 1104,761 86,173"
          fill="#ffffff"
          opacity="0.9"
        />
      </g>

      {/* Número 404 */}
      <g id="number404" transform="translate(502 40) rotate(-28)">
        <text
          x="0"
          y="120"
          fontSize="118"
          fontWeight="900"
          fontFamily="Arial, Helvetica, sans-serif"
          fill="url(#dark404)"
          letterSpacing="8"
        >
          404
        </text>
        <text
          x="0"
          y="145"
          fontSize="118"
          fontWeight="900"
          fontFamily="Arial, Helvetica, sans-serif"
          fill="#a6a6a6"
          letterSpacing="8"
          opacity="0.42"
        >
          404
        </text>
      </g>

      {/* Prédios */}
      <g id="city">
        <g transform="translate(142 166)">
          <polygon points="0,0 82,-47 164,0 82,47" fill="url(#buildingTop)" />
          <polygon points="0,0 82,47 82,248 0,201" fill="#b5b5b5" />
          <polygon points="82,47 164,0 164,201 82,248" fill="url(#buildingSide)" />

          {Array.from({ length: 8 }).map((_, index) => (
            <g key={`tower-a-floor-${index}`}>
              <polygon
                points={`12,${26 + index * 23} 82,${66 + index * 23} 152,${
                  26 + index * 23
                } 82,${-14 + index * 23}`}
                fill="#dcdcdc"
              />
              <polygon
                points={`12,${31 + index * 23} 82,${71 + index * 23} 82,${
                  80 + index * 23
                } 12,${40 + index * 23}`}
                fill="#adadad"
              />
              <polygon
                points={`82,${71 + index * 23} 152,${31 + index * 23} 152,${
                  40 + index * 23
                } 82,${80 + index * 23}`}
                fill="#8f8f8f"
              />
            </g>
          ))}
        </g>

        <g transform="translate(360 250)">
          <polygon points="0,0 45,-26 90,0 45,26" fill="url(#buildingTop)" />
          <polygon points="0,0 45,26 45,210 0,184" fill="#b7b7b7" />
          <polygon points="45,26 90,0 90,184 45,210" fill="#8d8d8d" />

          {Array.from({ length: 8 }).map((_, index) => (
            <g key={`tower-b-floor-${index}`}>
              <rect
                id={`window-${index + 1}`}
                x="13"
                y={23 + index * 19}
                width="8"
                height="12"
                fill="#eeeeee"
                opacity="0.85"
              />
              <rect
                id={`window-${index + 9}`}
                x="26"
                y={30 + index * 19}
                width="8"
                height="12"
                fill="#eeeeee"
                opacity="0.85"
              />
            </g>
          ))}
        </g>

        <g transform="translate(474 176)">
          <polygon points="0,0 64,-37 128,0 64,37" fill="url(#buildingTop)" />
          <polygon points="0,0 64,37 64,202 0,165" fill="#bcbcbc" />
          <polygon points="64,37 128,0 128,165 64,202" fill="#969696" />

          {Array.from({ length: 6 }).map((_, index) => (
            <g key={`tower-c-floor-${index}`}>
              <polygon
                points={`12,${28 + index * 24} 64,${58 + index * 24} 116,${
                  28 + index * 24
                } 64,${-2 + index * 24}`}
                fill="#d7d7d7"
              />
              <polygon
                points={`12,${34 + index * 24} 64,${64 + index * 24} 64,${
                  72 + index * 24
                } 12,${42 + index * 24}`}
                fill="#a9a9a9"
              />
              <polygon
                points={`64,${64 + index * 24} 116,${34 + index * 24} 116,${
                  42 + index * 24
                } 64,${72 + index * 24}`}
                fill="#898989"
              />
            </g>
          ))}
        </g>

        <g transform="translate(58 472)">
          <polygon points="0,0 40,-23 80,0 40,23" fill="url(#buildingTop)" />
          <polygon points="0,0 40,23 40,140 0,117" fill="#b6b6b6" />
          <polygon points="40,23 80,0 80,117 40,140" fill="#8b8b8b" />
        </g>

        <g transform="translate(184 510)">
          <polygon points="0,0 70,-40 140,0 70,40" fill="url(#buildingTop)" />
          <polygon points="0,0 70,40 70,144 0,104" fill="#bdbdbd" />
          <polygon points="70,40 140,0 140,104 70,144" fill="#8f8f8f" />

          {Array.from({ length: 5 }).map((_, index) => (
            <g key={`tower-d-floor-${index}`}>
              <polygon
                points={`10,${20 + index * 20} 70,${55 + index * 20} 130,${
                  20 + index * 20
                } 70,${-15 + index * 20}`}
                fill="#d7d7d7"
              />
            </g>
          ))}
        </g>

        <g transform="translate(315 530)">
          <polygon points="0,0 48,-28 96,0 48,28" fill="url(#buildingTop)" />
          <polygon points="0,0 48,28 48,112 0,84" fill="#b9b9b9" />
          <polygon points="48,28 96,0 96,84 48,112" fill="#8b8b8b" />

          {Array.from({ length: 4 }).map((_, index) => (
            <polygon
              key={`tower-e-floor-${index}`}
              points={`8,${20 + index * 19} 48,${43 + index * 19} 88,${
                20 + index * 19
              } 48,${-3 + index * 19}`}
              fill="#d6d6d6"
            />
          ))}
        </g>
      </g>

      {/* Casas pequenas */}
      <g id="houses" fill="#9a9a9a">
        <g transform="translate(650 382)">
          <polygon points="0,0 22,-13 44,0 22,13" fill="#7f7f7f" />
          <polygon points="0,0 22,13 22,38 0,25" fill="#b5b5b5" />
          <polygon points="22,13 44,0 44,25 22,38" fill="#898989" />
        </g>

        <g transform="translate(694 404)">
          <polygon points="0,0 22,-13 44,0 22,13" fill="#7f7f7f" />
          <polygon points="0,0 22,13 22,38 0,25" fill="#b5b5b5" />
          <polygon points="22,13 44,0 44,25 22,38" fill="#898989" />
        </g>

        <g transform="translate(574 493)">
          <polygon points="0,0 24,-14 48,0 24,14" fill="#7f7f7f" />
          <polygon points="0,0 24,14 24,42 0,28" fill="#b5b5b5" />
          <polygon points="24,14 48,0 48,28 24,42" fill="#898989" />
        </g>

        <g transform="translate(612 515)">
          <polygon points="0,0 24,-14 48,0 24,14" fill="#7f7f7f" />
          <polygon points="0,0 24,14 24,42 0,28" fill="#b5b5b5" />
          <polygon points="24,14 48,0 48,28 24,42" fill="#898989" />
        </g>
      </g>

      {/* Árvores */}
      <g id="trees">
        {[
          [92, 454],
          [120, 572],
          [728, 406],
          [758, 380],
          [910, 450],
          [402, 474],
        ].map(([x, y], index) => (
          <g key={`tree-${index}`} transform={`translate(${x} ${y})`}>
            <rect x="-3" y="12" width="6" height="18" rx="2" fill="#838383" />
            <ellipse cx="0" cy="4" rx="10" ry="24" fill="#b0b0b0" />
          </g>
        ))}
      </g>

      {/* Carros */}
      <g id="car-1" className="car car-one" transform="translate(505 438)">
        <polygon points="0,0 16,-9 38,4 22,13" fill="#cfcfcf" />
        <polygon points="0,0 22,13 22,24 0,11" fill="#969696" />
        <polygon points="22,13 38,4 38,15 22,24" fill="#737373" />
        <circle cx="8" cy="14" r="3" fill="#555555" />
        <circle cx="27" cy="17" r="3" fill="#555555" />
      </g>

      <g id="car-2" className="car car-two" transform="translate(815 420)">
        <polygon points="0,0 16,-9 38,4 22,13" fill="#d8d8d8" />
        <polygon points="0,0 22,13 22,24 0,11" fill="#9a9a9a" />
        <polygon points="22,13 38,4 38,15 22,24" fill="#777777" />
        <circle cx="8" cy="14" r="3" fill="#555555" />
        <circle cx="27" cy="17" r="3" fill="#555555" />
      </g>

      <g id="car-3" className="car car-three" transform="translate(124 304)">
        <polygon points="0,0 14,-8 34,3 20,11" fill="#d8d8d8" />
        <polygon points="0,0 20,11 20,21 0,10" fill="#9a9a9a" />
        <polygon points="20,11 34,3 34,13 20,21" fill="#777777" />
        <circle cx="7" cy="13" r="3" fill="#555555" />
        <circle cx="24" cy="15" r="3" fill="#555555" />
      </g>

      <g id="car-4" className="car car-four" transform="translate(985 550)">
        <polygon points="0,0 14,-8 34,3 20,11" fill="#d8d8d8" />
        <polygon points="0,0 20,11 20,21 0,10" fill="#9a9a9a" />
        <polygon points="20,11 34,3 34,13 20,21" fill="#777777" />
        <circle cx="7" cy="13" r="3" fill="#555555" />
        <circle cx="24" cy="15" r="3" fill="#555555" />
      </g>
    </svg>
  );
}

export default function NotFound() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-white text-slate-900">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .error-svg {
              display: block;
              width: min(100%, 1120px);
              height: auto;
              margin: 0 auto;
              filter: drop-shadow(0 24px 50px rgba(15, 23, 42, 0.08));
            }

            #number404 {
              animation: float404 5s ease-in-out infinite alternate;
              transform-box: fill-box;
              transform-origin: center;
            }

            #window-1,
            #window-4,
            #window-6,
            #window-9,
            #window-11,
            #window-14 {
              animation: light 6s infinite alternate;
              animation-timing-function: steps(2);
            }

            #window-2,
            #window-5,
            #window-8,
            #window-12,
            #window-15 {
              animation: light 9s infinite alternate;
              animation-timing-function: steps(2);
            }

            #window-3,
            #window-7,
            #window-10,
            #window-13,
            #window-16 {
              animation: light 12s infinite alternate;
              animation-timing-function: steps(2);
            }

            .car {
              transform-box: fill-box;
              transform-origin: center center;
            }

            #car-1 {
              animation: car1 24s infinite linear;
            }

            #car-2 {
              animation: car2 28s infinite linear;
            }

            #car-3 {
              animation: car3 18s infinite linear;
            }

            #car-4 {
              animation: car4 22s infinite linear;
            }

            @keyframes light {
              0%, 35% {
                opacity: 0.32;
                fill: #d7d7d7;
              }

              36%, 100% {
                opacity: 1;
                fill: #ffffff;
              }
            }

            @keyframes float404 {
              0% {
                transform: translateY(0);
              }

              100% {
                transform: translateY(-10px);
              }
            }

            @keyframes car1 {
              0% {
                transform: translate(0, 0);
                opacity: 1;
              }

              45% {
                transform: translate(390px, 225px);
                opacity: 1;
              }

              46% {
                opacity: 0;
              }

              47% {
                transform: translate(-300px, -170px);
                opacity: 0;
              }

              48% {
                opacity: 1;
              }

              100% {
                transform: translate(0, 0);
                opacity: 1;
              }
            }

            @keyframes car2 {
              0% {
                transform: translate(0, 0);
                opacity: 1;
              }

              42% {
                transform: translate(-430px, -246px);
                opacity: 1;
              }

              43% {
                opacity: 0;
              }

              44% {
                transform: translate(240px, 138px);
                opacity: 0;
              }

              45% {
                opacity: 1;
              }

              100% {
                transform: translate(0, 0);
                opacity: 1;
              }
            }

            @keyframes car3 {
              0% {
                transform: translate(0, 0);
                opacity: 1;
              }

              48% {
                transform: translate(480px, 275px);
                opacity: 1;
              }

              49% {
                opacity: 0;
              }

              50% {
                transform: translate(-80px, -45px);
                opacity: 0;
              }

              51% {
                opacity: 1;
              }

              100% {
                transform: translate(0, 0);
                opacity: 1;
              }
            }

            @keyframes car4 {
              0% {
                transform: translate(0, 0);
                opacity: 1;
              }

              55% {
                transform: translate(-520px, -300px);
                opacity: 1;
              }

              56% {
                opacity: 0;
              }

              57% {
                transform: translate(120px, 70px);
                opacity: 0;
              }

              58% {
                opacity: 1;
              }

              100% {
                transform: translate(0, 0);
                opacity: 1;
              }
            }

            @media (prefers-reduced-motion: reduce) {
              #number404,
              #window-1,
              #window-2,
              #window-3,
              #window-4,
              #window-5,
              #window-6,
              #window-7,
              #window-8,
              #window-9,
              #window-10,
              #window-11,
              #window-12,
              #window-13,
              #window-14,
              #window-15,
              #window-16,
              .car {
                animation: none !important;
              }
            }
          `,
        }}
      />

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.09),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.09),transparent_30%)]" />

      <section className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex justify-center">
          <GestifyLogo
            size={64}
            showText
            subtitle="Sistema de gestão para restaurantes"
            textClassName="text-left"
          />
        </header>

        <div className="grid flex-1 items-center gap-8 py-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="order-2 lg:order-1">
            <City404Illustration />
          </div>

          <div className="order-1 mx-auto max-w-xl text-center lg:order-2 lg:text-left">
            <div className="mb-5 inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm">
              Erro 404
            </div>

            <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
              Ops! Essa página saiu da rota.
            </h1>

            <p className="mt-5 text-base leading-8 text-slate-600 sm:text-lg">
              O endereço que você tentou acessar não existe, foi movido ou não
              está disponível no momento. Volte para o painel ou para a página
              inicial do Gestify.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <Link
                href="/dashboard/pedidos"
                className="inline-flex h-12 items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 px-6 text-sm font-bold text-white shadow-lg shadow-cyan-500/20 transition hover:-translate-y-0.5 hover:from-blue-500 hover:via-cyan-400 hover:to-emerald-400"
              >
                Voltar para o painel
              </Link>

              <Link
                href="/"
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 text-sm font-bold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:text-slate-950"
              >
                Ir para página inicial
              </Link>
            </div>

            <p className="mt-6 text-sm text-slate-500">
              Dica: confira se o link foi digitado corretamente ou acesse pelo
              menu principal.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}