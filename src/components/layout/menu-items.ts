import {
  ClipboardList,
  Factory,
  BarChart3,
  Package,
  FileInput,
  Boxes,
  Box,
  FileText,
  Tag,
  History,
  AlertTriangle,
  ArrowLeftRight,
  BadgeDollarSign,
  Users,
  Truck,
  Receipt,
  Building2,
  FilePlus2,
  ShoppingCart,
  type LucideIcon,
} from "lucide-react";

export type MenuSection =
  | "operacao"
  | "estoque"
  | "engenharia"
  | "compras"
  | "financeiro"
  | "administracao";

export type MenuItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  section: MenuSection;
};

export type MenuSectionConfig = {
  key: MenuSection;
  label: string;
};

export const menuSectionOrder: MenuSectionConfig[] = [
  { key: "operacao", label: "Operação" },
  { key: "estoque", label: "Estoque" },
  { key: "engenharia", label: "Engenharia" },
  { key: "compras", label: "Compras" },
  { key: "financeiro", label: "Financeiro" },
  { key: "administracao", label: "Administração" },
];

export const menuItems: MenuItem[] = [
  {
    label: "Pedidos",
    href: "/dashboard/pedidos",
    icon: ClipboardList,
    section: "operacao",
  },
  {
    label: "Produção",
    href: "/dashboard/producao",
    icon: Factory,
    section: "operacao",
  },
  {
    label: "Produtividade",
    href: "/dashboard/produtividade",
    icon: BarChart3,
    section: "operacao",
  },
  {
    label: "Histórico",
    href: "/dashboard/historico-pedidos",
    icon: History,
    section: "operacao",
  },

  {
    label: "Estoque",
    href: "/dashboard/estoque",
    icon: Package,
    section: "estoque",
  },
  {
    label: "Entradas",
    href: "/dashboard/entradas",
    icon: FileInput,
    section: "estoque",
  },
  {
    label: "Inventário",
    href: "/dashboard/inventario",
    icon: Boxes,
    section: "estoque",
  },
  {
    label: "Produtos",
    href: "/dashboard/produtos",
    icon: Box,
    section: "estoque",
  },
  {
    label: "Transferências",
    href: "/dashboard/transferencias",
    icon: ArrowLeftRight,
    section: "estoque",
  },
  {
    label: "Perdas",
    href: "/dashboard/perdas",
    icon: AlertTriangle,
    section: "estoque",
  },

  {
    label: "Fichas Técnicas",
    href: "/dashboard/fichas-tecnicas",
    icon: FileText,
    section: "engenharia",
  },
  {
    label: "Etiquetas",
    href: "/dashboard/etiquetas",
    icon: Tag,
    section: "engenharia",
  },

  {
    label: "Fornecedores",
    href: "/compras/fornecedores",
    icon: Building2,
    section: "compras",
  },
  {
    label: "Solicitações",
    href: "/compras/solicitacoes",
    icon: FilePlus2,
    section: "compras",
  },
  {
    label: "Compras",
    href: "/compras/pedidos",
    icon: ShoppingCart,
    section: "compras",
  },
  {
    label: "Recebimentos",
    href: "/compras/recebimentos",
    icon: Truck,
    section: "compras",
  },

  {
    label: "Contas a Pagar",
    href: "/financeiro/contas-a-pagar",
    icon: Receipt,
    section: "financeiro",
  },
  {
    label: "Controladoria",
    href: "/dashboard/controladoria",
    icon: BadgeDollarSign,
    section: "financeiro",
  },

  {
    label: "Usuários",
    href: "/dashboard/admin/usuarios",
    icon: Users,
    section: "administracao",
  },
];

export const menuItemsBySection = menuSectionOrder
  .map((section) => ({
    ...section,
    items: menuItems.filter((item) => item.section === section.key),
  }))
  .filter((section) => section.items.length > 0);

export const administracaoMenuItems = menuItems.filter(
  (item) => item.section === "administracao"
);
