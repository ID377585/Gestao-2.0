"use server";

import { dispatchCollaboratorCreatedOrUpdatedAlert } from "@/lib/alerts/domain-triggers";
import { revalidatePath } from "next/cache";
import {
  createSupabaseServerClient,
  getSupabaseAdminClient,
} from "@/lib/supabase/server";

export type ProfileRole =
  | "admin"
  | "operacao"
  | "producao"
  | "estoque"
  | "fiscal"
  | "entrega";

export type Collaborator = {
  id: string;
  email: string;
  full_name: string;
  role: ProfileRole;
  sector: string | null;
  is_active: boolean;
  created_at?: string | null;
  last_sign_in_at?: string | null;
};

export type UserAuditAction =
  | "create_user"
  | "update_user"
  | "reset_password"
  | "deactivate_user"
  | "reactivate_user"
  | "delete_user";

export type UserAccessAuditLog = {
  id: string;
  action: UserAuditAction | string;
  created_at: string | null;
  actor_user_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  target_user_id: string | null;
  target_name: string | null;
  target_email: string | null;
  details: Record<string, any> | null;
};

function getSupabaseAdmin() {
  return getSupabaseAdminClient();
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
    throw new Error("Apenas admin ou operação podem gerenciar usuários.");
  }

  return {
    userId: user.id,
    establishment_id: String(membership.establishment_id),
    role: String(membership.role),
  };
}

function normalizeRole(value: string): ProfileRole {
  const allowed: ProfileRole[] = [
    "admin",
    "operacao",
    "producao",
    "estoque",
    "fiscal",
    "entrega",
  ];

  if (allowed.includes(value as ProfileRole)) {
    return value as ProfileRole;
  }

  return "producao";
}

async function getAuthUsersSnapshotMap(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>
) {
  const emailById = new Map<string, string>();
  const lastSignInById = new Map<string, string | null>();
  const perPage = 200;

  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      console.error("Erro ao listar usuários do Auth:", error);
      throw new Error("Erro ao listar usuários.");
    }

    const users = data?.users ?? [];

    for (const u of users) {
      if (u?.id) {
        emailById.set(String(u.id), u.email ?? "");
        lastSignInById.set(String(u.id), u.last_sign_in_at ?? null);
      }
    }

    if (users.length < perPage) break;
  }

  return {
    emailById,
    lastSignInById,
  };
}

async function findAuthUserByEmail(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  email: string
) {
  const normalizedEmail = email.trim().toLowerCase();
  const perPage = 200;

  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      console.error("Erro ao buscar usuário por email no Auth:", error);
      throw new Error("Erro ao validar e-mail do usuário.");
    }

    const users = data?.users ?? [];
    const found = users.find(
      (user) => String(user.email ?? "").trim().toLowerCase() === normalizedEmail
    );

    if (found) {
      return found;
    }

    if (users.length < perPage) break;
  }

  return null;
}

async function writeUserAuditLog(params: {
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  establishmentId: string;
  actorUserId: string | null;
  targetUserId: string | null;
  action: UserAuditAction;
  details?: Record<string, any> | null;
}) {
  try {
    const { error } = await params.supabaseAdmin.from("user_access_audit_logs").insert({
      establishment_id: params.establishmentId,
      actor_user_id: params.actorUserId,
      target_user_id: params.targetUserId,
      action: params.action,
      details: params.details ?? {},
    });

    if (error) {
      console.error("Erro ao gravar log de auditoria:", error);
    }
  } catch (error) {
    console.error("Falha inesperada ao gravar log de auditoria:", error);
  }
}

/**
 * PATCH CIRÚRGICO:
 * Mantém public.memberships sincronizada com establishment_memberships,
 * sem alterar o restante do fluxo já validado.
 */
async function upsertPrimaryMembership(params: {
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  establishmentId: string;
  userId: string;
  role: ProfileRole;
  is_active: boolean;
}) {
  const { error } = await params.supabaseAdmin
    .from("memberships")
    .upsert(
      {
        establishment_id: params.establishmentId,
        user_id: params.userId,
        role: params.role,
        is_active: params.is_active,
      },
      { onConflict: "establishment_id,user_id" }
    );

  if (error) {
    console.error("Erro ao sincronizar public.memberships:", error);
    throw new Error(
      "Acesso criado/atualizado parcialmente, mas falhou ao sincronizar a membership principal."
    );
  }
}

