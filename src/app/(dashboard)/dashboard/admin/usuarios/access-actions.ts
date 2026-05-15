import "server-only";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProfileRole } from "./actions";

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

export type UserModulePermission = {
  module_key: AccessModuleKey;
  can_access: boolean;
};

export type UserModulePermissionMap = Record<AccessModuleKey, boolean>;

const ALL_MODULE_KEYS = ACCESS_MODULES.map((module) => module.key);

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "ENV ausente: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function getContextOrThrow() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Não autenticado.");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("establishment_memberships")
    .select("establishment_id, role, is_active, created_at")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    console.error("Erro ao buscar membership do usuário atual:", membershipError);
    throw new Error("Erro ao validar acesso do usuário atual.");
  }

  if (!membership) {
    throw new Error("Sem acesso ao estabelecimento.");
  }

  if (membership.role !== "admin" && membership.role !== "operacao") {
    throw new Error("Apenas admin ou operação podem gerenciar acessos.");
  }

  return {
    userId: user.id,
    establishment_id: String(membership.establishment_id),
    role: String(membership.role),
  };
}

function emptyPermissionMap(): UserModulePermissionMap {
  return ACCESS_MODULES.reduce((acc, module) => {
    acc[module.key] = false;
    return acc;
  }, {} as UserModulePermissionMap);
}

export function getDefaultModulesForRole(role: ProfileRole): UserModulePermissionMap {
  const permissions = emptyPermissionMap();

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
  const supabaseAdmin = getSupabaseAdmin();
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));

  const result = new Map<string, UserModulePermissionMap>();

  for (const userId of uniqueUserIds) {
    result.set(userId, emptyPermissionMap());
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

    const current = result.get(userId) ?? emptyPermissionMap();
    current[moduleKey] = Boolean((row as any).can_access);
    result.set(userId, current);
  }

  return result;
}

export async function updateCollaboratorModulePermissions(formData: FormData) {
  const ctx = await getContextOrThrow();
  const supabaseAdmin = getSupabaseAdmin();

  const userId = String(formData.get("user_id") ?? "").trim();
  const establishmentId = String(formData.get("establishment_id") ?? "").trim();

  if (!userId || !establishmentId) {
    throw new Error("Dados obrigatórios do usuário não informados.");
  }

  if (establishmentId !== ctx.establishment_id) {
    throw new Error("Estabelecimento inválido para alteração de permissões.");
  }

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

  await supabaseAdmin.from("user_access_audit_logs").insert({
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

  revalidatePath("/dashboard/admin/usuarios");
}
