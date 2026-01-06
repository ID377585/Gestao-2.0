import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

/**
 * ✅ Fonte ÚNICA: public.memberships
 * Motivo: public.establishment_memberships está com RLS em recursão (42P17)
 */
export async function getActiveMembershipOrRedirect(
  options?: Options,
): Promise<MembershipContext> {
  const redirectToLogin = options?.redirectToLogin ?? "/login";
  const redirectToNoMembership = options?.redirectToNoMembership ?? "/sem-acesso";

  const supabase = await createSupabaseServerClient();

  // 1) auth obrigatório
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

  // 2) membership (FONTE ÚNICA)
  const { data: membershipData, error: membershipErr } = await supabase
    .from("memberships")
    .select("id,user_id,role,org_id,unit_id,establishment_id,is_active,created_at")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (membershipErr) {
    console.error("[getActiveMembershipOrRedirect] memberships error:", {
      message: membershipErr.message,
      details: membershipErr.details,
      hint: membershipErr.hint,
      code: membershipErr.code,
      user_id: user.id,
      email: user.email,
    });
    redirect(redirectToNoMembership);
  }

  if (!membershipData) {
    console.error("[getActiveMembershipOrRedirect] no active membership found:", {
      user_id: user.id,
      email: user.email,
    });
    redirect(redirectToNoMembership);
  }

  const membership: ActiveMembership = {
    id: String((membershipData as any).id),
    user_id: String((membershipData as any).user_id),
    role: (membershipData as any).role as Role,
    establishment_id: (membershipData as any).establishment_id ?? null,
    is_active: Boolean((membershipData as any).is_active),
    created_at: String((membershipData as any).created_at),
    org_id: (membershipData as any).org_id ?? null,
    unit_id: (membershipData as any).unit_id ?? null,
  };

  return {
    user,
    membership,
    role: membership.role,
    orgId: membership.org_id ?? null,
    unitId: membership.unit_id ?? null,
    establishmentId: membership.establishment_id ?? null,
  };
}

/**
 * Soft check (sem redirect)
 */
export async function getActiveMembership() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) return { user: null, membership: null };

  const { data: membershipData, error: membershipErr } = await supabase
    .from("memberships")
    .select("id,user_id,role,org_id,unit_id,establishment_id,is_active,created_at")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (membershipErr) {
    console.error("[getActiveMembership] memberships error:", {
      message: membershipErr.message,
      code: membershipErr.code,
      user_id: user.id,
      email: user.email,
    });
    return { user, membership: null };
  }

  if (!membershipData) return { user, membership: null };

  const membership: ActiveMembership = {
    id: String((membershipData as any).id),
    user_id: String((membershipData as any).user_id),
    role: (membershipData as any).role as Role,
    establishment_id: (membershipData as any).establishment_id ?? null,
    is_active: Boolean((membershipData as any).is_active),
    created_at: String((membershipData as any).created_at),
    org_id: (membershipData as any).org_id ?? null,
    unit_id: (membershipData as any).unit_id ?? null,
  };

  return { user, membership };
}