async function deletePrimaryMembership(params: {
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  establishmentId: string;
  userId: string;
}) {
  const { error } = await params.supabaseAdmin
    .from("memberships")
    .delete()
    .eq("establishment_id", params.establishmentId)
    .eq("user_id", params.userId);

  if (error) {
    console.error("Erro ao remover public.memberships:", error);
    throw new Error("Não foi possível remover o vínculo principal do usuário.");
  }
}

export async function listCollaborators(): Promise<Collaborator[]> {
  const ctx = await getContextOrThrow();
  const supabaseAdmin = getSupabaseAdmin();

  const { data: memberships, error: memErr } = await supabaseAdmin
    .from("establishment_memberships")
    .select("user_id, role, is_active, created_at")
    .eq("establishment_id", ctx.establishment_id)
    .order("created_at", { ascending: false });

  if (memErr) {
    console.error("Erro ao listar memberships:", memErr);
    throw new Error("Erro ao listar usuários.");
  }

  const uniqueMemberships = new Map<
    string,
    { user_id: string; role: string; is_active: boolean; created_at?: string | null }
  >();

  for (const item of memberships ?? []) {
    if (!uniqueMemberships.has(item.user_id)) {
      uniqueMemberships.set(item.user_id, {
        user_id: item.user_id,
        role: item.role,
        is_active: Boolean(item.is_active),
        created_at: item.created_at ?? null,
      });
    }
  }

  const userIds = Array.from(uniqueMemberships.keys());

  if (userIds.length === 0) {
    return [];
  }

  const { data: profiles, error: profilesErr } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, role, sector")
    .in("id", userIds);

  if (profilesErr) {
    console.error("Erro ao listar profiles:", profilesErr);
    throw new Error("Erro ao listar usuários.");
  }

  const profilesById = new Map<
    string,
    { id: string; full_name: string; role: string; sector: string | null }
  >(
    (profiles ?? []).map((p: any) => [
      String(p.id),
      {
        id: String(p.id),
        full_name: String(p.full_name ?? ""),
        role: String(p.role ?? "producao"),
        sector: p.sector ? String(p.sector) : null,
      },
    ])
  );

  const { emailById, lastSignInById } = await getAuthUsersSnapshotMap(supabaseAdmin);

  const result: Collaborator[] = userIds.map((userId) => {
    const membership = uniqueMemberships.get(userId);
    const profile = profilesById.get(userId);

    return {
      id: userId,
      email: emailById.get(userId) ?? "",
      full_name: profile?.full_name ?? "",
      role: normalizeRole(String(membership?.role ?? profile?.role ?? "producao")),
      sector: profile?.sector ?? null,
      is_active: Boolean(membership?.is_active ?? false),
      created_at: membership?.created_at ?? null,
      last_sign_in_at: lastSignInById.get(userId) ?? null,
    };
  });

  result.sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"));
  return result;
}

export async function listUserAccessAuditLogs(
  limit = 30
): Promise<UserAccessAuditLog[]> {
  const ctx = await getContextOrThrow();
  const supabaseAdmin = getSupabaseAdmin();

  try {
    const { data: logs, error } = await supabaseAdmin
      .from("user_access_audit_logs")
      .select(
        "id, actor_user_id, target_user_id, action, details, created_at, establishment_id"
      )
      .eq("establishment_id", ctx.establishment_id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      const errorCode = String((error as any)?.code ?? "");

      if (
        errorCode === "42P01" ||
        errorCode === "PGRST205" ||
        errorCode === "PGRST204"
      ) {
        console.warn(
          "Tabela de auditoria ainda não existe ou não está disponível no schema cache."
        );
        return [];
      }

      console.error("Erro ao listar logs de auditoria:", error);
      return [];
    }

    const userIds = Array.from(
      new Set(
        (logs ?? [])
          .flatMap((log: any) => [log.actor_user_id, log.target_user_id])
          .filter(Boolean)
          .map(String)
      )
    );

    const profilesById = new Map<
      string,
      { full_name: string; role: string; sector: string | null }
    >();

    if (userIds.length > 0) {
      const { data: profiles, error: profilesErr } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, role, sector")
        .in("id", userIds);

      if (profilesErr) {
        console.error("Erro ao buscar profiles dos logs:", profilesErr);
      } else {
        for (const p of profiles ?? []) {
          profilesById.set(String((p as any).id), {
            full_name: String((p as any).full_name ?? ""),
            role: String((p as any).role ?? ""),
            sector: (p as any).sector ? String((p as any).sector) : null,
          });
        }
      }
    }

    const { emailById } = await getAuthUsersSnapshotMap(supabaseAdmin);

    return (logs ?? []).map((log: any) => {
      const details = (log.details ?? {}) as Record<string, any>;
      const actorId = log.actor_user_id ? String(log.actor_user_id) : null;
      const targetId = log.target_user_id ? String(log.target_user_id) : null;

      return {
        id: String(log.id),
        action: String(log.action),
        created_at: log.created_at ? String(log.created_at) : null,
        actor_user_id: actorId,
        actor_name:
          details.actor_name ??
          (actorId ? profilesById.get(actorId)?.full_name ?? null : null),
        actor_email:
          details.actor_email ??
          (actorId ? emailById.get(actorId) ?? null : null),
        target_user_id: targetId,
        target_name:
          details.target_name ??
          (targetId ? profilesById.get(targetId)?.full_name ?? null : null),
        target_email:
          details.target_email ??
          (targetId ? emailById.get(targetId) ?? null : null),
        details,
      };
    });
  } catch (error) {
    console.error("Falha inesperada ao listar logs de auditoria:", error);
    return [];
  }
}

