import Link from "next/link";

import { CookiePreferencesButton } from "@/components/legal/CookiePreferencesButton";
import { LegalLinks } from "@/components/site/LegalLinks";

const footerLinks = [
  { label: "Inicio", href: "/" },
  { label: "Recursos", href: "/recursos" },
  { label: "Solucoes", href: "/solucoes" },
  { label: "Conteudos", href: "/conteudos" },
  { label: "Demonstracao", href: "/demonstracao" },
  { label: "Suporte", href: "mailto:id377585@gmail.com" },
];

export function PublicFooter() {
  return (
    <footer className="border-t border-white/10 bg-slate-950">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-white">Gestify</p>
          <p className="max-w-xl text-sm leading-6 text-slate-400">
            Plataforma de gestão para restaurantes e operações alimentícias, com
            foco em controle, rastreabilidade e eficiência operacional.
          </p>
          <p className="text-xs text-slate-500">
            © 2026 Gestify. Todos os direitos reservados. gestify.app
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Gestify
            </p>
            <div className="flex max-w-sm flex-wrap gap-x-4 gap-y-2">
              {footerLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-slate-300 underline-offset-4 transition hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Jurídico
            </p>
            <LegalLinks />
            <CookiePreferencesButton />
            <Link
              href="/login"
              className="inline-flex text-sm font-medium text-cyan-300 underline-offset-4 transition hover:text-cyan-200 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              Área de acesso
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
