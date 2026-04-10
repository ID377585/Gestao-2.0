"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GestifyMark } from "@/components/brand/GestifyMark";

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
  Boxes,
} from "lucide-react";

const menuItems = [
  { title: "Pedidos", href: "/dashboard/pedidos", icon: ClipboardList },
  { title: "Produção", href: "/dashboard/producao", icon: Factory },
  { title: "Produtividade", href: "/dashboard/produtividade", icon: BarChart3 },
  { title: "Estoque", href: "/dashboard/estoque", icon: Package },
  { title: "Inventário", href: "/dashboard/inventario", icon: Boxes },
  { title: "Produtos", href: "/dashboard/produtos", icon: Package },
  { title: "Fichas Técnicas", href: "/dashboard/fichas-tecnicas", icon: FileText },
  { title: "Etiquetas", href: "/dashboard/etiquetas", icon: Tag },
  { title: "Histórico", href: "/dashboard/historico-pedidos", icon: History },
  { title: "Hub de Dados", href: "/dashboard/compras", icon: ShoppingCart },
  { title: "Perdas", href: "/dashboard/perdas", icon: AlertTriangle },
  { title: "Transferências", href: "/dashboard/transferencias", icon: ArrowLeftRight },
];

const adminItems = [
  { title: "Controladoria", href: "/dashboard/controladoria", icon: BadgeDollarSign },
  { title: "Usuários", href: "/dashboard/admin/usuarios", icon: Users },
];

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
    if (open) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

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

          <div className="fixed left-0 top-0 flex h-full w-72 flex-col overflow-hidden bg-white shadow-xl">
            <div className="flex h-16 shrink-0 items-center justify-between border-b px-4">
              <div className="flex items-center gap-3">
                <GestifyMark size={40} compact />
                <div className="text-xl font-black tracking-tight text-slate-950">
                  Gestify
                </div>
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

            <nav className="flex-1 overflow-y-auto p-4">
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
                <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
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