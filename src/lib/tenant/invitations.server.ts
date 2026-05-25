"use server";

import { randomBytes, createHash } from "crypto";
import { cookies } from "next/headers";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { assertBillingLimitAvailable } from "@/lib/billing/limits";
import { getCurrentTenant } from "@/lib/tenant/get-current-tenant";
import {
  TENANT_COOKIE_MAX_AGE_SECONDS,
  TENANT_COOKIE_NAME,
} from "@/lib/tenant/constants";
import { writeTenantAuditLog } from "@/lib/tenant/audit";
import { upsertDefaultModulePermissions } from "@/lib/tenant/module-permissions";
import type { TenantMembershipRole } from "@/lib/tenant/types";

export type TenantInvitationRole = Extract<
  TenantMembershipRole,
  "admin" | "operacao" | "producao" | "estoque" | "fiscal" | "entrega"
>;

export type TenantInvitationListItem = {
  id: string;
  email: string;
  role: TenantInvitationRole;
  sector: string | null;
  status: string;
  expires_at: string | null;
  created_at: string | null;
  accepted_at: string | null;
};

export type CreateTenantInvitationInput = {
  email: string;
  role: TenantInvitationRole;
  sector?: string | null;
  expiresInHours?: number;
};

function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeRole(value: unknown): TenantInvitationRole {
  const role = String(value ?? "").trim();
  const allowed: TenantInvitationRole[] = [
    "admin",
    "operacao",
    "producao",
    "estoque",
    "fiscal",
    "entrega",
  ];

  return allowed.includes(role as TenantInvitationRole)
    ? (role as TenantInvitationRole)
    : "producao";
}

function createInvitationToken() {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  return { token, tokenHash };
}

function getExpirationDate(expiresInHours?: number) {
  const hours = Math.min(Math.max(Number(expiresInHours ?? 72), 1), 24 * 30);
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function isMissingInvitationsTable(error: any) {
  const code = String(error?.code ?? "");
  const message = String(error?.message ?? "").toLowerCase();

  return (
    code === "42P01" ||
    code === "PGRST205" ||
    code === "PGRST204" ||
    message.includes("tenant_invitations") ||
    message.includes("schema cache")
  );
}

async function getTenantForInvitationAdmin() {
  const tenant = await getCurrentTenant();

  if (!tenant?.establishmentId) {
    throw new Error("Nenhuma empresa ativa encontrada.");
  }

  if (tenant.role !== "admin" && tenant.role !== "operacao") {
    throw new Error("Você não tem permissão para gerenciar convites.");
  }

  return tenant;
}

async function setActiveTenantCookie(establishmentId: string) {
  const cookieStore = await cookies();
  cookieStore.set(TENANT_COOKIE_NAME, establishmentId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TENANT_COOKIE_MAX_AGE_SECONDS,
  });
}

export async function listTenantInvitationsInternalAction(): Promise<
  TenantInvitationListItem[]
> {
  const tenant = await getTenantForInvitationAdmin();
  const supabaseAdmin = getSupabaseAdminClient();

  const { data, error } = await supabaseAdmin
    .from("tenant_invitations")
    .select("id,email,role,sector,status,expires_at,created_at,accepted_at")
    .eq("establishment_id", tenant.establishmentId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    if (isMissingInvitationsTable(error)) {
      return [];
    }

    console.error("Erro ao listar convites multiempresa:", error);
    return [];
  }

  return (data ?? []).map((item: any) => ({
    id: String(item.id),
    email: String(item.email ?? ""),
    role: normalizeRole(item.role),
    sector: item.sector ? String(item.sector) : null,
    status: String(item.status ?? "pending"),
    expires_at: item.expires_at ? String(item.expires_at) : null,
    created_at: item.created_at ? String(item.created_at) : null,
    accepted_at: item.accepted_at ? String(item.accepted_at) : null,
  }));
}

export async function createTenantInvitationInternalAction(
  input: CreateTenantInvitationInput
) {
  const tenant = await getTenantForInvitationAdmin();

  const email = normalizeEmail(input.email);
  const role = normalizeRole(input.role);
  const sector = String(input.sector ?? "").trim() || null;

  if (!email || !email.includes("@")) {
    throw new Error("Informe um e-mail válido para o convite.");
  }

  if (tenant.role !== "admin" && role === "admin") {
    throw new Error("Apenas administradores podem convidar outro administrador.");
  }

  const supabaseAdmin = getSupabaseAdminClient();

  await assertBillingLimitAvailable({
    supabaseAdmin,
    establishmentId: tenant.establishmentId,
    kind: "users",
  });

  const { token, tokenHash } = createInvitationToken();
  const expiresAt = getExpirationDate(input.expiresInHours);

  const invitationPayload = {
    establishment_id: tenant.establishmentId,
    email,
    role,
    sector,
    token_hash: tokenHash,
    status: "pending",
    invited_by: tenant.userId,
    expires_at: expiresAt,
  };

  const { data, error } = await supabaseAdmin
    .from("tenant_invitations")
    .insert(invitationPayload)
    .select("id, establishment_id, email, role, sector, status, expires_at, created_at")
    .single();

  if (error) {
    if (isMissingInvitationsTable(error)) {
      console.warn(
        "Tabela tenant_invitations ainda não existe; criação de convite ignorada."
      );
      return {
        ok: false as const,
        skipped: true as const,
        reason: "missing_table" as const,
      };
    }

    console.error("Erro ao criar convite multiempresa:", error);
    throw new Error("Não foi possível criar o convite.");
  }

  await writeTenantAuditLog({
    supabaseAdmin,
    establishmentId: tenant.establishmentId,
    actorUserId: tenant.userId,
    action: "create_tenant_invitation",
    entityType: "tenant_invitation",
    entityId: String((data as any).id),
    details: {
      email,
      role,
      sector,
      expires_at: expiresAt,
    },
  });

  return {
    ok: true as const,
    invitation: data,
    token,
  };
}

