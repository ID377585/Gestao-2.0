import "server-only";

import { redirect } from "next/navigation";
import { getEstablishmentEntitlement } from "@/lib/compliance/legal.server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { TenantContext } from "@/lib/tenant/types";
import {
  emptyTenantModulePermissionMap,
  getDefaultModulePermissionsForRole,
  TENANT_ACCESS_MODULE_KEYS,
  type TenantAccessModuleKey,
  type TenantModulePermissionMap,
} from "@/lib/tenant/module-routes";

export type {
  TenantAccessModuleKey,
  TenantModulePermissionMap,
} from "@/lib/tenant/module-routes";

function isMissingPermissionTableError(error: any) {
  const code = String(error?.code ?? "");
  const message = String(error?.message ?? "").toLowerCase();

  return (
    code === "42P01" ||
    code === "PGRST205" ||
    code === "PGRST204" ||
    message.includes("schema cache") ||
    message.includes("user_module_permissions")
  );
}

function applyContractEntitlementMask(
  permissions: TenantModulePermissionMap,
  entitlement: Awaited<ReturnType<typeof getEstablishmentEntitlement>>
) {
  if (!entitlement?.modules || typeof entitlement.modules !== "object") {
    return permissions;
  }

  const configuredModules = entitlement.modules as Record<string, unknown>;
  const hasExplicitCommercialScope = Object.keys(configuredModules).length > 0;
  if (!hasExplicitCommercialScope) return permissions;

  const masked = { ...permissions };
  for (const key of TENANT_ACCESS_MODULE_KEYS) {
    if (key === "administracao") continue;
    masked[key] = Boolean(permissions[key] && configuredModules[key] === true);
  }

  // Administração é tratada como plano de controle, não como módulo comercial.
  // Isso preserva usuários, assinatura e compliance mesmo em contratos limitados.
  masked.administracao = permissions.administracao;
  return masked;
}

export async function getTenantModulePermissions(
  tenant: TenantContext
): Promise<TenantModulePermissionMap> {
  const fallback = getDefaultModulePermissionsForRole(tenant.role);
  const permissions = emptyTenantModulePermissionMap();

  const [entitlement, permissionResult] = await Promise.all([
    getEstablishmentEntitlement(tenant.establishmentId),
    getSupabaseAdminClient()
      .from("user_module_permissions")
      .select("module_key, can_access")
      .eq("establishment_id", tenant.establishmentId)
      .eq("user_id", tenant.userId),
  ]);

  const { data, error } = permissionResult;

  if (error) {
    if (isMissingPermissionTableError(error)) {
      return applyContractEntitlementMask(fallback, entitlement);
    }

    console.error("Erro ao ler permissões por módulo do usuário ativo:", error);
    return applyContractEntitlementMask(permissions, entitlement);
  }

  if (!data || data.length === 0) {
    return applyContractEntitlementMask(fallback, entitlement);
  }

  for (const key of TENANT_ACCESS_MODULE_KEYS) {
    permissions[key] = fallback[key];
  }

  for (const row of data) {
    const moduleKey = String((row as any).module_key ?? "") as TenantAccessModuleKey;
    if (!TENANT_ACCESS_MODULE_KEYS.includes(moduleKey)) continue;
    permissions[moduleKey] = Boolean((row as any).can_access);
  }

  return applyContractEntitlementMask(permissions, entitlement);
}

export function filterMenuSectionKeysByPermissions(
  permissions: TenantModulePermissionMap
): TenantAccessModuleKey[] {
  return TENANT_ACCESS_MODULE_KEYS.filter((key) => Boolean(permissions[key]));
}

export async function getAllowedMenuSectionKeysForTenant(
  tenant: TenantContext
): Promise<TenantAccessModuleKey[]> {
  const permissions = await getTenantModulePermissions(tenant);
  return filterMenuSectionKeysByPermissions(permissions);
}

export async function assertTenantCanAccessModule(
  tenant: TenantContext,
  moduleKey: TenantAccessModuleKey
) {
  const permissions = await getTenantModulePermissions(tenant);

  if (!permissions[moduleKey]) {
    redirect("/sem-acesso");
  }

  return permissions;
}
