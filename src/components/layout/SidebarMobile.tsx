"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  BarChart3,
  ClipboardList,
  Factory,
  FileText,
  History,
  Menu,
  Package,
  ShoppingCart,
  Tag,
  Users,
  X,
  AlertTriangle,
  ArrowLeftRight,
  BadgeDollarSign,
} from "lucide-react";

const menuItems = [
  { title: "Pedidos", href: "/dashboard/pedidos", icon: ClipboardList },
  { title: "Produção", href: "/dashboard/producao", icon: Factory },
  { title: "Produtividade", href: "/dashboard/produtividade", icon: BarChart3 },
  { title: "Estoque", href: "/dashboard/estoque", icon: Package },
  { title: "Fichas Técnicas", href: "/dashboard/fichas-tecnicas", icon: FileText },
  { title: "Etiquetas", href: "/dashboard/etiquetas", icon: Tag },
  { title: "Histórico", href: "/dashboard/historico-pedidos", icon: History },
  { title: "Compras", href: "/dashboard/compras", icon: ShoppingCart },
];

const adminItems = [
  // ✅ opções que faltavam no mobile
  { title: "Perdas", href: "/dashboard/perdas", icon: AlertTriangle },
  { title: "Transferências", href: "/dashboard/transferencias", icon: ArrowLeftRight },
  { title: "Controladoria", href: "/dashboard/controladoria", icon: BadgeDollarSign },

  // ✅ já existia
  { title: "Usuários", href: "/dashboard/admin/usuarios", icon: Users },
];

export function SidebarMobile() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Fecha ao trocar de rota
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Fecha no ESC
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    if (open) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      {/* Botão Hamburguer (aparece só no mobile) */}
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

      {/* Overlay + Drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Fundo escuro */}
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Fechar menu"
            onClick={() => setOpen(false)}
          />

          {/* Painel */}
          <div className="absolute left-0 top-0 h-full w-72 bg-white shadow-xl flex flex-col">
            {/* Header */}
            <div className="flex h-16 items-center justify-between border-b px-4 shrink-0">
              <div className="font-semibold">Gestão 2.0</div>
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

            {/* Conteúdo (rolável) */}
            <nav className="p-4 overflow-y-auto flex-1">
              <div className="space-y-2">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    pathname === item.href || pathname?.startsWith(item.href + "/");

                  return (
                    <Link key={item.href} href={item.href}>
                      <Button
                        variant={isActive ? "secondary" : "ghost"}
                        className={cn("w-full justify-start gap-3")}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {item.title}
                      </Button>
                    </Link>
                  );
                })}
              </div>

              <div className="mt-6 border-t pt-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 px-2 mb-2">
                  Administração
                </div>

                <div className="space-y-2">
                  {adminItems.map((item) => {
                    const Icon = item.icon;
                    const isActive =
                      pathname === item.href || pathname?.startsWith(item.href + "/");

                    return (
                      <Link key={item.href} href={item.href}>
                        <Button
                          variant={isActive ? "secondary" : "ghost"}
                          className="w-full justify-start gap-3"
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          {item.title}
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
