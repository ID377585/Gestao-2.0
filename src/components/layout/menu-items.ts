// src/components/layout/menu-items.ts
import type { LucideIcon } from "lucide-react";
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
  AlertTriangle,
  Repeat,
  DollarSign,
} from "lucide-react";

export type Role =
  | "cliente"
  | "operacao"
  | "producao"
  | "estoque"
  | "fiscal"
  | "admin"
  | "entrega";

export type MenuItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export type MenuSection = {
  section: string;
  // se vazio/undefined: todos podem ver
  roles?: Role[];
  items: MenuItem[];
};

/**
 * IMPORTANTE:
 * - Aqui fica o menu "fonte única da verdade".
 * - Desktop e Mobile devem renderizar exatamente isso.
 */
export const MENU_SECTIONS: MenuSection[] = [
  {
    section: "Menu Principal",
    items: [
      { label: "Pedidos", href: "/dashboard/pedidos", icon: ClipboardList },
      { label: "Produção", href: "/dashboard/producao", icon: Factory },
      { label: "Produtividade", href: "/dashboard/produtividade", icon: BarChart3 },
      { label: "Estoque", href: "/dashboard/estoque", icon: Package },
      { label: "Fichas Técnicas", href: "/dashboard/fichas-tecnicas", icon: FileText },
      { label: "Etiquetas", href: "/dashboard/etiquetas", icon: Tag },
      { label: "Histórico", href: "/dashboard/historico", icon: History },
      { label: "Compras", href: "/dashboard/compras", icon: ShoppingCart },
    ],
  },
  {
    section: "Administração",
    roles: ["admin"],
    items: [
      { label: "Perdas", href: "/dashboard/perdas", icon: AlertTriangle },
      { label: "Transferências", href: "/dashboard/transferencias", icon: Repeat },
      { label: "Controladoria", href: "/dashboard/controladoria", icon: DollarSign },
      { label: "Usuários", href: "/dashboard/usuarios", icon: Users },
    ],
  },
];
