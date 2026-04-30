"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { GestifyMark } from "@/components/brand/GestifyMark";
import { menuSections } from "@/components/layout/menu-items";

export function SidebarMobile() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    if (open) window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(href + "/");

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="md:hidden h-10 w-10 text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-200 dark:hover:bg-slate-800"
        aria-label="Abrir menu"
        onClick={() => setOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Fechar menu"
            onClick={() => setOpen(false)}
          />

          <aside className="fixed left-0 top-0 flex h-full w-[300px] flex-col border-r border-gray-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-gray-200 px-4 dark:border-slate-800">
              <GestifyMark size={40} compact />

              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Fechar menu"
                onClick={() => setOpen(false)}
                className="h-8 w-8 text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-4">
              <div className="space-y-3">
                {menuSections.map((section, sectionIndex) => {
                  const SectionIcon = section.icon;
                  const sectionActive = section.items.some((item) =>
                    isActive(item.href)
                  );

                  return (
                    <div key={section.key} className="space-y-2">
                      <div
                        className={cn(
                          "flex h-12 w-full items-center gap-3 rounded-xl border px-4 text-sm font-medium",
                          sectionActive
                            ? "border-blue-200 bg-blue-50 text-blue-700 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                            : "border-transparent text-gray-700 dark:text-slate-300"
                        )}
                      >
                        <SectionIcon className="h-4 w-4 shrink-0" />
                        <span>{section.label}</span>
                      </div>

                      <div className="space-y-2 pl-3">
                        {section.items.map((item) => {
                          const Icon = item.icon;
                          const active = isActive(item.href);

                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => setOpen(false)}
                            >
                              <Button
                                variant="ghost"
                                className={cn(
                                  "h-12 w-full justify-start gap-3 rounded-xl border px-4 transition-all duration-200",
                                  active
                                    ? "border-blue-200 bg-blue-50 text-blue-700 shadow-sm hover:bg-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-800"
                                    : "border-transparent text-gray-700 hover:border-gray-200 hover:bg-gray-50 hover:text-gray-900 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                                )}
                              >
                                <Icon className="h-4 w-4 shrink-0" />
                                <span className="text-sm font-medium">
                                  {item.label}
                                </span>
                              </Button>
                            </Link>
                          );
                        })}
                      </div>

                      {sectionIndex < menuSections.length - 1 && (
                        <div className="pt-2">
                          <Separator className="bg-gray-200 dark:bg-slate-800" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}