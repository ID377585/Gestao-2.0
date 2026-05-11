import "server-only";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TENANT_COOKIE_NAME } from "@/lib/tenant/constants";
import type { TenantContext, TenantMembership, TenantMembershipRole } from "@/lib/tenant/types";

function normalizeRole(value: unknown): TenantMembershipRole {
  const role = String(value ?? "cliente");
  const allowed: TenantMembershipRole[] = [
    "cliente",
    "operacao",
    "producao",
    "estoque",
    "fiscal",
    "admin",
    "entrega",
  ];

  return allowed.includes(role as TenantMembershipRole)
    ? (role as TenantMembershipRole)
    : "cliente";
}

function normalizeDisplayName(value: unknown) {
  const name = String(value ?? "").trim();
  return name || null;
}

function mapMembership(row: any): TenantMembership {
  const fiscalProfile = Array.isArray(row.fiscal_company_profiles)
    ? row.fiscal_company_profiles[0]
    : row.fiscal_company_profiles;

  const displayName =
    normalizeDisplayName(fiscalProfile?.nome_fantasia) ??
    normalizeDisplayName(fiscalProfile?.razao_social);

  return {
    id: String(row.id),
    user_id: String(row.user_id),
    role: normalizeRole(row.role),
    org_id: row.org_id ? String(row.org_id) : null,
    unit_id: row.unit_id ? String(row.unit_id) : null,
    establishment_id: row.establishment_id ? String(row.establishment_id) : null,
    display_name: displayName,
    is_active: Boolean(row.is_active),
    created_at: String(row.created_at),
  };
}

const MEMBERSHIP_SELECT = `
  id,
  user_id,
  role,
  org_id,
  unit_id,
  establishment_id,
  is_active,
  created_at,
  fiscal_company_profiles:establishment_id(nome_fantasia,razao_social)
`;

export async function listCurrentUserTenants(): Promise<TenantMembership[]> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return [];
  }

  const { data, error } = await supabase
    .from("memberships")
    .select(MEMBERSHIP_SELECT)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[listCurrentUserTenants] memberships error:", {
      message: error.message,
      code: error.code,
      user_id: user.id,
    });
    return [];
  }

  return (data ?? []).map(mapMembership).filter((membership) => Boolean(membership.establishment_id));
}

export async function getCurrentTenant(): Promise<TenantContext | null> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const selectedEstablishmentId = cookies().get(TENANT_COOKIE_NAME)?.value ?? null;

  let query = supabase
    .from("memberships")
    .select(MEMBERSHIP_SELECT)
    .eq("user_id", user.id)
    .eq("is_active", true);

  if (selectedEstablishmentId) {
    query = query.eq("establishment_id", selectedEstablishmentId);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[getCurrentTenant] memberships error:", {
      message: error.message,
      code: error.code,
      user_id: user.id,
      selected_establishment_id: selectedEstablishmentId,
    });
    return null;
  }

  if (!data) {
    return null;
  }

  const membership = mapMembership(data);

  if (!membership.establishment_id) {
    return null;
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    membership,
    role: membership.role,
    orgId: membership.org_id,
    unitId: membership.unit_id,
    establishmentId: membership.establishment_id,
    displayName: membership.display_name ?? null,
  };
}
