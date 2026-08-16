import { NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  getSupabaseAdminClient,
} from "@/lib/supabase/server";
import { rateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

type MembershipRole =
  | "admin"
  | "operacao"
  | "estoque"
  | "producao"
  | "fiscal"
  | "entrega"
  | "cliente";

const ALLOWED_ROLES: MembershipRole[] = ["admin", "operacao", "estoque"];

async function getAuthorizedUserContext() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      supabase,
      error: NextResponse.json({ error: "Não autenticado." }, { status: 401 }),
    };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("id, role, is_active, establishment_id, org_id, unit_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .in("role", ALLOWED_ROLES)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    console.error("Erro ao validar permissão para verificações de notificação:", membershipError);
    return {
      supabase,
      error: NextResponse.json(
        { error: "Erro ao validar permissão." },
        { status: 500 }
      ),
    };
  }

  if (!membership) {
    return {
      supabase,
      error: NextResponse.json(
        { error: "Acesso negado. Apenas admin, operação ou estoque podem executar esta verificação." },
        { status: 403 }
      ),
    };
  }

  if (membership.role === "admin") {
    const { data: aal, error: aalError } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (aalError || aal.currentLevel !== "aal2") {
      return {
        supabase,
        error: NextResponse.json(
          { error: "MFA AAL2 é obrigatório para ações administrativas." },
          { status: 403 }
        ),
      };
    }
  }

  return { supabase, user, membership, error: null };
}

export async function POST(request: Request) {
  try {
    const limited = rateLimit(request, {
      key: "admin-notification-checks",
      limit: 20,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const context = await getAuthorizedUserContext();

    if (context.error) {
      return context.error;
    }

    const supabaseAdmin = getSupabaseAdminClient();
    const { data, error } = await supabaseAdmin.rpc(
      "run_operational_notification_checks"
    );

    if (error) {
      console.error("Erro ao executar verificações operacionais:", error);
      return NextResponse.json(
        {
          error: "Erro ao executar verificações operacionais.",
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        executedAt: new Date().toISOString(),
        executedBy: context.user?.id,
        role: context.membership?.role,
        result: data,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Erro inesperado ao executar verificações operacionais:", error);
    return NextResponse.json(
      { error: error?.message ?? "Erro inesperado." },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      message:
        "Use POST para executar manualmente as verificações operacionais de notificações.",
      allowedRoles: ALLOWED_ROLES,
    },
    { status: 200 }
  );
}
