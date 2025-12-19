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
  org_id: string | null;
  unit_id: string | null;
  establishment_id: string | null;
  is_active: boolean;
  created_at: string;
};

export type MembershipContext = {
  user: any; // se você tiver o tipo User do supabase, posso tipar certinho
  membership: ActiveMembership;
  role: Role;
  orgId: string | null;
  unitId: string | null;
  establishmentId: string | null;
};

type Options = {
  redirectToLogin?: string; // default: "/login"
  redirectToNoMembership?: string; // default: "/acesso-servicos"
};

/**
 * Retorna membership ativo + role + escopo.
 * Se não estiver logado ou não tiver membership ativo, redireciona.
 */
export async function getActiveMembershipOrRedirect(
  options?: Options
): Promise<MembershipContext> {
  const redirectToLogin = options?.redirectToLogin ?? "/login";
  const redirectToNoMembership =
    options?.redirectToNoMembership ?? "/acesso-servicos";

  const supabase = await createSupabaseServerClient();

  // 1) auth obrigatório
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) redirect(redirectToLogin);

  // 2) membership ativo (fonte única da verdade)
  const { data, error } = await supabase
    .from("memberships")
    .select(
      "id,user_id,role,org_id,unit_id,establishment_id,is_active,created_at"
    )
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[getActiveMembershipOrRedirect] memberships select error:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    redirect(redirectToNoMembership);
  }

  if (!data) redirect(redirectToNoMembership);

  const membership = data as ActiveMembership;

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
 * Variante "soft" (não redireciona) – útil se quiser só checar.
 */
export async function getActiveMembership() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) return { user: null, membership: null };

  const { data } = await supabase
    .from("memberships")
    .select(
      "id,user_id,role,org_id,unit_id,establishment_id,is_active,created_at"
    )
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return { user, membership: (data as ActiveMembership) ?? null };
}
