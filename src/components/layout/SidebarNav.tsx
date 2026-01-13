// src/components/layout/SidebarNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { MENU_SECTIONS, type Role } from "@/components/layout/menu-items";

type Props = {
  role?: Role | null;
  onNavigate?: () => void; // usado no mobile para fechar o Sheet ao clicar
};

export function SidebarNav({ role, onNavigate }: Props) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-4">
      {MENU_SECTIONS.map((section) => {
        const allowed =
          !section.roles || (role ? section.roles.includes(role) : false);

        if (!allowed) return null;

        return (
          <div key={section.section} className="flex flex-col gap-2">
            <div className="px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {section.section}
            </div>

            <div className="flex flex-col gap-1">
              {section.items.map((item) => {
                const active =
                  pathname === item.href || pathname?.startsWith(item.href + "/");
                const Icon = item.icon;

                // ✅ Renomeia só o rótulo exibido (mantém href intacto)
                const label =
                  item.label === "Compras" ? "Hub de Dados" : item.label;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-muted font-medium"
                        : "hover:bg-muted/70 text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
