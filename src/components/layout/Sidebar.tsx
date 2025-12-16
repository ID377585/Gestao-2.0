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
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

/* ======================
   MENU CONFIG
====================== */
const menuItems = [
  {
    title: "Pedidos",
    href: "/dashboard/pedidos",
    icon: ClipboardList,
    description: "Kanban de pedidos",
  },
  {
    title: "Produção",
    href: "/dashboard/producao",
    icon: Factory,
    description: "KDS - Monitor de Cozinha",
  },
  {
    title: "Produtividade",
    href: "/dashboard/produtividade",
    icon: BarChart3,
    description: "Ranking de colaboradores",
  },
  {
    title: "Estoque",
    href: "/dashboard/estoque",
    icon: Package,
    description: "Controle de estoque",
  },
  {
    title: "Fichas Técnicas",
    href: "/dashboard/fichas-tecnicas",
    icon: FileText,
    description: "Receitas e custos",
  },
  {
    title: "Etiquetas",
    href: "/dashboard/etiquetas",
    icon: Tag,
    description: "Impressão térmica",
  },
  {
    title: "Histórico",
    href: "/dashboard/historico-pedidos",
    icon: History,
    description: "Histórico de pedidos",
  },
  {
    title: "Compras",
    href: "/dashboard/compras",
    icon: ShoppingCart,
    description: "Importação e exportação",
  },
];

const adminItems = [
  {
    title: "Usuários",
    href: "/dashboard/admin/usuarios",
    icon: Users,
    description: "Gestão de usuários",
  },
];

interface SidebarProps {
  className?: string;
}

/* ======================
   COMPONENT
====================== */
export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "hidden md:flex min-h-screen flex-col border-r bg-white transition-all duration-300",
        collapsed ? "w-20" : "w-72",
        className
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-r from-blue-600 to-green-600 text-sm font-bold text-white">
            G2
          </div>
          {!collapsed && (
            <span className="text-lg font-semibold tracking-tight">
              Gestão 2.0
            </span>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="h-8 w-8"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Menu */}
      <nav className="flex-1 space-y-4 px-3 py-4">
        {/* Main */}
        <div>
          {!collapsed && (
            <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Menu Principal
            </h3>
          )}

          <div className="space-y-1">
            {menuItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start gap-3",
                      collapsed ? "px-3" : "px-4"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />

                    {!collapsed && (
                      <div className="flex flex-col items-start text-left">
                        <span className="text-sm font-medium">
                          {item.title}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {item.description}
                        </span>
                      </div>
                    )}
                  </Button>
                </Link>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* Admin */}
        <div>
          {!collapsed && (
            <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Administração
            </h3>
          )}

          <div className="space-y-1">
            {adminItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start gap-3",
                      collapsed ? "px-3" : "px-4"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />

                    {!collapsed && (
                      <div className="flex flex-col items-start text-left">
                        <span className="text-sm font-medium">
                          {item.title}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {item.description}
                        </span>
                      </div>
                    )}
                  </Button>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </aside>
  );
}