export async function createCollaborator(formData: FormData) {
  const ctx = await getContextOrThrow();
  const supabaseAdmin = getSupabaseAdmin();

  const full_name = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "").trim();
  const role = normalizeRole(String(formData.get("role") ?? "").trim());

  const sectorRaw = String(formData.get("sector") ?? "").trim();
  const sector = sectorRaw.length > 0 ? sectorRaw : null;

  if (!full_name || !email || !password || !role) {
    throw new Error("Preencha nome, e-mail, senha e papel.");
  }

  if (password.length < 6) {
    throw new Error("A senha inicial deve ter pelo menos 6 caracteres.");
  }

  const existingAuthUser = await findAuthUserByEmail(supabaseAdmin, email);

  let userId: string;

  if (existingAuthUser?.id) {
    userId = String(existingAuthUser.id);
  } else {
    const { data: userResp, error: userErr } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      });

    if (userErr || !userResp?.user) {
      console.error("Erro ao criar usuário no Auth:", userErr);
      throw new Error(userErr?.message ?? "Erro ao criar usuário.");
    }

    userId = userResp.user.id;
  }

  const { error: profileErr } = await supabaseAdmin.from("profiles").upsert(
    {
      id: userId,
      full_name,
      role,
      sector,
    },
    { onConflict: "id" }
  );

  if (profileErr) {
    console.error("Erro ao salvar profile:", profileErr);
    throw new Error("Usuário criado, mas falhou ao salvar o perfil.");
  }

  const { error: membershipErr } = await supabaseAdmin
    .from("establishment_memberships")
    .upsert(
      {
        establishment_id: ctx.establishment_id,
        user_id: userId,
        role,
        is_active: true,
      },
      { onConflict: "establishment_id,user_id" }
    );

  if (membershipErr) {
    console.error("Erro ao salvar membership:", membershipErr);
    throw new Error(
      "Usuário criado, mas falhou ao vincular ao estabelecimento."
    );
  }

  await upsertPrimaryMembership({
    supabaseAdmin,
    establishmentId: ctx.establishment_id,
    userId,
    role,
    is_active: true,
  });

  await writeUserAuditLog({
    supabaseAdmin,
    establishmentId: ctx.establishment_id,
    actorUserId: ctx.userId,
    targetUserId: userId,
    action: "create_user",
    details: {
      actor_user_id: ctx.userId,
      target_name: full_name,
      target_email: email,
      role,
      sector,
    },
  });

  await dispatchCollaboratorCreatedOrUpdatedAlert({
    establishmentId: ctx.establishment_id,
    actorUserId: ctx.userId,
    targetUserId: userId,
    targetName: full_name,
    targetEmail: email,
    role,
    sector,
    mode: "created",
  });

  revalidatePath("/dashboard/admin/usuarios");
}

