import "server-only";

import { cookies } from "next/headers";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TENANT_COOKIE_NAME } from "@/lib/tenant/constants";
import type {
  TenantContext,
  TenantMembership,
  TenantMembershipRole,
} from "@/lib/tenant/types";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

type AuthenticatedTenantUser = {
  id: string;
  email?: string | null;
};

type TenantNameData = {
  fiscalProfile?: {
    establishment_id?: string | null;
    nome_fantasia?: string | null;
    razao_social?: string | null;
  } | null;
};

const MEMBERSHIP_SELECT =
  "id,user_id,role,org_id,unit_id,establishment_id,is_active,created_at";

const ALLOWED_ROLES: TenantMembershipRole[] = [
  "cliente",
  "operacao",
  "producao",
  "estoque",
  "fiscal",
  "admin",
  "entrega",
];

function normalizeRole(value: unknown): TenantMembershipRole {
  const role = String(value ?? "cliente");

  return ALLOWED_ROLES.includes(role as TenantMembershipRole)
    ? (role as TenantMembershipRole)
    : "cliente";
}

function normalizeDisplayName(value: unknown) {
  const name = String(value ?? "").trim();
  return name || null;
}

function buildTenantDisplayName(data?: TenantNameData | null) {
  return (
    normalizeDisplayName(data?.fiscalProfile?.nome_fantasia) ??
    normalizeDisplayName(data?.fiscalProfile?.razao_social)
  );
}

function mapMembership(
  row: any,
  tenantNameDataByEstablishmentId: Map<string, TenantNameData> = new Map()
): TenantMembership {
  const establishmentId = row.establishment_id
    ? String(row.establishment_id)
    : null;

  const tenantNameData = establishmentId
    ? tenantNameDataByEstablishmentId.get(establishmentId)
    : null;

  const displayName = buildTenantDisplayName(tenantNameData);

  return {
    id: String(row.id),
    user_id: String(row.user_id),
    role: normalizeRole(row.role),
    org_id: row.org_id ? String(row.org_id) : null,
    unit_id: row.unit_id ? String(row.unit_id) : null,
    establishment_id: establishmentId,

    /*
     * Correção temporária e segura:
     * Não consultar public.establishments neste caminho crítico.
     *
     * Motivo:
     * A query em establishments está gerando:
     * - stack depth limit exceeded
     * - canceling statement due to statement timeout
     *
     * Isso indica RLS/policy recursiva ou pesada no Supabase.
     * Enquanto corrigimos a policy no banco, usamos o nome fiscal como fallback.
     */
    establishment_name: displayName,
    display_name: displayName,

    is_active: Boolean(row.is_active),
    created_at: String(row.created_at),
  };
}

async function getAuthenticatedUser(supabase: SupabaseServerClient) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

async function getTenantNameDataByEstablishmentId(
  supabase: SupabaseServerClient,
  establishmentIds: string[]
) {
  const uniqueIds = Array.from(
    new Set(establishmentIds.map(String).filter(Boolean))
  );

  const nameDataByEstablishmentId = new Map<string, TenantNameData>();

  if (uniqueIds.length === 0) {
    return nameDataByEstablishmentId;
  }

  /*
   * Importante:
   * Antes este helper fazia Promise.all com:
   * - fiscal_company_profiles
   * - establishments
   *
   * A consulta em establishments é a que está travando o dashboard.
   * Por isso, mantemos apenas fiscal_company_profiles por enquanto.
   */
  const { data, error } = await supabase
    .from("fiscal_company_profiles")
    .select("establishment_id,nome_fantasia,razao_social")
    .in("establishment_id", uniqueIds);

  if (error) {
    console.error("[getTenantNameDataByEstablishmentId] fiscal profiles error:", {
      message: error.message,
      code: error.code,
      establishment_ids: uniqueIds,
    });

    return nameDataByEstablishmentId;
  }

  for (const fiscalProfile of data ?? []) {
    if (!fiscalProfile?.establishment_id) {
      continue;
    }

    const establishmentId = String(fiscalProfile.establishment_id);

    nameDataByEstablishmentId.set(establishmentId, {
      ...(nameDataByEstablishmentId.get(establishmentId) ?? {}),
      fiscalProfile,
    });
  }

  return nameDataByEstablishmentId;
}

export async function listCurrentUserTenantsForUser(
  supabase: SupabaseServerClient,
  userId: string
): Promise<TenantMembership[]> {
  const { data, error } = await supabase
    .from("memberships")
    .select(MEMBERSHIP_SELECT)
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[listCurrentUserTenantsForUser] memberships error:", {
      message: error.message,
      code: error.code,
      user_id: userId,
    });

    return [];
  }

  const memberships = (data ?? []).filter((membership) =>
    Boolean(membership.establishment_id)
  );

  if (memberships.length === 0) {
    return [];
  }

  const tenantNameDataByEstablishmentId =
    await getTenantNameDataByEstablishmentId(
      supabase,
      memberships.map((membership) => String(membership.establishment_id))
    );

  return memberships.map((membership) =>
    mapMembership(membership, tenantNameDataByEstablishmentId)
  );
}

export async function listCurrentUserTenants(): Promise<TenantMembership[]> {
  const supabase = await createSupabaseServerClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return [];
  }

  return listCurrentUserTenantsForUser(supabase, user.id);
}

export async function getCurrentTenantForUser(
  supabase: SupabaseServerClient,
  user: AuthenticatedTenantUser
): Promise<TenantContext | null> {
  const cookieStore = await cookies();
  const selectedEstablishmentId =
    cookieStore.get(TENANT_COOKIE_NAME)?.value ?? null;

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
    console.error("[getCurrentTenantForUser] memberships error:", {
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

  const establishmentId = String(data.establishment_id);

  const tenantNameDataByEstablishmentId =
    await getTenantNameDataByEstablishmentId(supabase, [establishmentId]);

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

export async function getCurrentTenant(): Promise<TenantContext | null> {
  const supabase = await createSupabaseServerClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return null;
  }

  return getCurrentTenantForUser(supabase, {
    id: user.id,
    email: user.email ?? null,
  });
}