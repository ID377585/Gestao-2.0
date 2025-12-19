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

  // multi-tenant (pode existir 1 ou mais dependendo do seu schema)
  org_id: string | null;
  unit_id: string | null;

  // alguns schemas usam establishment_id no lugar de unit_id
  establishment_id: string | null;

  is_active: boolean;
  created_at: string;
};

type Options = {
  redirectToLogin?: string; // default: "/login"
  redirectToNoMembership?: string; // default: "/acesso-servicos"
};

/**
 * Retorna o membership ativo do usuário logado.
 * Se não estiver logado ou não tiver membership ativo, faz redirect.
 */
export async function getActiveMembershipOrRedirect(options?: Options) {
  const redirectToLogin = options?.redirectToLogin ?? "/login";
  const redirectToNoMembership =
    options?.redirectToNoMembership ?? "/acesso-servicos";

  const supabase = await createSupabaseServerClient();

  // 1) precisa estar autenticado
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    redirect(redirectToLogin);
  }

  // 2) precisa ter membership ativo (fonte única da verdade)
  // OBS: SELECT só funciona se sua policy permitir (você já fez ✅)
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
    // Se der erro por policy/rls, aqui já te ajuda a enxergar no log do servidor
    console.error("[getActiveMembershipOrRedirect] memberships select error:", {
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

  const membership = data as ActiveMembership;

  // normaliza ids de escopo
  const orgId = membership.org_id ?? null;
  const unitId = membership.unit_id ?? membership.establishment_id ?? null;

  return {
    user,
    membership,
    role: membership.role,
    orgId,
    unitId,
  };
}

/**
 * Variante "soft" (não redireciona) – útil em componentes/layouts
 * onde você quer só checar e renderizar outra coisa.
 */
export async function getActiveMembership() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, membership: null };

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

  if (!data) return { user, membership: null };

  return { user, membership: data as ActiveMembership };
}