export async function updateCollaborator(formData: FormData) {
  const ctx = await getContextOrThrow();
  const supabaseAdmin = getSupabaseAdmin();

  const userId = String(formData.get("user_id") ?? "").trim();
  const full_name = String(formData.get("full_name") ?? "").trim();
  const role = normalizeRole(String(formData.get("role") ?? "").trim());
  const sectorRaw = String(formData.get("sector") ?? "").trim();
  const sector = sectorRaw.length > 0 ? sectorRaw : null;
  const is_active = String(formData.get("is_active") ?? "").trim() === "true";
  const establishmentId = String(formData.get("establishment_id") ?? "").trim();

  if (!userId || !full_name || !role || !establishmentId) {
    throw new Error("Dados obrigatórios do usuário não informados.");
  }

  const { data: beforeProfile } = await supabaseAdmin
    .from("profiles")
    .select("full_name, role, sector")
    .eq("id", userId)
    .maybeSingle();

  const { data: beforeMembership } = await supabaseAdmin
    .from("establishment_memberships")
    .select("role, is_active")
    .eq("establishment_id", establishmentId)
    .eq("user_id", userId)
    .maybeSingle();

  if (ctx.userId === userId && !is_active) {
    throw new Error("Você não pode desativar seu próprio acesso.");
  }

  const { error: profileErr } = await supabaseAdmin
    .from("profiles")
    .update({
      full_name,
      role,
      sector,
    })
    .eq("id", userId);

  if (profileErr) {
    console.error("Erro ao atualizar profile:", profileErr);
    throw new Error("Não foi possível atualizar o perfil do usuário.");
  }

  const { error: membershipErr } = await supabaseAdmin
    .from("establishment_memberships")
    .update({
      role,
      is_active,
    })
    .eq("establishment_id", establishmentId)
    .eq("user_id", userId);

  if (membershipErr) {
    console.error("Erro ao atualizar membership:", membershipErr);
    throw new Error("Não foi possível atualizar o acesso do usuário.");
  }

  await upsertPrimaryMembership({
    supabaseAdmin,
    establishmentId,
    userId,
    role,
    is_active,
  });

  await writeUserAuditLog({
    supabaseAdmin,
    establishmentId,
    actorUserId: ctx.userId,
    targetUserId: userId,
    action: "update_user",
    details: {
      before: {
        full_name: beforeProfile?.full_name ?? null,
        role: beforeMembership?.role ?? beforeProfile?.role ?? null,
        sector: beforeProfile?.sector ?? null,
        is_active: beforeMembership?.is_active ?? null,
      },
      after: {
        full_name,
        role,
        sector,
        is_active,
      },
    },
  });

  const { emailById } = await getAuthUsersSnapshotMap(supabaseAdmin);
  const targetEmail = emailById.get(userId) ?? null;

  await dispatchCollaboratorCreatedOrUpdatedAlert({
    establishmentId,
    actorUserId: ctx.userId,
    targetUserId: userId,
    targetName: full_name,
    targetEmail,
    role,
    sector,
    mode: "updated",
  });

  revalidatePath("/dashboard/admin/usuarios");
}

export async function resetCollaboratorPassword(formData: FormData) {
  const ctx = await getContextOrThrow();
  const supabaseAdmin = getSupabaseAdmin();

  const userId = String(formData.get("user_id") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  if (!userId || !password) {
    throw new Error("Usuário e nova senha são obrigatórios.");
  }

  if (password.length < 6) {
    throw new Error("A nova senha deve ter pelo menos 6 caracteres.");
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password,
  });

  if (error) {
    console.error("Erro ao redefinir senha:", error);
    throw new Error(error.message ?? "Não foi possível redefinir a senha.");
  }

  await writeUserAuditLog({
    supabaseAdmin,
    establishmentId: ctx.establishment_id,
    actorUserId: ctx.userId,
    targetUserId: userId,
    action: "reset_password",
    details: {},
  });

  revalidatePath("/dashboard/admin/usuarios");
}

