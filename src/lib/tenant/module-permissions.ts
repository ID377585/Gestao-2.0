import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TenantMembershipRole } from "@/lib/tenant/types";
import {
  emptyTenantModulePermissionMap,
  getDefaultModulePermissionsForRole,
  TENANT_ACCESS_MODULE_KEYS,
  type TenantAccessModuleKey,
  type TenantModulePermissionMap,
} from "@/lib/tenant/module-routes";

export {
  emptyTenantModulePermissionMap,
  getDefaultModulePermissionsForRole,
  TENANT_ACCESS_MODULE_KEYS,
};
export type { TenantAccessModuleKey, TenantModulePermissionMap };

export async function upsertDefaultModulePermissions(params: {
  supabaseAdmin: SupabaseClient<any, any, any>;
  establishmentId: string;
  userId: string;
  role: TenantMembershipRole | string;
  updatedBy?: string | null;
}) {
  const permissions = getDefaultModulePermissionsForRole(params.role);
  const now = new Date().toISOString();

  const rows = TENANT_ACCESS_MODULE_KEYS.map((moduleKey) => ({
    establishment_id: params.establishmentId,
    user_id: params.userId,
    module_key: moduleKey,
    can_access: permissions[moduleKey],
    updated_by: params.updatedBy ?? null,
    updated_at: now,
  }));

  const { error } = await params.supabaseAdmin
    .from("user_module_permissions")
    .upsert(rows, {
      onConflict: "establishment_id,user_id,module_key",
    });

  if (error) {
    const code = String((error as any)?.code ?? "");
    if (code === "42P01" || code === "PGRST205" || code === "PGRST204") {
      console.warn(
        "Tabela user_module_permissions não disponível; bootstrap de permissões ignorado."
      );
      return { skipped: true as const, permissions };
    }

    console.error("Erro ao aplicar permissões padrão por módulo:", error);
    throw new Error("Não foi possível aplicar as permissões padrão da empresa.");
  }

  return { skipped: false as const, permissions };
}
