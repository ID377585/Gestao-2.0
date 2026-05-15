import "server-only";

import { redirect } from "next/navigation";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  ACCESS_MODULE_KEYS,
  type AccessModuleKey,
  type ModulePermissionMap,
  emptyModulePermissionMap,
  getDefaultModulesForRole,
} from "@/lib/auth/module-access-config";

type AllowedRole =
  | "admin"
  | "operacao"
  | "producao"
  | "estoque"
  | "fiscal"
  | "entrega";

export type ModuleAccessContext = {
  establishmentId: string;
  role: string;
  permissions: ModulePermissionMap;
};

const ALLOWED_ROLES: AllowedRole[] = [
  "admin",
  "operacao",
  "producao",
  "estoque",
  "fiscal",
  "entrega",
];

function canUseRole(role: string | null | undefined): role is AllowedRole {
  return ALLOWED_ROLES.includes(String(role ?? "") as AllowedRole);
}

async function getActiveMembershipForUser(userId: string) {
  const supabaseAdmin = getSupabaseAdminClient();

  const { data: establishmentMembership, error: establishmentError } =
    await supabaseAdmin
      .from("establishment_memberships")
      .select("establishment_id, role, is_active, created_at")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

  if (establishmentError) {
    console.error("Erro ao validar establishment_memberships:", establishmentError);
  }

  if (establishmentMembership?.role && establishmentMembership?.establishment_id) {
    return {
      establishmentId: String(establishmentMembership.establishment_id),
      role: String(establishmentMembership.role),
    };
  }

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from("memberships")
    .select("establishment_id, role, is_active, created_at")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    console.error("Erro ao validar memberships:", membershipError);
  }

  if (!membership?.role || !membership?.establishment_id) return null;

  return {
    establishmentId: String(membership.establishment_id),
    role: String(membership.role),
  };
}

export async function getModuleAccessContext(userId: string): Promise<ModuleAccessContext | null> {
  const membership = await getActiveMembershipForUser(userId);

  if (!membership || !canUseRole(membership.role)) return null;

  const roleDefaults = getDefaultModulesForRole(membership.role);

  if (membership.role === "admin") {
    return {
      establishmentId: membership.establishmentId,
      role: membership.role,
      permissions: roleDefaults,
    };
  }

  const permissions = emptyModulePermissionMap();
  const supabaseAdmin = getSupabaseAdminClient();

  const { data, error } = await supabaseAdmin
    .from("user_module_permissions")
    .select("module_key, can_access")
    .eq("establishment_id", membership.establishmentId)
    .eq("user_id", userId);

  if (error) {
    const code = String((error as any)?.code ?? "");

    if (code === "42P01" || code === "PGRST205" || code === "PGRST204") {
      console.warn(
        "Tabela user_module_permissions indisponível. Usando permissões padrão por role."
      );

      return {
        establishmentId: membership.establishmentId,
        role: membership.role,
        permissions: roleDefaults,
      };
    }

    console.error("Erro ao carregar permissões por módulo:", error);
    return null;
  }

  for (const row of data ?? []) {
    const moduleKey = String((row as any).module_key ?? "") as AccessModuleKey;
    if (!ACCESS_MODULE_KEYS.includes(moduleKey)) continue;
    permissions[moduleKey] = Boolean((row as any).can_access);
  }

  return {
    establishmentId: membership.establishmentId,
    role: membership.role,
    permissions,
  };
}

export async function requireModuleAccess(
  userId: string,
  moduleKey?: AccessModuleKey
) {
  const access = await getModuleAccessContext(userId);

  if (!access) {
    redirect("/sem-acesso");
  }

  if (moduleKey && access.role !== "admin" && !access.permissions[moduleKey]) {
    redirect("/sem-acesso");
  }

  return access;
}
