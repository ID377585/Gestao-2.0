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
  redirectToNoMembership?: string; // default: "/sem-acesso" ou "/acesso-servicos"
};

/**
 * Fonte principal: public.establishment_memberships
 * Fallback: public.memberships (legado), se existir.
 */
export async function getActiveMembershipOrRedirect(
  options?: Options
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

  // 2) tenta establishment_memberships (principal)
  const { data: emData, error: emErr } = await supabase
    .from("establishment_memberships")
    .select("id,user_id,role,establishment_id,is_active,created_at")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (emErr) {
    console.error("[getActiveMembershipOrRedirect] establishment_memberships error:", {
      message: emErr.message,
      details: emErr.details,
      hint: emErr.hint,
      code: emErr.code,
      user_id: user.id,
      email: user.email,
    });
  }

  if (emData) {
    const membership: ActiveMembership = {
      id: String((emData as any).id),
      user_id: String((emData as any).user_id),
      role: (emData as any).role as Role,
      establishment_id: (emData as any).establishment_id ?? null,
      is_active: Boolean((emData as any).is_active),
      created_at: String((emData as any).created_at),
      org_id: null,
      unit_id: null,
    };

    return {
      user,
      membership,
      role: membership.role,
      orgId: null,
      unitId: null,
      establishmentId: membership.establishment_id ?? null,
    };
  }

  // 3) fallback legado: memberships (se existir)
  //    (se a tabela não existir, vai dar erro — a gente loga e segue para redirect)
  const { data: legacyData, error: legacyErr } = await supabase
    .from("memberships")
    .select("id,user_id,role,org_id,unit_id,establishment_id,is_active,created_at")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (legacyErr) {
    console.error("[getActiveMembershipOrRedirect] memberships (legacy) error:", {
      message: legacyErr.message,
      details: legacyErr.details,
      hint: legacyErr.hint,
      code: legacyErr.code,
      user_id: user.id,
      email: user.email,
    });
  }

  if (legacyData) {
    const membership: ActiveMembership = {
      id: String((legacyData as any).id),
      user_id: String((legacyData as any).user_id),
      role: (legacyData as any).role as Role,
      establishment_id: (legacyData as any).establishment_id ?? null,
      is_active: Boolean((legacyData as any).is_active),
      created_at: String((legacyData as any).created_at),
      org_id: (legacyData as any).org_id ?? null,
      unit_id: (legacyData as any).unit_id ?? null,
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

  // 4) nada encontrado -> sem acesso
  console.error("[getActiveMembershipOrRedirect] no active membership found:", {
    user_id: user.id,
    email: user.email,
  });

  redirect(redirectToNoMembership);
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

  const { data: emData } = await supabase
    .from("establishment_memberships")
    .select("id,user_id,role,establishment_id,is_active,created_at")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (emData) {
    const membership: ActiveMembership = {
      id: String((emData as any).id),
      user_id: String((emData as any).user_id),
      role: (emData as any).role as Role,
      establishment_id: (emData as any).establishment_id ?? null,
      is_active: Boolean((emData as any).is_active),
      created_at: String((emData as any).created_at),
      org_id: null,
      unit_id: null,
    };

    return { user, membership };
  }

  // fallback legado
  const { data: legacyData } = await supabase
    .from("memberships")
    .select("id,user_id,role,org_id,unit_id,establishment_id,is_active,created_at")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!legacyData) return { user, membership: null };

  const membership: ActiveMembership = {
    id: String((legacyData as any).id),
    user_id: String((legacyData as any).user_id),
    role: (legacyData as any).role as Role,
    establishment_id: (legacyData as any).establishment_id ?? null,
    is_active: Boolean((legacyData as any).is_active),
    created_at: String((legacyData as any).created_at),
    org_id: (legacyData as any).org_id ?? null,
    unit_id: (legacyData as any).unit_id ?? null,
  };

  return { user, membership };
}
