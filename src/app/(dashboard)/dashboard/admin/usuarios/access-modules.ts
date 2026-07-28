export type AccessModuleKey =
  | "operacao"
  | "estoque"
  | "engenharia"
  | "compras"
  | "fiscal"
  | "financeiro"
  | "rh"
  | "administracao";

export type AccessModule = {
  key: AccessModuleKey;
  label: string;
  description: string;
};

export const ACCESS_MODULES: AccessModule[] = [
  {
    key: "operacao",
    label: "Operação",
    description: "Pedidos, produção, separação e histórico operacional.",
  },
  {
    key: "estoque",
    label: "Estoque",
    description: "Estoque, produtos, entradas, inventário, perdas e transferências.",
  },
  {
    key: "engenharia",
    label: "Engenharia",
    description: "Fichas técnicas, lista rápida e etiquetas.",
  },
  {
    key: "compras",
    label: "Compras",
    description: "Fornecedores, solicitações, pedidos, recebimentos e auditoria de compras.",
  },
  {
    key: "fiscal",
    label: "Fiscal",
    description: "Notas, certificado, divergências, vínculos e dados fiscais.",
  },
  {
    key: "financeiro",
    label: "Financeiro",
    description: "DRE, contas, fluxo de caixa, bancos, conciliação e relatórios.",
  },
  {
    key: "rh",
    label: "RH",
    description: "Ponto digital, jornada, intervalos e banco de horas interno.",
  },
  {
    key: "administracao",
    label: "Administração",
    description: "Usuários, assinatura e configurações administrativas.",
  },
];

export type UserModulePermission = {
  module_key: AccessModuleKey;
  can_access: boolean;
};

export type UserModulePermissionMap = Record<AccessModuleKey, boolean>;

export function emptyModulePermissionMap(): UserModulePermissionMap {
  return ACCESS_MODULES.reduce((acc, module) => {
    acc[module.key] = false;
    return acc;
  }, {} as UserModulePermissionMap);
}
