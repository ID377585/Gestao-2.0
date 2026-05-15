export type AccessModuleKey =
  | "operacao"
  | "estoque"
  | "engenharia"
  | "compras"
  | "fiscal"
  | "financeiro"
  | "administracao";

export type AccessModule = {
  key: AccessModuleKey;
  label: string;
  description: string;
};

export type ModulePermissionMap = Record<AccessModuleKey, boolean>;

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
    key: "administracao",
    label: "Administração",
    description: "Usuários, assinatura e configurações administrativas.",
  },
];

export const ACCESS_MODULE_KEYS = ACCESS_MODULES.map((module) => module.key);

export function isAccessModuleKey(value: string): value is AccessModuleKey {
  return ACCESS_MODULE_KEYS.includes(value as AccessModuleKey);
}

export function emptyModulePermissionMap(): ModulePermissionMap {
  return ACCESS_MODULE_KEYS.reduce((acc, key) => {
    acc[key] = false;
    return acc;
  }, {} as ModulePermissionMap);
}

export function getDefaultModulesForRole(role: string | null | undefined) {
  const permissions = emptyModulePermissionMap();
  const normalizedRole = String(role ?? "").trim().toLowerCase();

  if (normalizedRole === "admin") {
    for (const key of ACCESS_MODULE_KEYS) permissions[key] = true;
    return permissions;
  }

  if (normalizedRole === "operacao" || normalizedRole === "producao") {
    permissions.operacao = true;
    permissions.engenharia = true;
  }

  if (normalizedRole === "estoque") {
    permissions.estoque = true;
  }

  if (normalizedRole === "fiscal") {
    permissions.fiscal = true;
  }

  if (normalizedRole === "entrega") {
    permissions.operacao = true;
  }

  return permissions;
}

const MODULE_PATH_PREFIXES: Array<{
  prefix: string;
  moduleKey: AccessModuleKey;
}> = [
  { prefix: "/dashboard/admin", moduleKey: "administracao" },
  { prefix: "/dashboard/fiscal", moduleKey: "fiscal" },
  { prefix: "/dashboard/controladoria", moduleKey: "financeiro" },
  { prefix: "/dashboard/fichas-tecnicas", moduleKey: "engenharia" },
  { prefix: "/dashboard/lista-rapida", moduleKey: "engenharia" },
  { prefix: "/dashboard/etiquetas", moduleKey: "engenharia" },
  { prefix: "/dashboard/estoque", moduleKey: "estoque" },
  { prefix: "/dashboard/entradas", moduleKey: "estoque" },
  { prefix: "/dashboard/inventario", moduleKey: "estoque" },
  { prefix: "/dashboard/produtos", moduleKey: "estoque" },
  { prefix: "/dashboard/transferencias", moduleKey: "estoque" },
  { prefix: "/dashboard/perdas", moduleKey: "estoque" },
  { prefix: "/dashboard/pedidos", moduleKey: "operacao" },
  { prefix: "/dashboard/producao", moduleKey: "operacao" },
  { prefix: "/dashboard/produtividade", moduleKey: "operacao" },
  { prefix: "/dashboard/historico-pedidos", moduleKey: "operacao" },
  { prefix: "/compras", moduleKey: "compras" },
  { prefix: "/financeiro", moduleKey: "financeiro" },
  { prefix: "/estoque", moduleKey: "estoque" },
  { prefix: "/engenharia", moduleKey: "engenharia" },
];

function matchesPathPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function getModuleKeyForPath(pathname: string) {
  const normalizedPathname = pathname.split("?")[0] || "/";

  return MODULE_PATH_PREFIXES.find(({ prefix }) =>
    matchesPathPrefix(normalizedPathname, prefix)
  )?.moduleKey;
}
