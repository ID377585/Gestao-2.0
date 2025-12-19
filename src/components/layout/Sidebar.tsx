"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  ClipboardList,
  Factory,
  BarChart3,
  Package,
  FileText,
  Tag,
  History,
  ShoppingCart,
  Users,
  ChevronLeft,
  ChevronRight,
  AlertTriangle, // Perdas
  ArrowLeftRight, // Transferências
  BadgeDollarSign, // Controladoria
  Menu,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent } from "@/components/ui/sheet";

/* ======================
   MENU CONFIG
====================== */
const menuItems = [
  { title: "Pedidos", href: "/dashboard/pedidos", icon: ClipboardList },
  { title: "Produção", href: "/dashboard/producao", icon: Factory },
  { title: "Produtividade", href: "/dashboard/produtividade", icon: BarChart3 },
  { title: "Estoque", href: "/dashboard/estoque", icon: Package },
  { title: "Fichas Técnicas", href: "/dashboard/fichas-tecnicas", icon: FileText },
  { title: "Etiquetas", href: "/dashboard/etiquetas", icon: Tag },
  { title: "Histórico", href: "/dashboard/historico-pedidos", icon: History },

  // ✅ NOVAS SESSÕES
  { title: "Perdas", href: "/dashboard/perdas", icon: AlertTriangle },
  { title: "Transferências", href: "/dashboard/transferencias", icon: ArrowLeftRight },

  // ✅ JÁ EXISTIA
  { title: "Compras", href: "/dashboard/compras", icon: ShoppingCart },

  // ✅ NOVA SESSÃO
  { title: "Controladoria", href: "/dashboard/controladoria", icon: BadgeDollarSign },
];

const adminItems = [
  { title: "Usuários", href: "/dashboard/admin/usuarios", icon: Users },
];

interface SidebarProps {
  className?: string;
}

/* ======================
   COMPONENT
====================== */
export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();

  // desktop: recolher/expandir
  const [collapsed, setCollapsed] = useState(false);

  // mobile: abrir/fechar menu (Sheet)
  const [mobileOpen, setMobileOpen] = useState(false);

  function isActive(href: string) {
    return pathname === href || pathname?.startsWith(href + "/");
  }

  function SidebarContent({
    variant,
    onNavigate,
  }: {
    variant: "desktop" | "mobile";
    onNavigate?: () => void;
  }) {
    const isDesktop = variant === "desktop";

    return (
      <div className={cn("flex min-h-screen flex-col", isDesktop ? "" : "min-h-0")}>
        {/* Logo / Header */}
        <div className="flex h-16 items-center justify-between border-b px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-r from-blue-600 to-green-600 text-sm font-bold text-white">
              G2
            </div>

            {/* No mobile sempre mostra o nome, no desktop depende de collapsed */}
            {(variant === "mobile" || !collapsed) && (
              <span className="text-lg font-semibold tracking-tight">Gestão 2.0</span>
            )}
          </div>

          {/* Desktop: botão recolher/expandir | Mobile: botão fechar */}
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

        {/* Menu */}
        <nav className="flex-1 px-3 py-4">
          {/* Main */}
          <div className="space-y-3">
            {(variant === "mobile" || !collapsed) && (
              <h3 className="px-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Menu Principal
              </h3>
            )}

            <div className="space-y-2">
              {menuItems.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => onNavigate?.()}
                  >
                    <Button
                      variant={active ? "secondary" : "ghost"}
                      className={cn(
                        "w-full justify-start gap-3 rounded-xl h-12",
                        // no desktop respeita collapsed; no mobile sempre espaçado normal
                        variant === "desktop"
                          ? collapsed
                            ? "px-3"
                            : "px-4"
                          : "px-4"
                      )}
                      title={variant === "desktop" && collapsed ? item.title : undefined}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {(variant === "mobile" || !collapsed) && (
                        <span className="text-sm font-medium">{item.title}</span>
                      )}
                    </Button>
                  </Link>
                );
              })}
            </div>

            <div className="py-4">
              <Separator />
            </div>

            {/* Admin */}
            <div className="space-y-3">
              {(variant === "mobile" || !collapsed) && (
                <h3 className="px-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Administração
                </h3>
              )}

              <div className="space-y-2">
                {adminItems.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => onNavigate?.()}
                    >
                      <Button
                        variant={active ? "secondary" : "ghost"}
                        className={cn(
                          "w-full justify-start gap-3 rounded-xl h-12",
                          variant === "desktop"
                            ? collapsed
                              ? "px-3"
                              : "px-4"
                            : "px-4"
                        )}
                        title={variant === "desktop" && collapsed ? item.title : undefined}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {(variant === "mobile" || !collapsed) && (
                          <span className="text-sm font-medium">{item.title}</span>
                        )}
                      </Button>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </nav>
      </div>
    );
  }

  return (
    <>
      {/* =========================
          MOBILE: botão hamburguer
          - Coloque o Sidebar no layout e este botão vai aparecer no mobile.
          - Se você já tem um botão hamburguer no Topbar, pode remover lá para não duplicar.
      ========================== */}
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
          <SheetContent side="left" className="w-[300px] p-0">
            <SidebarContent
              variant="mobile"
              onNavigate={() => setMobileOpen(false)}
            />
          </SheetContent>
        </Sheet>
      </div>

      {/* =========================
          DESKTOP/TABLET: sidebar fixa
      ========================== */}
      <aside
        className={cn(
          "hidden md:flex min-h-screen flex-col border-r bg-white transition-all duration-300",
          collapsed ? "w-20" : "w-72",
          className
        )}
      >
        <SidebarContent variant="desktop" />
      </aside>
    </>
  );
}
