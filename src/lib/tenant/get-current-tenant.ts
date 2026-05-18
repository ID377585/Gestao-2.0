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

function mapMembership(
  row: any,
  fiscalProfilesByEstablishmentId: Map<string, any> = new Map()
): TenantMembership {
  const establishmentId = row.establishment_id ? String(row.establishment_id) : null;
  const fiscalProfile = establishmentId
    ? fiscalProfilesByEstablishmentId.get(establishmentId)
    : null;

  const displayName =
    normalizeDisplayName(fiscalProfile?.nome_fantasia) ??
    normalizeDisplayName(fiscalProfile?.razao_social);

  return {
    id: String(row.id),
    user_id: String(row.user_id),
    role: normalizeRole(row.role),
    org_id: row.org_id ? String(row.org_id) : null,
    unit_id: row.unit_id ? String(row.unit_id) : null,
    establishment_id: establishmentId,
    display_name: displayName,
    is_active: Boolean(row.is_active),
    created_at: String(row.created_at),
  };
}

const MEMBERSHIP_SELECT =
  "id,user_id,role,org_id,unit_id,establishment_id,is_active,created_at";

async function getFiscalProfilesByEstablishmentId(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  establishmentIds: string[]
) {
  const uniqueIds = Array.from(new Set(establishmentIds.filter(Boolean)));
  const profilesByEstablishmentId = new Map<string, any>();

  if (uniqueIds.length === 0) {
    return profilesByEstablishmentId;
  }

  const { data, error } = await supabase
    .from("fiscal_company_profiles")
    .select("establishment_id,nome_fantasia,razao_social")
    .in("establishment_id", uniqueIds);

  if (error) {
    console.error("[getFiscalProfilesByEstablishmentId] fiscal profiles error:", {
      message: error.message,
      code: error.code,
      establishment_ids: uniqueIds,
    });
    return profilesByEstablishmentId;
  }

  for (const profile of data ?? []) {
    if (profile?.establishment_id) {
      profilesByEstablishmentId.set(String(profile.establishment_id), profile);
    }
  }

  return profilesByEstablishmentId;
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
  const fiscalProfilesByEstablishmentId = await getFiscalProfilesByEstablishmentId(
    supabase,
    memberships.map((membership) => String(membership.establishment_id))
  );

  return memberships.map((membership) =>
    mapMembership(membership, fiscalProfilesByEstablishmentId)
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

  const fiscalProfilesByEstablishmentId = await getFiscalProfilesByEstablishmentId(
    supabase,
    [String(data.establishment_id)]
  );
  const membership = mapMembership(data, fiscalProfilesByEstablishmentId);

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
