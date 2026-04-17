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
  ShoppingCart,
  AlertTriangle,
  ArrowLeftRight,
  BadgeDollarSign,
  Users,
  Truck,
  Receipt,
  Building2,
  FilePlus2,
  type LucideIcon,
} from "lucide-react";

export type MenuSection = "principal" | "administracao";

export type MenuItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  section: MenuSection;
};

export const menuItems: MenuItem[] = [
  {
    label: "Pedidos",
    href: "/dashboard/pedidos",
    icon: ClipboardList,
    section: "principal",
  },
  {
    label: "Produção",
    href: "/dashboard/producao",
    icon: Factory,
    section: "principal",
  },
  {
    label: "Produtividade",
    href: "/dashboard/produtividade",
    icon: BarChart3,
    section: "principal",
  },
  {
    label: "Estoque",
    href: "/dashboard/estoque",
    icon: Package,
    section: "principal",
  },
  {
    label: "Entradas",
    href: "/dashboard/entradas",
    icon: FileInput,
    section: "principal",
  },
  {
    label: "Inventário",
    href: "/dashboard/inventario",
    icon: Boxes,
    section: "principal",
  },
  {
    label: "Produtos",
    href: "/dashboard/produtos",
    icon: Box,
    section: "principal",
  },
  {
    label: "Fichas Técnicas",
    href: "/dashboard/fichas-tecnicas",
    icon: FileText,
    section: "principal",
  },
  {
    label: "Etiquetas",
    href: "/dashboard/etiquetas",
    icon: Tag,
    section: "principal",
  },
  {
    label: "Histórico",
    href: "/dashboard/historico-pedidos",
    icon: History,
    section: "principal",
  },
  {
    label: "Perdas",
    href: "/dashboard/perdas",
    icon: AlertTriangle,
    section: "principal",
  },
  {
    label: "Transferências",
    href: "/dashboard/transferencias",
    icon: ArrowLeftRight,
    section: "principal",
  },
  {
    label: "Fornecedores",
    href: "/compras/fornecedores",
    icon: Building2,
    section: "principal",
  },
  {
    label: "Solicitações",
    href: "/compras/solicitacoes",
    icon: FilePlus2,
    section: "principal",
  },
  {
    label: "Compras",
    href: "/compras/pedidos",
    icon: ShoppingCart,
    section: "principal",
  },
  {
    label: "Recebimentos",
    href: "/compras/recebimentos",
    icon: Truck,
    section: "principal",
  },
  {
    label: "Contas a Pagar",
    href: "/financeiro/contas-a-pagar",
    icon: Receipt,
    section: "principal",
  },
  {
    label: "Controladoria",
    href: "/dashboard/controladoria",
    icon: BadgeDollarSign,
    section: "principal",
  },
  {
    label: "Usuários",
    href: "/dashboard/admin/usuarios",
    icon: Users,
    section: "administracao",
  },
];

export const principalMenuItems = menuItems.filter(
  (item) => item.section === "principal"
);

export const administracaoMenuItems = menuItems.filter(
  (item) => item.section === "administracao"
);
