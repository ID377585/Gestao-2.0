"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  principalMenuItems,
  administracaoMenuItems,
} from "@/components/layout/menu-items";

type Props = {
  onNavigate?: () => void;
};

export function SidebarNav({ onNavigate }: Props) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(href + "/");

  const renderItems = (items: typeof principalMenuItems) =>
    items.map((item) => {
      const active = isActive(item.href);
      const Icon = item.icon;

      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex min-h-11 items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950",
            active
              ? "border-blue-200 bg-blue-50 font-medium text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              : "border-transparent text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          )}
        >
          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{item.label}</span>
        </Link>
      );
    });

  return (
    <nav className="flex flex-col gap-4" aria-label="Navegação principal">
      <div className="flex flex-col gap-2">
        <div className="px-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
          Menu Principal
        </div>
        <div className="flex flex-col gap-1">{renderItems(principalMenuItems)}</div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="px-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
          Administração
        </div>
        <div className="flex flex-col gap-1">{renderItems(administracaoMenuItems)}</div>
      </div>
    </nav>
  );
}