export async function cancelTenantInvitationInternalAction(invitationId: string) {
  const tenant = await getTenantForInvitationAdmin();
  const id = String(invitationId ?? "").trim();

  if (!id) {
    throw new Error("Convite inválido.");
  }

  const supabaseAdmin = getSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("tenant_invitations")
    .update({
      status: "canceled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("establishment_id", tenant.establishmentId)
    .eq("status", "pending")
    .select("id,email,role")
    .maybeSingle();

  if (error) {
    if (isMissingInvitationsTable(error)) {
      throw new Error("Convites ainda não estão habilitados neste ambiente.");
    }

    console.error("Erro ao cancelar convite multiempresa:", error);
    throw new Error("Não foi possível cancelar o convite.");
  }

  if (!data?.id) {
    throw new Error("Convite não encontrado, já utilizado ou já cancelado.");
  }

  await writeTenantAuditLog({
    supabaseAdmin,
    establishmentId: tenant.establishmentId,
    actorUserId: tenant.userId,
    action: "cancel_tenant_invitation",
    entityType: "tenant_invitation",
    entityId: String(data.id),
    details: {
      email: (data as any).email,
      role: (data as any).role,
    },
  });

  return { ok: true as const };
}

export async function acceptTenantInvitationInternalAction(params: {
  token: string;
  userId: string;
  userEmail?: string | null;
}) {
  const token = String(params.token ?? "").trim();
  const userId = String(params.userId ?? "").trim();
  const userEmail = normalizeEmail(params.userEmail ?? "");

  if (!token || !userId) {
    throw new Error("Convite inválido.");
  }

  const supabaseAdmin = getSupabaseAdminClient();
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const { data: invitation, error } = await supabaseAdmin
    .from("tenant_invitations")
    .select("id, establishment_id, email, role, sector, status, expires_at")
    .eq("token_hash", tokenHash)
    .eq("status", "pending")
    .maybeSingle();

  if (error) {
    if (isMissingInvitationsTable(error)) {
      throw new Error("Convites ainda não estão habilitados neste ambiente.");
    }

    console.error("Erro ao buscar convite multiempresa:", error);
    throw new Error("Não foi possível validar o convite.");
  }

  if (!invitation) {
    throw new Error("Convite não encontrado ou já utilizado.");
  }

  const invitedEmail = normalizeEmail((invitation as any).email);

  if (invitedEmail && invitedEmail !== userEmail) {
    throw new Error(
      `Este convite foi emitido para ${invitedEmail}. Entre com essa conta para aceitar.`
    );
  }

  if (new Date(String((invitation as any).expires_at)).getTime() < Date.now()) {
    throw new Error("Convite expirado.");
  }

  const establishmentId = String((invitation as any).establishment_id);
  const role = normalizeRole((invitation as any).role);

  const { data: existingMembership, error: existingMembershipError } =
    await supabaseAdmin
      .from("memberships")
      .select("is_active")
      .eq("establishment_id", establishmentId)
      .eq("user_id", userId)
      .maybeSingle();

  if (existingMembershipError) {
    console.error(
      "Erro ao validar vínculo existente do convite:",
      existingMembershipError
    );
    throw new Error("Não foi possível validar o vínculo do usuário com a empresa.");
  }

  if (!Boolean((existingMembership as any)?.is_active)) {
    await assertBillingLimitAvailable({
      supabaseAdmin,
      establishmentId,
      kind: "users",
    });
  }

  const membershipPayload = {
    establishment_id: establishmentId,
    user_id: userId,
    role,
    is_active: true,
  };

  const { error: membershipsError } = await supabaseAdmin
    .from("memberships")
    .upsert(membershipPayload, {
      onConflict: "establishment_id,user_id",
    });

  if (membershipsError) {
    console.error("Erro ao aceitar convite em memberships:", membershipsError);
    throw new Error("Não foi possível vincular o usuário à empresa.");
  }

  const { error: legacyMembershipError } = await supabaseAdmin
    .from("establishment_memberships")
    .upsert(membershipPayload, {
      onConflict: "establishment_id,user_id",
    });

  if (legacyMembershipError && !isMissingInvitationsTable(legacyMembershipError)) {
    console.error(
      "Erro ao aceitar convite em establishment_memberships:",
      legacyMembershipError
    );
  }

  await upsertDefaultModulePermissions({
    supabaseAdmin,
    establishmentId,
    userId,
    role,
    updatedBy: userId,
  });

  const { error: updateInvitationError } = await supabaseAdmin
    .from("tenant_invitations")
    .update({
      status: "accepted",
      accepted_by: userId,
      accepted_at: new Date().toISOString(),
    })
    .eq("id", (invitation as any).id)
    .eq("establishment_id", establishmentId)
    .eq("status", "pending");

  if (updateInvitationError) {
    console.error("Erro ao marcar convite como aceito:", updateInvitationError);
  }

  await writeTenantAuditLog({
    supabaseAdmin,
    establishmentId,
    actorUserId: userId,
    targetUserId: userId,
    action: "accept_tenant_invitation",
    entityType: "tenant_invitation",
    entityId: String((invitation as any).id),
    details: {
      role,
      email: (invitation as any).email,
    },
  });

  await setActiveTenantCookie(establishmentId);

  return {
    ok: true as const,
    establishmentId,
    role,
  };
}
