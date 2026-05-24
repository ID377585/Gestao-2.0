"use server";

import { dispatchCollaboratorCreatedOrUpdatedAlert } from "@/lib/alerts/domain-triggers";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import {
  getSupabaseAdminClient,
} from "@/lib/supabase/server";
import { assertBillingLimitAvailable } from "@/lib/billing/limits";
import { assertActiveTenantRole } from "@/lib/tenant/guards";
import { writeTenantAuditLog } from "@/lib/tenant/audit";
import {
  createTenantInvitationInternalAction,
  type TenantInvitationRole,
} from "@/lib/tenant/invitations.server";

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

export type TenantInvitationSummary = {
  id: string;
  email: string;
  role: TenantInvitationRole;
  sector: string | null;
  status: string;
  invited_by: string | null;
  accepted_by: string | null;
  accepted_at: string | null;
  expires_at: string | null;
  created_at: string | null;
};

export type CreateTenantInvitationActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
  inviteUrl: string | null;
  email: string | null;
  expiresAt: string | null;
};

const INITIAL_TENANT_INVITATION_STATE: CreateTenantInvitationActionState = {
  status: "idle",
  message: null,
  inviteUrl: null,
  email: null,
  expiresAt: null,
};

function getSupabaseAdmin() {
  return getSupabaseAdminClient();
}

async function getContextOrThrow() {
  const tenant = await assertActiveTenantRole(["admin", "operacao"]);

  return {
    userId: tenant.userId,
    establishment_id: tenant.establishmentId,
    role: tenant.role,
  };
}

