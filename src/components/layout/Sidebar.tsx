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
import { menuItemsBySection } from "@/components/layout/menu-items";

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
      <div
        className={cn(
          "flex h-full flex-col bg-white text-gray-900 dark:bg-slate-950 dark:text-slate-100",
          isDesktop ? "min-h-screen" : ""
        )}
      >
        <div
          className={cn(
            "relative flex h-16 shrink-0 items-center border-b border-gray-200 px-4 dark:border-slate-800",
            isDesktop
              ? collapsed
                ? "justify-center"
                : "justify-start"
              : "justify-between"
          )}
        >
          <div
            className={cn(
              "flex min-w-0 items-center transition-all",
              isDesktop && collapsed ? "justify-center" : ""
            )}
          >
            <GestifyMark
              size={40}
              compact={variant === "desktop" && collapsed}
            />
          </div>

          {isDesktop ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(!collapsed)}
              className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
              title={collapsed ? "Expandir menu" : "Recolher menu"}
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
              className="h-8 w-8 text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              aria-label="Fechar menu"
            >
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-5">
            {menuItemsBySection.map((section, sectionIndex) => (
              <div key={section.key} className="space-y-3">
                {(variant === "mobile" || !collapsed) && (
                  <h3 className="px-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                    {section.label}
                  </h3>
                )}

                <div className="space-y-2">
                  {section.items.map((item) => {
                    const active = isActive(item.href);
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => onNavigate?.()}
                      >
                        <Button
                          variant="ghost"
                          className={cn(
                            "h-12 w-full gap-3 rounded-xl border transition-colors",
                            variant === "desktop"
                              ? collapsed
                                ? "justify-center px-3"
                                : "justify-start px-4"
                              : "justify-start px-4",
                            active
                              ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-800"
                              : "border-transparent text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                          )}
                          title={
                            variant === "desktop" && collapsed
                              ? item.label
                              : undefined
                          }
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          {(variant === "mobile" || !collapsed) && (
                            <span className="text-sm font-medium">
                              {item.label}
                            </span>
                          )}
                        </Button>
                      </Link>
                    );
                  })}
                </div>

                {sectionIndex < menuItemsBySection.length - 1 && (
                  <div className="pt-2">
                    <Separator className="bg-gray-200 dark:bg-slate-800" />
                  </div>
                )}
              </div>
            ))}
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
          className="h-10 w-10 text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent
            side="left"
            className="w-[300px] overflow-y-auto border-r border-gray-200 bg-white p-0 dark:border-slate-800 dark:bg-slate-950"
          >
            <SidebarContent
              variant="mobile"
              onNavigate={() => setMobileOpen(false)}
            />
          </SheetContent>
        </Sheet>
      </div>

      <div className={cn("hidden h-full w-full flex-col md:flex", className)}>
        <SidebarContent variant="desktop" />
      </div>
    </>
  );
}
