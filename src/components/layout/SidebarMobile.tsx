"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GestifyMark } from "@/components/brand/GestifyMark";
import {
  principalMenuItems,
  administracaoMenuItems,
} from "@/components/layout/menu-items";

export function SidebarMobile() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;

    document.body.style.overflow = "hidden";
    document.body.style.paddingRight = prevPaddingRight;

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, [open]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    if (open) {
      window.addEventListener("keydown", onKeyDown);
    }

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
        className="md:hidden"
        aria-label="Abrir menu"
        onClick={() => setOpen(true)}
      >
        <Menu className="h-6 w-6" />
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Fechar menu"
            onClick={() => setOpen(false)}
          />

          <div className="fixed left-0 top-0 flex h-full w-[300px] flex-col bg-white shadow-xl">
            <div className="flex h-16 shrink-0 items-center justify-between border-b px-4">
              <div className="flex items-center">
                <GestifyMark size={40} compact />
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Fechar menu"
                onClick={() => setOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <nav className="flex-1 overflow-y-auto px-4 py-4">
              <div className="space-y-3">
                <div className="px-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Menu Principal
                </div>

                <div className="space-y-2">
                  {principalMenuItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);

                    return (
                      <Link key={item.href} href={item.href}>
                        <Button
                          variant={active ? "secondary" : "ghost"}
                          className={cn(
                            "h-12 w-full justify-start gap-3 rounded-xl px-4"
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="text-sm font-medium">{item.label}</span>
                        </Button>
                      </Link>
                    );
                  })}
                </div>

                <div className="py-4">
                  <div className="border-t" />
                </div>

                <div className="px-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Administração
                </div>

                <div className="space-y-2">
                  {administracaoMenuItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);

                    return (
                      <Link key={item.href} href={item.href}>
                        <Button
                          variant={active ? "secondary" : "ghost"}
                          className="h-12 w-full justify-start gap-3 rounded-xl px-4"
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="text-sm font-medium">{item.label}</span>
                        </Button>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}