function assertSameEstablishment(
  establishmentId: string,
  ctx: { establishment_id: string }
) {
  if (establishmentId !== ctx.establishment_id) {
    throw new Error("Estabelecimento inválido para alteração de usuário.");
  }
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

function normalizeInvitationRole(value: FormDataEntryValue | null): TenantInvitationRole {
  return normalizeRole(String(value ?? "").trim()) as TenantInvitationRole;
}

function parseInviteExpiration(value: FormDataEntryValue | null) {
  const hours = Number(String(value ?? "").trim());
  if (!Number.isFinite(hours)) return 72;
  return Math.min(Math.max(Math.trunc(hours), 1), 24 * 30);
}

function isMissingTableError(error: any) {
  const code = String(error?.code ?? "");
  const message = String(error?.message ?? "").toLowerCase();

  return (
    code === "42P01" ||
    code === "PGRST205" ||
    code === "PGRST204" ||
    message.includes("schema cache")
  );
}

async function getAppOrigin() {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.APP_URL;

  if (configured) return configured.replace(/\/$/, "");

  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");

  if (!host) return "http://localhost:3000";

  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https");

  return `${protocol}://${host}`;
}

async function buildInviteUrl(token: string) {
  const url = new URL("/convite", await getAppOrigin());
  url.searchParams.set("token", token);
  return url.toString();
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

async function getCollaboratorMembershipOrThrow(params: {
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  establishmentId: string;
  userId: string;
}) {
  const { data, error } = await params.supabaseAdmin
    .from("establishment_memberships")
    .select("role, is_active")
    .eq("establishment_id", params.establishmentId)
    .eq("user_id", params.userId)
    .maybeSingle();

  if (error) {
    console.error("Erro ao validar vínculo do usuário alvo:", error);
    throw new Error("Não foi possível validar o vínculo do usuário.");
  }

  if (!data) {
    throw new Error("Usuário não pertence à empresa ativa.");
  }

  return data as { role: string | null; is_active: boolean | null };
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

export async function listTenantInvitations(
  limit = 12
): Promise<TenantInvitationSummary[]> {
  const ctx = await getContextOrThrow();
  const supabaseAdmin = getSupabaseAdmin();

  try {
    const { data, error } = await supabaseAdmin
      .from("tenant_invitations")
      .select(
        "id, email, role, sector, status, invited_by, accepted_by, accepted_at, expires_at, created_at"
      )
      .eq("establishment_id", ctx.establishment_id)
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 50));

    if (error) {
      if (isMissingTableError(error)) {
        console.warn("Tabela tenant_invitations ainda não disponível.");
        return [];
      }

      console.error("Erro ao listar convites multiempresa:", error);
      return [];
    }

    return (data ?? []).map((row: any) => ({
      id: String(row.id),
      email: String(row.email ?? ""),
      role: normalizeRole(String(row.role ?? "producao")) as TenantInvitationRole,
      sector: row.sector ? String(row.sector) : null,
      status: String(row.status ?? "pending"),
      invited_by: row.invited_by ? String(row.invited_by) : null,
      accepted_by: row.accepted_by ? String(row.accepted_by) : null,
      accepted_at: row.accepted_at ? String(row.accepted_at) : null,
      expires_at: row.expires_at ? String(row.expires_at) : null,
      created_at: row.created_at ? String(row.created_at) : null,
    }));
  } catch (error) {
    console.error("Falha inesperada ao listar convites multiempresa:", error);
    return [];
  }
}

export async function createTenantInvitationForAdminAction(
  _previousState: CreateTenantInvitationActionState,
  formData: FormData
): Promise<CreateTenantInvitationActionState> {
  const ctx = await getContextOrThrow();
  const supabaseAdmin = getSupabaseAdmin();

  const email = String(formData.get("invite_email") ?? "").trim().toLowerCase();
  const role = normalizeInvitationRole(formData.get("invite_role"));
  const sectorRaw = String(formData.get("invite_sector") ?? "").trim();
  const sector = sectorRaw.length > 0 ? sectorRaw : null;
  const expiresInHours = parseInviteExpiration(formData.get("invite_expires_hours"));

  if (!email || !email.includes("@")) {
    return {
      ...INITIAL_TENANT_INVITATION_STATE,
      status: "error",
      message: "Informe um e-mail válido para o convite.",
      email,
    };
  }

  if (ctx.role !== "admin" && role === "admin") {
    return {
      ...INITIAL_TENANT_INVITATION_STATE,
      status: "error",
      message: "Apenas administradores podem convidar outro administrador.",
      email,
    };
  }

  try {
    await assertBillingLimitAvailable({
      supabaseAdmin,
      establishmentId: ctx.establishment_id,
      kind: "users",
    });

    const result = await createTenantInvitationInternalAction({
      email,
      role,
      sector,
      expiresInHours,
    });

    if (!result.ok) {
      return {
        ...INITIAL_TENANT_INVITATION_STATE,
        status: "error",
        message: "Convites ainda não estão habilitados neste ambiente.",
        email,
      };
    }

    const inviteUrl = await buildInviteUrl(result.token);
    const expiresAt = String((result.invitation as any)?.expires_at ?? "");

    revalidatePath("/dashboard/admin/usuarios");

    return {
      status: "success",
      message: "Convite criado. Envie o link para o usuário convidado.",
      inviteUrl,
      email,
      expiresAt: expiresAt || null,
    };
  } catch (error: any) {
    console.error("Erro ao criar convite pela tela de usuários:", error);

    return {
      ...INITIAL_TENANT_INVITATION_STATE,
      status: "error",
      message: error?.message ?? "Não foi possível criar o convite.",
      email,
    };
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

  await assertBillingLimitAvailable({
    supabaseAdmin,
    establishmentId: ctx.establishment_id,
    kind: "users",
  });

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

  await writeTenantAuditLog({
    supabaseAdmin,
    establishmentId: ctx.establishment_id,
    actorUserId: ctx.userId,
    targetUserId: userId,
    action: "create_membership",
    entityType: "membership",
    entityId: `${ctx.establishment_id}:${userId}`,
    details: {
      source: "admin_users_page",
      email,
      role,
      sector,
      existing_auth_user: Boolean(existingAuthUser?.id),
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

  assertSameEstablishment(establishmentId, ctx);

  const { data: beforeProfile } = await supabaseAdmin
    .from("profiles")
    .select("full_name, role, sector")
    .eq("id", userId)
    .maybeSingle();

  const beforeMembership = await getCollaboratorMembershipOrThrow({
    supabaseAdmin,
    establishmentId,
    userId,
  });

  if (ctx.userId === userId && !is_active) {
    throw new Error("Você não pode desativar seu próprio acesso.");
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

  await getCollaboratorMembershipOrThrow({
    supabaseAdmin,
    establishmentId: ctx.establishment_id,
    userId,
  });

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

  assertSameEstablishment(establishmentId, ctx);

  if (ctx.userId === userId && !isActive) {
    throw new Error("Você não pode desativar seu próprio acesso.");
  }

  const { data: currentProfile } = await supabaseAdmin
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();

  const currentMembership = await getCollaboratorMembershipOrThrow({
    supabaseAdmin,
    establishmentId,
    userId,
  });

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

  assertSameEstablishment(establishmentId, ctx);

  if (ctx.userId === userId) {
    throw new Error("Você não pode excluir seu próprio usuário.");
  }

  await getCollaboratorMembershipOrThrow({
    supabaseAdmin,
    establishmentId,
    userId,
  });

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