export async function toggleCollaboratorStatus(formData: FormData) {
  const ctx = await getContextOrThrow();
  const supabaseAdmin = getSupabaseAdmin();

  const userId = String(formData.get("user_id") ?? "").trim();
  const establishmentId = String(formData.get("establishment_id") ?? "").trim();
  const isActive = String(formData.get("is_active") ?? "").trim() === "true";

  if (!userId || !establishmentId) {
    throw new Error("Dados obrigatórios do usuário não informados.");
  }

  if (ctx.userId === userId && !isActive) {
    throw new Error("Você não pode desativar seu próprio acesso.");
  }

  const { data: currentProfile } = await supabaseAdmin
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();

  const { data: currentMembership, error: currentMembershipErr } = await supabaseAdmin
    .from("establishment_memberships")
    .select("role, is_active")
    .eq("establishment_id", establishmentId)
    .eq("user_id", userId)
    .maybeSingle();

  if (currentMembershipErr) {
    console.error("Erro ao buscar membership atual:", currentMembershipErr);
    throw new Error("Não foi possível consultar o acesso atual do usuário.");
  }

  const role = normalizeRole(String(currentMembership?.role ?? "producao"));

  const { error } = await supabaseAdmin
    .from("establishment_memberships")
    .update({
      is_active: isActive,
    })
    .eq("establishment_id", establishmentId)
    .eq("user_id", userId);

  if (error) {
    console.error("Erro ao alterar status do usuário:", error);
    throw new Error("Não foi possível alterar o status do usuário.");
  }

  await upsertPrimaryMembership({
    supabaseAdmin,
    establishmentId,
    userId,
    role,
    is_active: isActive,
  });

  await writeUserAuditLog({
    supabaseAdmin,
    establishmentId,
    actorUserId: ctx.userId,
    targetUserId: userId,
    action: isActive ? "reactivate_user" : "deactivate_user",
    details: {
      target_name: currentProfile?.full_name ?? null,
      is_active: isActive,
    },
  });

  revalidatePath("/dashboard/admin/usuarios");
}

export async function deleteCollaborator(formData: FormData) {
  const ctx = await getContextOrThrow();
  const supabaseAdmin = getSupabaseAdmin();

  const userId = String(formData.get("user_id") ?? "").trim();
  const establishmentId = String(formData.get("establishment_id") ?? "").trim();

  if (!userId || !establishmentId) {
    throw new Error("Dados obrigatórios do usuário não informados.");
  }

  if (ctx.userId === userId) {
    throw new Error("Você não pode excluir seu próprio usuário.");
  }

  const { data: targetProfile } = await supabaseAdmin
    .from("profiles")
    .select("full_name, role, sector")
    .eq("id", userId)
    .maybeSingle();

  const { emailById } = await getAuthUsersSnapshotMap(supabaseAdmin);
  const targetEmail = emailById.get(userId) ?? null;

  const { error: membershipDeleteErr } = await supabaseAdmin
    .from("establishment_memberships")
    .delete()
    .eq("establishment_id", establishmentId)
    .eq("user_id", userId);

  if (membershipDeleteErr) {
    console.error("Erro ao remover membership do usuário:", membershipDeleteErr);
    throw new Error("Não foi possível excluir o acesso do usuário.");
  }

  await deletePrimaryMembership({
    supabaseAdmin,
    establishmentId,
    userId,
  });

  const { count: remainingEstablishmentMemberships, error: countEstErr } =
    await supabaseAdmin
      .from("establishment_memberships")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

  if (countEstErr) {
    console.error(
      "Erro ao contar vínculos restantes em establishment_memberships:",
      countEstErr
    );
    throw new Error("Não foi possível concluir a exclusão do usuário.");
  }

  const { count: remainingPrimaryMemberships, error: countPrimaryErr } =
    await supabaseAdmin
      .from("memberships")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

  if (countPrimaryErr) {
    console.error(
      "Erro ao contar vínculos restantes em public.memberships:",
      countPrimaryErr
    );
    throw new Error("Não foi possível concluir a exclusão do usuário.");
  }

  const remainingMemberships = Math.max(
    remainingEstablishmentMemberships ?? 0,
    remainingPrimaryMemberships ?? 0
  );

  let authUserDeleted = false;

  if (remainingMemberships === 0) {
    const { error: profileDeleteErr } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", userId);

    if (profileDeleteErr) {
      console.error("Erro ao remover profile do usuário:", profileDeleteErr);
      throw new Error("Não foi possível remover o perfil do usuário.");
    }

    const { error: authDeleteErr } = await supabaseAdmin.auth.admin.deleteUser(
      userId,
      true
    );

    if (authDeleteErr) {
      console.error("Erro ao excluir usuário do Auth:", authDeleteErr);
      throw new Error(
        authDeleteErr.message ?? "Não foi possível excluir o usuário do Auth."
      );
    }

    authUserDeleted = true;
  }

  await writeUserAuditLog({
    supabaseAdmin,
    establishmentId,
    actorUserId: ctx.userId,
    targetUserId: userId,
    action: "delete_user",
    details: {
      target_name: targetProfile?.full_name ?? null,
      target_email: targetEmail,
      removed_from_establishment: true,
      auth_user_deleted: authUserDeleted,
      had_other_memberships: remainingMemberships > 0,
    },
  });

  revalidatePath("/dashboard/admin/usuarios");
}
