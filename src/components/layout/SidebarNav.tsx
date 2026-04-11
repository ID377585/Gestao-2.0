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

  return (
    <nav className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Menu Principal
        </div>

        <div className="flex flex-col gap-1">
          {principalMenuItems.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-muted font-medium"
                    : "text-foreground hover:bg-muted/70"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Administração
        </div>

        <div className="flex flex-col gap-1">
          {administracaoMenuItems.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-muted font-medium"
                    : "text-foreground hover:bg-muted/70"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}