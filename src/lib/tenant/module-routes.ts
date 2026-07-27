export type TenantAccessModuleKey =
  | "operacao"
  | "estoque"
  | "engenharia"
  | "compras"
  | "fiscal"
  | "financeiro"
  | "administracao";

export const TENANT_ACCESS_MODULE_KEYS: TenantAccessModuleKey[] = [
  "operacao",
  "estoque",
  "engenharia",
  "compras",
  "fiscal",
  "financeiro",
  "administracao",
];

export type TenantModulePermissionMap = Record<TenantAccessModuleKey, boolean>;

export function emptyTenantModulePermissionMap(): TenantModulePermissionMap {
  return TENANT_ACCESS_MODULE_KEYS.reduce((acc, key) => {
    acc[key] = false;
    return acc;
  }, {} as TenantModulePermissionMap);
}

export function getDefaultModulePermissionsForRole(
  role: string
): TenantModulePermissionMap {
  const permissions = emptyTenantModulePermissionMap();

  switch (role) {
    case "admin":
      for (const key of TENANT_ACCESS_MODULE_KEYS) permissions[key] = true;
      break;
    case "operacao":
    case "producao":
      permissions.operacao = true;
      permissions.engenharia = true;
      break;
    case "estoque":
      permissions.estoque = true;
      break;
    case "fiscal":
      permissions.fiscal = true;
      break;
    case "entrega":
      permissions.operacao = true;
      break;
  }

  return permissions;
}

function matchesAny(pathname: string, prefixes: string[]) {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function getModuleKeyForPathname(
  pathname: string
): TenantAccessModuleKey | null {
  const path = pathname.split("?")[0] || "/";

  if (matchesAny(path, ["/dashboard/admin"])) return "administracao";
  if (matchesAny(path, ["/dashboard/fiscal"])) return "fiscal";
  if (matchesAny(path, ["/compras", "/dashboard/compras"])) return "compras";
  if (matchesAny(path, ["/financeiro", "/dashboard/controladoria"])) {
    return "financeiro";
  }

  if (
    matchesAny(path, [
      "/engenharia",
      "/dashboard/fichas-tecnicas",
      "/dashboard/lista-rapida",
      "/dashboard/check-list",
      "/dashboard/etiquetas",
    ])
  ) {
    return "engenharia";
  }

  if (
    matchesAny(path, [
      "/estoque",
      "/dashboard/estoque",
      "/dashboard/entradas",
      "/dashboard/inventario",
      "/dashboard/produtos",
      "/dashboard/transferencias",
      "/dashboard/perdas",
    ])
  ) {
    return "estoque";
  }

  if (
    matchesAny(path, [
      "/dashboard/pedidos",
      "/dashboard/producao",
      "/dashboard/produtividade",
      "/dashboard/historico-pedidos",
      "/dashboard/separacao",
    ])
  ) {
    return "operacao";
  }

  return null;
}
