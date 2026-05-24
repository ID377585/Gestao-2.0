import "server-only";

import { revalidatePath } from "next/cache";
import {
  getSupabaseAdminClient,
} from "@/lib/supabase/server";
import { assertActiveTenantRole } from "@/lib/tenant/guards";
import type { ProfileRole } from "./actions";
import {
  ACCESS_MODULES,
  emptyModulePermissionMap,
  type AccessModuleKey,
  type UserModulePermission,
  type UserModulePermissionMap,
} from "./access-modules";

export { ACCESS_MODULES } from "./access-modules";
export type {
  AccessModule,
  AccessModuleKey,
  UserModulePermission,
  UserModulePermissionMap,
} from "./access-modules";

const ALL_MODULE_KEYS = ACCESS_MODULES.map((module) => module.key);

async function getContextOrThrow() {
  const tenant = await assertActiveTenantRole(["admin", "operacao"]);

  return {
    userId: tenant.userId,
    establishment_id: tenant.establishmentId,
    role: tenant.role,
  };
}

async function assertCollaboratorBelongsToActiveEstablishment(params: {
  supabaseAdmin: ReturnType<typeof getSupabaseAdminClient>;
  establishmentId: string;
  userId: string;
}) {
  const { data, error } = await params.supabaseAdmin
    .from("establishment_memberships")
    .select("user_id")
    .eq("establishment_id", params.establishmentId)
    .eq("user_id", params.userId)
    .maybeSingle();

  if (error) {
    console.error("Erro ao validar vínculo do usuário para permissões:", error);
    throw new Error("Não foi possível validar o vínculo do usuário.");
  }

  if (!data) {
    throw new Error("Usuário não pertence à empresa ativa.");
  }
}

export function getDefaultModulesForRole(role: ProfileRole): UserModulePermissionMap {
  const permissions = emptyModulePermissionMap();

  if (role === "admin") {
    for (const key of ALL_MODULE_KEYS) permissions[key] = true;
    return permissions;
  }

  if (role === "operacao" || role === "producao") {
    permissions.operacao = true;
    permissions.engenharia = true;
  }

  if (role === "estoque") {
    permissions.estoque = true;
  }

  if (role === "fiscal") {
    permissions.fiscal = true;
  }

  if (role === "entrega") {
    permissions.operacao = true;
  }

  return permissions;
}

export async function listCollaboratorModulePermissions(userIds: string[]) {
  const ctx = await getContextOrThrow();
  const supabaseAdmin = getSupabaseAdminClient();
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));

  const result = new Map<string, UserModulePermissionMap>();

  for (const userId of uniqueUserIds) {
    result.set(userId, emptyModulePermissionMap());
  }

  if (uniqueUserIds.length === 0) {
    return result;
  }

  const { data, error } = await supabaseAdmin
    .from("user_module_permissions")
    .select("user_id, module_key, can_access")
    .eq("establishment_id", ctx.establishment_id)
    .in("user_id", uniqueUserIds);

  if (error) {
    const code = String((error as any)?.code ?? "");
    if (code === "42P01" || code === "PGRST205" || code === "PGRST204") {
      console.warn("Tabela user_module_permissions ainda não existe no schema cache.");
      return result;
    }

    console.error("Erro ao listar permissões por módulo:", error);
    throw new Error("Erro ao listar permissões por módulo.");
  }

  for (const row of data ?? []) {
    const userId = String((row as any).user_id ?? "");
    const moduleKey = String((row as any).module_key ?? "") as AccessModuleKey;

    if (!ALL_MODULE_KEYS.includes(moduleKey)) continue;

    const current = result.get(userId) ?? emptyModulePermissionMap();
    current[moduleKey] = Boolean((row as UserModulePermission).can_access);
    result.set(userId, current);
  }

  return result;
}

export async function updateCollaboratorModulePermissions(formData: FormData) {
  const ctx = await getContextOrThrow();
  const supabaseAdmin = getSupabaseAdminClient();

  const userId = String(formData.get("user_id") ?? "").trim();
  const establishmentId = String(formData.get("establishment_id") ?? "").trim();

  if (!userId || !establishmentId) {
    throw new Error("Dados obrigatórios do usuário não informados.");
  }

  if (establishmentId !== ctx.establishment_id) {
    throw new Error("Estabelecimento inválido para alteração de permissões.");
  }

  await assertCollaboratorBelongsToActiveEstablishment({
    supabaseAdmin,
    establishmentId,
    userId,
  });

  const selectedModules = new Set(
    formData
      .getAll("modules")
      .map((value) => String(value))
      .filter((value): value is AccessModuleKey =>
        ALL_MODULE_KEYS.includes(value as AccessModuleKey)
      )
  );

  const rows = ACCESS_MODULES.map((module) => ({
    establishment_id: establishmentId,
    user_id: userId,
    module_key: module.key,
    can_access: selectedModules.has(module.key),
    updated_by: ctx.userId,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabaseAdmin
    .from("user_module_permissions")
    .upsert(rows, {
      onConflict: "establishment_id,user_id,module_key",
    });

  if (error) {
    console.error("Erro ao atualizar permissões por módulo:", error);
    throw new Error("Não foi possível atualizar as permissões do usuário.");
  }

  const { error: auditError } = await supabaseAdmin.from("user_access_audit_logs").insert({
    establishment_id: establishmentId,
    actor_user_id: ctx.userId,
    target_user_id: userId,
    action: "update_user",
    details: {
      access_modules: rows.reduce((acc, row) => {
        acc[row.module_key] = row.can_access;
        return acc;
      }, {} as Record<string, boolean>),
    },
  });

  if (auditError) {
    console.error("Permissões atualizadas, mas falhou ao gravar auditoria:", auditError);
  }

  revalidatePath("/dashboard/admin/usuarios");
}
