import {
  AlertTriangle,
  ArrowLeftRight,
  BadgeDollarSign,
  BarChart3,
  Box,
  Boxes,
  Building2,
  ClipboardList,
  Factory,
  FileInput,
  FilePlus2,
  FileText,
  History,
  Package,
  Receipt,
  ShoppingCart,
  Tag,
  Timer,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";

export type MenuSectionKey =
  | "operacao"
  | "estoque"
  | "engenharia"
  | "compras"
  | "financeiro"
  | "administracao";

export type MenuSubItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export type MenuSectionConfig = {
  key: MenuSectionKey;
  label: string;
  icon: LucideIcon;
  items: MenuSubItem[];
};

export type MenuItem = MenuSubItem & {
  section: MenuSectionKey;
};

export const menuSections: MenuSectionConfig[] = [
  {
    key: "operacao",
    label: "Operação",
    icon: ClipboardList,
    items: [
      {
        label: "Pedidos",
        href: "/dashboard/pedidos",
        icon: ClipboardList,
      },
      {
        label: "Produção",
        href: "/dashboard/producao",
        icon: Factory,
      },
      {
        label: "Produtividade",
        href: "/dashboard/produtividade",
        icon: BarChart3,
      },
      {
        label: "Histórico",
        href: "/dashboard/historico-pedidos",
        icon: History,
      },
    ],
  },
  {
    key: "estoque",
    label: "Estoque",
    icon: Package,
    items: [
  {
    label: "Dashboard",
    href: "/estoque",
    icon: BarChart3,
  },
  {
    label: "Estoque",
    href: "/dashboard/estoque",
    icon: Package,
  },
  {
    label: "Entradas",
    href: "/dashboard/entradas",
    icon: FileInput,
  },
  {
    label: "Inventário",
    href: "/dashboard/inventario",
    icon: Boxes,
  },
  {
    label: "Produtos",
    href: "/dashboard/produtos",
    icon: Box,
  },
  {
    label: "Transferências",
    href: "/dashboard/transferencias",
    icon: ArrowLeftRight,
  },
  {
    label: "Perdas",
    href: "/dashboard/perdas",
    icon: AlertTriangle,
  },
],
  },
  {
    key: "engenharia",
    label: "Engenharia",
    icon: FileText,
    items: [
  {
    label: "Dashboard",
    href: "/engenharia",
    icon: BarChart3,
  },
  {
    label: "Fichas Técnicas",
    href: "/dashboard/fichas-tecnicas",
    icon: FileText,
  },
  {
    label: "Etiquetas",
    href: "/dashboard/etiquetas",
    icon: Tag,
  },
],
  },
  {
    key: "compras",
    label: "Compras",
    icon: ShoppingCart,
    items: [
  {
    label: "Dashboard",
    href: "/compras",
    icon: BarChart3,
  },
  {
    label: "Fornecedores",
    href: "/compras/fornecedores",
    icon: Building2,
  },
  {
    label: "Dashboard Fornecedores",
    href: "/compras/fornecedores/dashboard",
    icon: Building2,
  },
   {
    label: "Dashboard Diário",
    href: "/compras/dashboard-diario",
    icon: ClipboardList,
  },
  {
    label: "Painel Semanal",
    href: "/compras/painel-semanal",
    icon: BarChart3,
  },
   {
    label: "Metas",
    href: "/compras/metas-compradores",
    icon: FileText,
  },
  {
    label: "Produtividade",
    href: "/compras/produtividade-compradores",
    icon: BarChart3,
  },
  {
    label: "Follow-up",
    href: "/compras/follow-up",
    icon: ClipboardList,
  },
  {
    label: "Solicitações",
    href: "/compras/solicitacoes",
    icon: FilePlus2,
  },
  {
    label: "Compras",
    href: "/compras/pedidos",
    icon: ShoppingCart,
  },
  {
    label: "Recebimentos",
    href: "/compras/recebimentos",
    icon: Truck,
  },
  {
    label: "Alertas",
    href: "/compras/alertas",
    icon: AlertTriangle,
  },
  {
    label: "Fila de Ação",
    href: "/compras/fila-de-acao",
    icon: ClipboardList,
  },
  {
    label: "Eficiência Operacional",
    href: "/compras/eficiencia-operacional",
    icon: Timer,
  },
  {
    label: "Auditoria",
    href: "/compras/auditoria",
    icon: History,
  },
],
  },
  {
    key: "financeiro",
    label: "Financeiro",
    icon: BadgeDollarSign,
    items: [
  {
    label: "DRE",
    href: "/financeiro/dre",
    icon: BarChart3,
  },
  {
    label: "Contas a Pagar",
    href: "/financeiro/contas-a-pagar",
    icon: Receipt,
  },
  {
    label: "Contas a Receber",
    href: "/financeiro/contas-a-receber",
    icon: BadgeDollarSign,
  },
  {
    label: "Fluxo de Caixa",
    href: "/financeiro/fluxo-de-caixa",
    icon: BarChart3,
  },
  {
    label: "Dashboard Bancário",
    href: "/financeiro/dashboard-bancario",
    icon: Building2,
  },
  {
    label: "Contas Bancárias",
    href: "/financeiro/contas-bancarias",
    icon: Building2,
  },
  {
    label: "Conciliação Bancária",
    href: "/financeiro/conciliacao-bancaria",
    icon: ArrowLeftRight,
  },
  {
    label: "Plano de Contas",
    href: "/financeiro/plano-de-contas",
    icon: FileText,
  },
  {
    label: "Centros de Custo",
    href: "/financeiro/centros-de-custo",
    icon: Building2,
  },
  {
    label: "Relatórios",
    href: "/financeiro/relatorios",
    icon: FileText,
  },
  {
  label: "Auditoria Financeira",
  href: "/financeiro/auditoria",
  icon: FileText,
},
{
  label: "Auditoria",
  href: "/compras/auditoria",
  icon: History,
},
  {
    label: "Controladoria",
    href: "/dashboard/controladoria",
    icon: BadgeDollarSign,
  },
],
  },
  {
    key: "administracao",
    label: "Administração",
    icon: Users,
    items: [
      {
        label: "Usuários",
        href: "/dashboard/admin/usuarios",
        icon: Users,
      },
    ],
  },
];

export const menuSectionOrder = menuSections.map(({ key, label, icon }) => ({
  key,
  label,
  icon,
}));

export const menuItemsBySection = menuSections;

export const menuItems: MenuItem[] = menuSections.flatMap((section) =>
  section.items.map((item) => ({
    ...item,
    section: section.key,
  }))
);

export const principalMenuItems = menuSections
  .filter((section) => section.key !== "administracao")
  .flatMap((section) =>
    section.items.map((item) => ({
      ...item,
      section: section.key,
    }))
  );

export const administracaoMenuItems = menuSections
  .filter((section) => section.key === "administracao")
  .flatMap((section) =>
    section.items.map((item) => ({
      ...item,
      section: section.key,
    }))
  );
