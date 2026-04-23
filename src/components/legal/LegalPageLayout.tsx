import Link from "next/link";

import { GestifyLogo } from "@/components/brand/GestifyLogo";
import { PublicFooter } from "@/components/site/PublicFooter";
import { Button } from "@/components/ui/button";
import { type LegalDocument } from "@/lib/legal-content";

type LegalPageLayoutProps = {
  document: LegalDocument;
};

export function LegalPageLayout({ document }: LegalPageLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.18),transparent_28%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.16),transparent_24%),linear-gradient(to_bottom,rgba(15,23,42,0.96),rgba(2,6,23,1))]" />

      <header className="relative border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <GestifyLogo size={52} />
            <div>
              <p className="text-lg font-semibold text-white">Gestify</p>
              <p className="text-sm text-slate-400">Documentação institucional</p>
            </div>
          </Link>

          <div className="flex flex-wrap gap-3">
            <Link href="/">
              <Button
                variant="outline"
                className="border-white/15 bg-white/5 text-white hover:bg-white hover:text-slate-950"
              >
                Página inicial
              </Button>
            </Link>
            <Link href="/login">
              <Button className="bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 text-white hover:from-blue-500 hover:via-cyan-400 hover:to-emerald-400">
                Entrar
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="relative">
        <section className="border-b border-white/10">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
            <div className="max-w-4xl space-y-5">
              <p className="inline-flex w-fit items-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
                Jurídico e conformidade
              </p>
              <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
                {document.title}
              </h1>
              <p className="max-w-3xl text-lg leading-8 text-slate-300">
                {document.description}
              </p>
              <p className="text-sm text-slate-400">
                Última atualização: {document.updatedAt}
              </p>
            </div>
          </div>
        </section>

        <section className="py-10 sm:py-14">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 xl:grid-cols-[260px_minmax(0,1fr)] xl:px-8">
            <aside className="h-fit rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur">
              <p className="text-sm font-semibold text-white">Nesta página</p>
              <nav aria-label="Sumário" className="mt-4">
                <ol className="space-y-3">
                  {document.sections.map((section) => (
                    <li key={section.id}>
                      <a
                        href={`#${section.id}`}
                        className="text-sm leading-6 text-slate-300 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                      >
                        {section.heading}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            </aside>

            <article className="overflow-hidden rounded-[32px] border border-white/10 bg-white text-slate-900 shadow-2xl shadow-black/20">
              <div className="border-b border-slate-200 bg-slate-50 px-6 py-8 sm:px-8">
                <div className="space-y-4">
                  {document.intro.map((paragraph) => (
                    <p key={paragraph} className="max-w-4xl text-base leading-8 text-slate-700">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>

              {document.institutionalData ? (
                <section className="border-b border-slate-200 px-6 py-8 sm:px-8">
                  <div className="space-y-4">
                    <h2 className="text-2xl font-semibold text-slate-900">
                      Dados institucionais
                    </h2>
                    <dl className="grid gap-4 sm:grid-cols-2">
                      {document.institutionalData.map((item) => (
                        <div
                          key={item.label}
                          className="rounded-2xl border border-slate-200 bg-white p-4"
                        >
                          <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            {item.label}
                          </dt>
                          <dd className="mt-2 text-sm leading-6 text-slate-700">
                            {item.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </section>
              ) : null}

              <div className="space-y-10 px-6 py-8 sm:px-8 sm:py-10">
                {document.sections.map((section) => (
                  <section key={section.id} id={section.id} className="scroll-mt-24 space-y-5">
                    <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                      {section.heading}
                    </h2>

                    {section.paragraphs?.map((paragraph) => (
                      <p key={paragraph} className="text-base leading-8 text-slate-700">
                        {paragraph}
                      </p>
                    ))}

                    {section.list ? (
                      <ul className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                        {section.list.map((item) => (
                          <li
                            key={item}
                            className="flex gap-3 text-base leading-7 text-slate-700"
                          >
                            <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-cyan-500" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    {section.afterListParagraphs?.map((paragraph) => (
                      <p key={paragraph} className="text-base leading-8 text-slate-700">
                        {paragraph}
                      </p>
                    ))}

                    {section.subsections?.map((subsection) => (
                      <div key={subsection.id} id={subsection.id} className="space-y-4">
                        <h3 className="text-xl font-semibold text-slate-900">
                          {subsection.heading}
                        </h3>

                        {subsection.paragraphs?.map((paragraph) => (
                          <p key={paragraph} className="text-base leading-8 text-slate-700">
                            {paragraph}
                          </p>
                        ))}

                        {subsection.list ? (
                          <ul className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                            {subsection.list.map((item) => (
                              <li
                                key={item}
                                className="flex gap-3 text-base leading-7 text-slate-700"
                              >
                                <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        ) : null}

                        {subsection.afterListParagraphs?.map((paragraph) => (
                          <p key={paragraph} className="text-base leading-8 text-slate-700">
                            {paragraph}
                          </p>
                        ))}
                      </div>
                    ))}
                  </section>
                ))}
              </div>
            </article>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
