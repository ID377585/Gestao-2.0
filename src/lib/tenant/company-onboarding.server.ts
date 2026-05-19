"use server";

import { cookies } from "next/headers";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { TENANT_COOKIE_MAX_AGE_SECONDS, TENANT_COOKIE_NAME } from "@/lib/tenant/constants";
import { upsertDefaultModulePermissions } from "@/lib/tenant/module-permissions";
import { writeTenantAuditLog } from "@/lib/tenant/audit";
import type { TenantMembershipRole } from "@/lib/tenant/types";

export type CreateCompanyInternalInput = {
  name: string;
  adminUserId: string;
  adminRole?: Extract<TenantMembershipRole, "admin" | "operacao">;
  planSlug?: "starter" | "growth" | "enterprise";
  selectAsActive?: boolean;
  actorUserId?: string | null;
};

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function createCompanyInternalAction(input: CreateCompanyInternalInput) {
  const supabaseAdmin = getSupabaseAdminClient();

  const name = normalizeText(input.name);
  const adminUserId = normalizeText(input.adminUserId);
  const actorUserId = normalizeText(input.actorUserId) || adminUserId;
  const adminRole = input.adminRole === "operacao" ? "operacao" : "admin";
  const planSlug = input.planSlug ?? "starter";

  if (!name) {
    throw new Error("Informe o nome da empresa.");
  }

  if (!adminUserId || !isUuidLike(adminUserId)) {
    throw new Error("Informe um usuário administrador válido.");
  }

  const { data: establishment, error: establishmentError } = await supabaseAdmin
    .from("establishments")
    .insert({ name })
    .select("id, name")
    .single();

  if (establishmentError || !establishment?.id) {
    console.error("Erro ao criar empresa:", establishmentError);
    throw new Error("Não foi possível criar a empresa.");
  }

  const establishmentId = String(establishment.id);

  try {
    const { error: subscriptionError } = await supabaseAdmin
      .from("company_subscriptions")
      .insert({
        establishment_id: establishmentId,
        plan_slug: planSlug,
        status: "trialing",
      });

    if (subscriptionError) {
      const code = String((subscriptionError as any)?.code ?? "");
      if (code !== "42P01" && code !== "PGRST205" && code !== "PGRST204") {
        throw subscriptionError;
      }
    }

    const membershipPayload = {
      establishment_id: establishmentId,
      user_id: adminUserId,
      role: adminRole,
      is_active: true,
    };

    const { error: membershipsError } = await supabaseAdmin
      .from("memberships")
      .upsert(membershipPayload, {
        onConflict: "establishment_id,user_id",
      });

    if (membershipsError) {
      throw membershipsError;
    }

    const { error: legacyMembershipError } = await supabaseAdmin
      .from("establishment_memberships")
      .upsert(membershipPayload, {
        onConflict: "establishment_id,user_id",
      });

    if (legacyMembershipError) {
      const code = String((legacyMembershipError as any)?.code ?? "");
      if (code !== "42P01" && code !== "PGRST205" && code !== "PGRST204") {
        throw legacyMembershipError;
      }
    }

    await upsertDefaultModulePermissions({
      supabaseAdmin,
      establishmentId,
      userId: adminUserId,
      role: adminRole,
      updatedBy: actorUserId,
    });

    await writeTenantAuditLog({
      supabaseAdmin,
      establishmentId,
      actorUserId,
      targetUserId: adminUserId,
      action: "create_company_internal",
      entityType: "establishment",
      entityId: establishmentId,
      details: {
        name,
        admin_role: adminRole,
        plan_slug: planSlug,
        source: "internal_action",
      },
    });

    if (input.selectAsActive) {
      const cookieStore = await cookies();
      cookieStore.set(TENANT_COOKIE_NAME, establishmentId, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: TENANT_COOKIE_MAX_AGE_SECONDS,
      });
    }

    return {
      ok: true as const,
      establishmentId,
      name: String(establishment.name ?? name),
      adminUserId,
      adminRole,
      planSlug,
    };
  } catch (error) {
    console.error("Erro no onboarding interno da empresa; tentando rollback:", error);

    await supabaseAdmin
      .from("establishments")
      .delete()
      .eq("id", establishmentId);

    throw new Error("Não foi possível concluir o onboarding interno da empresa.");
  }
}
