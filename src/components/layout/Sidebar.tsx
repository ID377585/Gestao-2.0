"use client";

import { useEffect, useState } from "react";
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
  AlertTriangle,
  ArrowLeftRight,
  BadgeDollarSign,
  Menu,
  X,
  Boxes, // ✅ ícone do Inventário
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

  // ✅ INVENTÁRIO
  { title: "Inventário", href: "/dashboard/inventario", icon: Boxes },

  // ✅ NOVO ITEM: PRODUTOS
  { title: "Produtos", href: "/dashboard/produtos", icon: Package },

  { title: "Fichas Técnicas", href: "/dashboard/fichas-tecnicas", icon: FileText },
  { title: "Etiquetas", href: "/dashboard/etiquetas", icon: Tag },
  { title: "Histórico", href: "/dashboard/historico-pedidos", icon: History },

  { title: "Perdas", href: "/dashboard/perdas", icon: AlertTriangle },
  { title: "Transferências", href: "/dashboard/transferencias", icon: ArrowLeftRight },

  { title: "Compras", href: "/dashboard/compras", icon: ShoppingCart },
  { title: "Controladoria", href: "/dashboard/controladoria", icon: BadgeDollarSign },
];

const adminItems = [
  { title: "Usuários", href: "/dashboard/admin/usuarios", icon: Users },
];

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();

  const [collapsed, setCollapsed] = useState(false); // desktop
  const [mobileOpen, setMobileOpen] = useState(false); // mobile

  // ✅ NOVO: sincroniza largura do sidebar com o layout via CSS var
  // aberto  = 18rem (equiv. w-72)
  // fechado = 5rem  (equiv. w-20)
  useEffect(() => {
    // Só faz no browser
    const root = document.documentElement;

    // Se quiser “sumir totalmente” ao recolher, troque "5rem" por "0rem".
    const width = collapsed ? "5rem" : "18rem";
    root.style.setProperty("--sidebar-w", width);

    return () => {
      // opcional: não remove para evitar "piscadas" em navegação
      // root.style.removeProperty("--sidebar-w");
    };
  }, [collapsed]);

  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(href + "/");

  function SidebarContent({
    variant,
    onNavigate,
  }: {
    variant: "desktop" | "mobile";
    onNavigate?: () => void;
  }) {
    const isDesktop = variant === "desktop";

    return (
      <div className={cn("flex h-full flex-col", isDesktop ? "min-h-screen" : "")}>
        {/* Header / Logo */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-r from-blue-600 to-green-600 text-sm font-bold text-white">
              G2
            </div>

            {(variant === "mobile" || !collapsed) && (
              <span className="text-lg font-semibold tracking-tight">Gestão 2.0</span>
            )}
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

        {/* Menu (SCROLL AQUI) */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
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
        </nav>
      </div>
    );
  }

  return (
    <>
      {/* MOBILE trigger */}
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
          {/* ✅ overflow-y-auto + h-full garantem o scroll */}
          <SheetContent side="left" className="w-[300px] p-0 overflow-y-auto">
            <SidebarContent variant="mobile" onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>

      {/* DESKTOP */}
      {/* ✅ IMPORTANTE: aqui não forçamos mais w-20/w-72, porque a largura agora vem do layout via --sidebar-w */}
      <aside
        className={cn(
          "hidden md:flex min-h-screen flex-col bg-white transition-all duration-300 w-full",
          className
        )}
      >
        <SidebarContent variant="desktop" />
      </aside>
    </>
  );
}
