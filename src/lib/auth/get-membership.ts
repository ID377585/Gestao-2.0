import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ensureCurrentTermsAcceptedOrRedirect } from "@/lib/auth/terms-compliance.server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TENANT_COOKIE_NAME } from "@/lib/tenant/constants";

export type Role =
  | "cliente"
  | "operacao"
  | "producao"
  | "estoque"
  | "fiscal"
  | "admin"
  | "entrega";

export type ActiveMembership = {
  id: string;
  user_id: string;
  role: Role;

  // compat com legado
  org_id: string | null;
  unit_id: string | null;

  establishment_id: string | null;

  is_active: boolean;
  created_at: string;
};

export type MembershipContext = {
  user: any;
  membership: ActiveMembership;
  role: Role;
  orgId: string | null;
  unitId: string | null;
  establishmentId: string | null;
};

type Options = {
  redirectToLogin?: string; // default: "/login"
  redirectToNoMembership?: string; // default: "/sem-acesso"
};

function mapMembership(membershipData: any): ActiveMembership {
  return {
    id: String(membershipData.id),
    user_id: String(membershipData.user_id),
    role: membershipData.role as Role,
    establishment_id: membershipData.establishment_id ?? null,
    is_active: Boolean(membershipData.is_active),
    created_at: String(membershipData.created_at),
    org_id: membershipData.org_id ?? null,
    unit_id: membershipData.unit_id ?? null,
  };
}

async function getSelectedEstablishmentId() {
  const cookieStore = await cookies();
  return cookieStore.get(TENANT_COOKIE_NAME)?.value ?? null;
}

function getUserAppMetadata(user: any) {
  return (user?.app_metadata ?? {}) as Record<string, unknown>;
}

/**
 * Fonte única: public.memberships.
 *
 * Em modo SaaS multiempresa, respeita o cookie de empresa ativa criado em
 * /api/tenant/switch. Se o usuário ainda não escolheu empresa, mantém o
 * comportamento anterior e usa a membership ativa mais recente.
 */
export async function getActiveMembershipOrRedirect(
  options?: Options,
): Promise<MembershipContext> {
  const redirectToLogin = options?.redirectToLogin ?? "/login";
  const redirectToNoMembership = options?.redirectToNoMembership ?? "/sem-acesso";

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    console.error("[getActiveMembershipOrRedirect] not authenticated:", {
      message: userErr?.message,
    });
    redirect(redirectToLogin);
  }

  await ensureCurrentTermsAcceptedOrRedirect({
    userId: user.id,
    redirectPath: "/dashboard/pedidos",
    loginPath: redirectToLogin,
    appMetadata: getUserAppMetadata(user),
  });

  const selectedEstablishmentId = await getSelectedEstablishmentId();

  let query = supabase
    .from("memberships")
    .select(
      "id, user_id, role, org_id, unit_id, establishment_id, is_active, created_at"
    )
    .eq("user_id", user.id)
    .eq("is_active", true);

  if (selectedEstablishmentId) {
    query = query.eq("establishment_id", selectedEstablishmentId);
  }

  const { data: membershipData, error: membershipErr } = await query
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (membershipErr || !membershipData) {
    console.error("[getActiveMembershipOrRedirect] no active membership:", {
      message: membershipErr?.message,
      selectedEstablishmentId,
    });
    redirect(redirectToNoMembership);
  }

  const membership = mapMembership(membershipData);

  return {
    user,
    membership,
    role: membership.role,
    orgId: membership.org_id,
    unitId: membership.unit_id,
    establishmentId: membership.establishment_id,
  };
}
