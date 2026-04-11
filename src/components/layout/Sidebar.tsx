"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Menu, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { GestifyMark } from "@/components/brand/GestifyMark";
import {
  principalMenuItems,
  administracaoMenuItems,
} from "@/components/layout/menu-items";

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(href + "/");

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--sidebar-w", collapsed ? "5rem" : "18rem");
  }, [collapsed]);

  function SidebarContent({
    variant,
    onNavigate,
  }: {
    variant: "desktop" | "mobile";
    onNavigate?: () => void;
  }) {
    const isDesktop = variant === "desktop";

    return (
      <div className={cn("flex h-full flex-col bg-white", isDesktop ? "min-h-screen" : "")}>
        <div className="flex h-16 shrink-0 items-center justify-between border-b px-4">
          <div className="flex min-w-0 items-center">
            <GestifyMark size={40} compact={variant === "desktop" && collapsed} />
          </div>

          {isDesktop ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(!collapsed)}
              className="h-8 w-8"
              aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(false)}
              className="h-8 w-8"
              aria-label="Fechar menu"
            >
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-3">
            {(variant === "mobile" || !collapsed) && (
              <h3 className="px-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Menu Principal
              </h3>
            )}

            <div className="space-y-2">
              {principalMenuItems.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;

                return (
                  <Link key={item.href} href={item.href} onClick={() => onNavigate?.()}>
                    <Button
                      variant={active ? "secondary" : "ghost"}
                      className={cn(
                        "h-12 w-full justify-start gap-3 rounded-xl",
                        variant === "desktop" ? (collapsed ? "px-3" : "px-4") : "px-4"
                      )}
                      title={variant === "desktop" && collapsed ? item.label : undefined}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {(variant === "mobile" || !collapsed) && (
                        <span className="text-sm font-medium">{item.label}</span>
                      )}
                    </Button>
                  </Link>
                );
              })}
            </div>

            <div className="py-4">
              <Separator />
            </div>

            {(variant === "mobile" || !collapsed) && (
              <h3 className="px-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Administração
              </h3>
            )}

            <div className="space-y-2">
              {administracaoMenuItems.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;

                return (
                  <Link key={item.href} href={item.href} onClick={() => onNavigate?.()}>
                    <Button
                      variant={active ? "secondary" : "ghost"}
                      className={cn(
                        "h-12 w-full justify-start gap-3 rounded-xl",
                        variant === "desktop" ? (collapsed ? "px-3" : "px-4") : "px-4"
                      )}
                      title={variant === "desktop" && collapsed ? item.label : undefined}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {(variant === "mobile" || !collapsed) && (
                        <span className="text-sm font-medium">{item.label}</span>
                      )}
                    </Button>
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>
      </div>
    );
  }

  return (
    <>
      <div className="md:hidden">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10"
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-[300px] overflow-y-auto p-0">
            <SidebarContent variant="mobile" onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>

      <div className={cn("hidden h-full w-full flex-col md:flex", className)}>
        <SidebarContent variant="desktop" />
      </div>
    </>
  );
}