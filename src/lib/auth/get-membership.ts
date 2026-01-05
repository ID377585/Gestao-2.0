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

  // compat com código antigo (mantém para não quebrar imports)
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
 * Retorna membership ativo + role + establishment.
 * Se não estiver logado ou não tiver membership ativo, redireciona.
 *
 * FONTE ÚNICA DA VERDADE: public.establishment_memberships
 */
export async function getActiveMembershipOrRedirect(
  options?: Options
): Promise<MembershipContext> {
  const redirectToLogin = options?.redirectToLogin ?? "/login";
  const redirectToNoMembership = options?.redirectToNoMembership ?? "/sem-acesso";

  const supabase = createSupabaseServerClient();

  // 1) auth obrigatório
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) redirect(redirectToLogin);

  // 2) membership ativo
  const { data, error } = await supabase
    .from("establishment_memberships")
    .select("id,user_id,role,establishment_id,is_active,created_at")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[getActiveMembershipOrRedirect] select error:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    redirect(redirectToNoMembership);
  }

  if (!data) {
    redirect(redirectToNoMembership);
  }

  const membership: ActiveMembership = {
    id: String((data as any).id),
    user_id: String((data as any).user_id),
    role: (data as any).role as Role,
    establishment_id: (data as any).establishment_id ?? null,
    is_active: Boolean((data as any).is_active),
    created_at: String((data as any).created_at),

    // compat (não existe neste fluxo atual)
    org_id: null,
    unit_id: null,
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
 * Variante "soft" (não redireciona) – útil para checagem.
 */
export async function getActiveMembership() {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) return { user: null, membership: null };

  const { data, error } = await supabase
    .from("establishment_memberships")
    .select("id,user_id,role,establishment_id,is_active,created_at")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[getActiveMembership] select error:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return { user, membership: null };
  }

  if (!data) return { user, membership: null };

  const membership: ActiveMembership = {
    id: String((data as any).id),
    user_id: String((data as any).user_id),
    role: (data as any).role as Role,
    establishment_id: (data as any).establishment_id ?? null,
    is_active: Boolean((data as any).is_active),
    created_at: String((data as any).created_at),
    org_id: null,
    unit_id: null,
  };

  return { user, membership };
}
