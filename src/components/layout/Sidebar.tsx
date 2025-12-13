"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

import { Separator } from "@/components/ui/separator";

const menuItems = [
  {
    title: "Pedidos",
    href: "/dashboard/pedidos",
    icon: "📋",
    description: "Kanban de pedidos"
  },
  {
    title: "Produção",
    href: "/dashboard/producao",
    icon: "👨‍🍳",
    description: "KDS - Monitor de Cozinha"
  },
  {
    title: "Produtividade",
    href: "/dashboard/produtividade",
    icon: "📊",
    description: "Ranking de colaboradores"
  },
  {
    title: "Estoque",
    href: "/dashboard/estoque",
    icon: "📦",
    description: "Controle de estoque"
  },
  {
    title: "Fichas Técnicas",
    href: "/dashboard/fichas-tecnicas",
    icon: "📝",
    description: "Receitas e custos"
  },
  {
    title: "Etiquetas",
    href: "/dashboard/etiquetas",
    icon: "🏷️",
    description: "Impressão térmica"
  },
  {
    title: "Histórico",
    href: "/dashboard/historico-pedidos",
    icon: "📈",
    description: "Histórico de pedidos"
  },
  {
    title: "Compras",
    href: "/dashboard/compras",
    icon: "🛒",
    description: "Import/Export dados"
  }
];

const adminItems = [
  {
    title: "Usuários",
    href: "/dashboard/admin/usuarios",
    icon: "👥",
    description: "Gestão de usuários"
  }
];

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={cn("pb-12 min-h-screen", className)}>
      <div className="space-y-4 py-4">
        {/* Logo */}
        <div className="px-3 py-2">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-green-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">G2</span>
            </div>
            {!collapsed && (
              <h2 className="text-lg font-semibold tracking-tight">
                Gestão 2.0
              </h2>
            )}
          </div>
        </div>

        {/* Toggle Button */}
        <div className="px-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className="w-full justify-start"
          >
            <span className="mr-2">{collapsed ? "→" : "←"}</span>
            {!collapsed && "Recolher"}
          </Button>
        </div>

        <Separator />

        {/* Main Menu */}
        <div className="px-3">
          <div className="space-y-1">
            <h3 className={cn(
              "mb-2 px-4 text-sm font-semibold tracking-tight text-gray-500",
              collapsed && "hidden"
            )}>
              MENU PRINCIPAL
            </h3>
            {menuItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={pathname === item.href ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start",
                    collapsed ? "px-2" : "px-4"
                  )}
                >
                  <span className="mr-2 text-base">{item.icon}</span>
                  {!collapsed && (
                    <div className="flex flex-col items-start">
                      <span className="font-medium">{item.title}</span>
                      <span className="text-xs text-gray-500">{item.description}</span>
                    </div>
                  )}
                </Button>
              </Link>
            ))}
          </div>
        </div>

        <Separator />

        {/* Admin Menu */}
        <div className="px-3">
          <div className="space-y-1">
            <h3 className={cn(
              "mb-2 px-4 text-sm font-semibold tracking-tight text-gray-500",
              collapsed && "hidden"
            )}>
              ADMINISTRAÇÃO
            </h3>
            {adminItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={pathname === item.href ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start",
                    collapsed ? "px-2" : "px-4"
                  )}
                >
                  <span className="mr-2 text-base">{item.icon}</span>
                  {!collapsed && (
                    <div className="flex flex-col items-start">
                      <span className="font-medium">{item.title}</span>
                      <span className="text-xs text-gray-500">{item.description}</span>
                    </div>
                  )}
                </Button>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}