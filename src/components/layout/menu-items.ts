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
  UserRoundCheck,
  type LucideIcon,
} from "lucide-react";
import { NUTRICAO_SUBMODULES } from "@/lib/nutricao/navigation";

export type MenuSectionKey =
  | "operacao"
  | "estoque"
  | "engenharia"
  | "nutricao"
  | "compras"
  | "fiscal"
  | "financeiro"
  | "rh"
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
        label: "Rascunhos de Entradas",
        href: "/dashboard/entradas/rascunhos",
        icon: FileText,
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
        label: "Lista de Produção",
        href: "/engenharia/lista-producao",
        icon: ClipboardList,
      },
      {
        label: "Tabela Nutricional",
        href: "/engenharia/tabela-nutricional",
        icon: ClipboardList,
      },
      {
        label: "Cadastrar Nutrientes",
        href: "/engenharia/tabela-nutricional/produtos",
        icon: ClipboardList,
      },
      {
        label: "Preço Venda Médio",
        href: "/engenharia/preco-venda-medio",
        icon: BadgeDollarSign,
      },
      {
        label: "Lista Rápida",
        href: "/dashboard/lista-rapida",
        icon: ClipboardList,
      },
      {
        label: "Check-List",
        href: "/dashboard/check-list",
        icon: ClipboardList,
      },
      {
        label: "Listas de Compras",
        href: "/engenharia/listas-de-compras",
        icon: ShoppingCart,
      },
      {
        label: "Etiquetas",
        href: "/dashboard/etiquetas",
        icon: Tag,
      },
    ],
  },
  {
    key: "nutricao",
    label: "Nutrição",
    icon: NUTRICAO_SUBMODULES[0].icon,
    items: NUTRICAO_SUBMODULES.map((item) => ({
      label: item.menuLabel,
      href: item.href,
      icon: item.icon,
    })),
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
    key: "fiscal",
    label: "Fiscal",
    icon: Receipt,
    items: [
      {
        label: "Dashboard Fiscal",
        href: "/dashboard/fiscal/dashboard",
        icon: BarChart3,
      },
      {
        label: "Notas disponíveis",
        href: "/dashboard/fiscal/notas",
        icon: Receipt,
      },
      {
        label: "Auditoria Fiscal",
        href: "/dashboard/fiscal/auditoria",
        icon: AlertTriangle,
      },
      {
        label: "Divergências Fiscais",
        href: "/dashboard/fiscal/divergencias",
        icon: ArrowLeftRight,
      },
      {
        label: "Vínculos Fiscais",
        href: "/dashboard/fiscal/vinculos",
        icon: Tag,
      },
      {
        label: "Dados da Empresa",
        href: "/dashboard/fiscal/empresa",
        icon: Building2,
      },
      {
        label: "Certificado A1",
        href: "/dashboard/fiscal/certificado",
        icon: FileText,
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
        label: "Dashboard",
        href: "/financeiro",
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
    key: "rh",
    label: "RH",
    icon: UserRoundCheck,
    items: [
      {
        label: "Dashboard RH",
        href: "/dashboard/rh",
        icon: BarChart3,
      },
      {
        label: "Ponto Digital",
        href: "/dashboard/rh/ponto-digital",
        icon: Timer,
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
      {
        label: "Empresas",
        href: "/dashboard/admin/empresas",
        icon: Building2,
      },
      {
        label: "Assinatura",
        href: "/dashboard/admin/assinatura",
        icon: BadgeDollarSign,
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

export const flatMenuItems = menuItems;

export const principalMenuItems: MenuItem[] = menuSections
  .filter((section) => section.key !== "administracao")
  .flatMap((section) =>
    section.items.map((item) => ({
      ...item,
      section: section.key,
    }))
  );

export const administracaoMenuItems: MenuItem[] = menuSections
  .filter((section) => section.key === "administracao")
  .flatMap((section) =>
    section.items.map((item) => ({
      ...item,
      section: section.key,
    }))
  );
