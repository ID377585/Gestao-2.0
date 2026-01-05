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

  // compat legado (não quebrar imports antigos)
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
 * FONTE ÚNICA DA VERDADE (ATUAL): public.establishment_memberships
 * - Se não estiver logado => /login
 * - Se não tiver membership ativo => /sem-acesso
 */
export async function getActiveMembershipOrRedirect(
  options?: Options
): Promise<MembershipContext> {
  const redirectToLogin = options?.redirectToLogin ?? "/login";

  // IMPORTANTE: este default precisa bater com a página real que você criou
  const redirectToNoMembership = options?.redirectToNoMembership ?? "/sem-acesso";

  const supabase = await createSupabaseServerClient();

  // 1) auth obrigatório
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) redirect(redirectToLogin);

  // 2) memberships ativos (podem existir >1; escolhemos o melhor)
  const { data: rows, error } = await supabase
    .from("establishment_memberships")
    .select("id,user_id,role,establishment_id,is_active,created_at")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("[getActiveMembershipOrRedirect] select error:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    redirect(redirectToNoMembership);
  }

  if (!rows || rows.length === 0) {
    console.error("[getActiveMembershipOrRedirect] no active membership", {
      user_id: user.id,
    });
    redirect(redirectToNoMembership);
  }

  // 3) escolhe o melhor membership (prioriza admin/operacao; senão o mais recente)
  const priority: Record<string, number> = { admin: 2, operacao: 1 };
  const picked =
    rows
      .slice()
      .sort((a: any, b: any) => {
        const pa = priority[String(a.role)] ?? 0;
        const pb = priority[String(b.role)] ?? 0;
        if (pb !== pa) return pb - pa;
        // fallback por created_at desc (já veio desc, mas garantimos)
        return String(b.created_at).localeCompare(String(a.created_at));
      })[0] ?? rows[0];

  const membership: ActiveMembership = {
    id: String((picked as any).id),
    user_id: String((picked as any).user_id),
    role: (picked as any).role as Role,
    establishment_id: (picked as any).establishment_id ?? null,
    is_active: Boolean((picked as any).is_active),
    created_at: String((picked as any).created_at),

    // compat legado
    org_id: null,
    unit_id: null,
  };

  return {
    user,
    membership,
    role: membership.role,
    orgId: membership.org_id,
    unitId: membership.unit_id,
    establishmentId: membership.establishment_id,
  };
}

/**
 * Variante "soft" (não redireciona).
 */
export async function getActiveMembership() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) return { user: null, membership: null };

  const { data: rows, error } = await supabase
    .from("establishment_memberships")
    .select("id,user_id,role,establishment_id,is_active,created_at")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error || !rows || rows.length === 0) {
    if (error) {
      console.error("[getActiveMembership] select error:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
    }
    return { user, membership: null };
  }

  const priority: Record<string, number> = { admin: 2, operacao: 1 };
  const picked =
    rows
      .slice()
      .sort((a: any, b: any) => {
        const pa = priority[String(a.role)] ?? 0;
        const pb = priority[String(b.role)] ?? 0;
        if (pb !== pa) return pb - pa;
        return String(b.created_at).localeCompare(String(a.created_at));
      })[0] ?? rows[0];

  const membership: ActiveMembership = {
    id: String((picked as any).id),
    user_id: String((picked as any).user_id),
    role: (picked as any).role as Role,
    establishment_id: (picked as any).establishment_id ?? null,
    is_active: Boolean((picked as any).is_active),
    created_at: String((picked as any).created_at),

    // compat legado
    org_id: null,
    unit_id: null,
  };

  return { user, membership };
}
