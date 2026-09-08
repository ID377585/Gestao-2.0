import Link from "next/link";

import { cn } from "@/lib/utils";
import {
  authLegalNavigationLinks,
  legalNavigationLinks,
} from "@/lib/legal-content";

type LegalLinksProps = {
  className?: string;
  linkClassName?: string;
  variant?: "footer" | "auth";
};

const dataGovernanceLink = {
  href: "/governanca-e-protecao-de-dados",
  label: "Governança e Proteção de Dados",
} as const;

export function LegalLinks({
  className,
  linkClassName,
  variant = "footer",
}: LegalLinksProps) {
  const links =
    variant === "auth"
      ? [...authLegalNavigationLinks, dataGovernanceLink]
      : [...legalNavigationLinks, dataGovernanceLink];

  return (
    <nav aria-label="Links jurídicos" className={className}>
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className={cn(
                "text-sm font-medium text-slate-300 underline-offset-4 transition hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
                variant === "auth" &&
                  "text-xs font-normal text-slate-400 hover:text-slate-200",
                linkClassName
              )}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
