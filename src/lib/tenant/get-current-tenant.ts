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

type TenantNameData = {
  fiscalProfile?: any | null;
  establishment?: any | null;
};

function buildTenantDisplayName(data?: TenantNameData | null) {
  return (
    normalizeDisplayName(data?.fiscalProfile?.nome_fantasia) ??
    normalizeDisplayName(data?.fiscalProfile?.razao_social) ??
    normalizeDisplayName(data?.establishment?.name)
  );
}

function mapMembership(
  row: any,
  tenantNameDataByEstablishmentId: Map<string, TenantNameData> = new Map()
): TenantMembership {
  const establishmentId = row.establishment_id ? String(row.establishment_id) : null;
  const tenantNameData = establishmentId
    ? tenantNameDataByEstablishmentId.get(establishmentId)
    : null;
  const establishmentName = normalizeDisplayName(tenantNameData?.establishment?.name);
  const displayName = buildTenantDisplayName(tenantNameData);

  return {
    id: String(row.id),
    user_id: String(row.user_id),
    role: normalizeRole(row.role),
    org_id: row.org_id ? String(row.org_id) : null,
    unit_id: row.unit_id ? String(row.unit_id) : null,
    establishment_id: establishmentId,
    establishment_name: establishmentName,
    display_name: displayName,
    is_active: Boolean(row.is_active),
    created_at: String(row.created_at),
  };
}

const MEMBERSHIP_SELECT =
  "id,user_id,role,org_id,unit_id,establishment_id,is_active,created_at";

async function getTenantNameDataByEstablishmentId(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  establishmentIds: string[]
) {
  const uniqueIds = Array.from(new Set(establishmentIds.filter(Boolean)));
  const nameDataByEstablishmentId = new Map<string, TenantNameData>();

  if (uniqueIds.length === 0) {
    return nameDataByEstablishmentId;
  }

  const [fiscalProfilesResult, establishmentsResult] = await Promise.all([
    supabase
      .from("fiscal_company_profiles")
      .select("establishment_id,nome_fantasia,razao_social")
      .in("establishment_id", uniqueIds),
    supabase
      .from("establishments")
      .select("id,name")
      .in("id", uniqueIds),
  ]);

  if (fiscalProfilesResult.error) {
    console.error("[getTenantNameDataByEstablishmentId] fiscal profiles error:", {
      message: fiscalProfilesResult.error.message,
      code: fiscalProfilesResult.error.code,
      establishment_ids: uniqueIds,
    });
  }

  if (establishmentsResult.error) {
    console.error("[getTenantNameDataByEstablishmentId] establishments error:", {
      message: establishmentsResult.error.message,
      code: establishmentsResult.error.code,
      establishment_ids: uniqueIds,
    });
  }

  for (const establishment of establishmentsResult.data ?? []) {
    if (establishment?.id) {
      nameDataByEstablishmentId.set(String(establishment.id), {
        ...(nameDataByEstablishmentId.get(String(establishment.id)) ?? {}),
        establishment,
      });
    }
  }

  for (const fiscalProfile of fiscalProfilesResult.data ?? []) {
    if (fiscalProfile?.establishment_id) {
      nameDataByEstablishmentId.set(String(fiscalProfile.establishment_id), {
        ...(nameDataByEstablishmentId.get(String(fiscalProfile.establishment_id)) ?? {}),
        fiscalProfile,
      });
    }
  }

  return nameDataByEstablishmentId;
}

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

  const memberships = (data ?? []).filter((membership) => Boolean(membership.establishment_id));
  const tenantNameDataByEstablishmentId = await getTenantNameDataByEstablishmentId(
    supabase,
    memberships.map((membership) => String(membership.establishment_id))
  );

  return memberships.map((membership) =>
    mapMembership(membership, tenantNameDataByEstablishmentId)
  );
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

  const cookieStore = await cookies();
  const selectedEstablishmentId = cookieStore.get(TENANT_COOKIE_NAME)?.value ?? null;

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

  if (!data?.establishment_id) {
    return null;
  }

  const tenantNameDataByEstablishmentId = await getTenantNameDataByEstablishmentId(
    supabase,
    [String(data.establishment_id)]
  );
  const membership = mapMembership(data, tenantNameDataByEstablishmentId);

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
    establishmentName: membership.establishment_name ?? null,
    displayName: membership.display_name ?? null,
  };
}
