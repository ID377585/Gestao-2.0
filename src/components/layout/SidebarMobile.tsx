"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { GestifyMark } from "@/components/brand/GestifyMark";
import { menuSections } from "@/components/layout/menu-items";

const focusableSelector =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function SidebarMobile() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const closeMenu = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
  };

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() =>
      closeButtonRef.current?.focus()
    );

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? []
      ).filter((element) => element.getAttribute("aria-hidden") !== "true");

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(href + "/");

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        variant="ghost"
        size="icon"
        className="h-11 w-11 text-gray-700 hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-blue-500 md:hidden dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:ring-blue-400"
        aria-label={open ? "Menu aberto" : "Abrir menu"}
        aria-expanded={open}
        aria-controls="mobile-navigation-panel"
        onClick={() => setOpen(true)}
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            tabIndex={-1}
            className="absolute inset-0 bg-black/40"
            aria-label="Fechar menu"
            onClick={() => closeMenu()}
          />

          <aside
            ref={panelRef}
            id="mobile-navigation-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Menu principal"
            className="fixed left-0 top-0 flex h-full w-[min(320px,88vw)] flex-col border-r border-gray-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950"
          >
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-gray-200 px-4 dark:border-slate-800">
              <GestifyMark size={40} compact />

              <Button
                ref={closeButtonRef}
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Fechar menu"
                onClick={() => closeMenu()}
                className="h-11 w-11 text-gray-700 hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:ring-blue-400"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </Button>
            </div>

            <nav
              className="flex-1 overflow-y-auto px-3 py-4"
              aria-label="Navegação principal móvel"
            >
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
                          "flex min-h-11 w-full items-center gap-3 rounded-xl border px-4 py-2 text-sm font-medium",
                          sectionActive
                            ? "border-blue-200 bg-blue-50 text-blue-700 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                            : "border-transparent text-gray-700 dark:text-slate-300"
                        )}
                      >
                        <SectionIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
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
                              aria-current={active ? "page" : undefined}
                              className={cn(
                                "flex min-h-11 w-full items-center justify-start gap-3 rounded-xl border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-blue-400 dark:focus-visible:ring-offset-slate-950",
                                active
                                  ? "border-blue-200 bg-blue-50 text-blue-700 shadow-sm hover:bg-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-800"
                                  : "border-transparent text-gray-700 hover:border-gray-200 hover:bg-gray-50 hover:text-gray-900 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                              )}
                            >
                              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                              <span>{item.label}</span>
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
