import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { dispatchOverdueOrderAlerts } from "@/lib/alerts/domain-triggers";

export const dynamic = "force-dynamic";

function isAuthorizedBySecret(request: Request) {
  const secret = process.env.ALERTS_CRON_SECRET?.trim();
  if (!secret) return false;

  const authHeader = request.headers.get("authorization") ?? "";
  const xSecret = request.headers.get("x-alerts-secret") ?? "";

  return (
    authHeader === `Bearer ${secret}` ||
    xSecret === secret
  );
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();

    let establishmentId: string | null = null;

    if (isAuthorizedBySecret(request)) {
      const body = (await request.json().catch(() => ({}))) as {
        establishmentId?: string;
      };

      establishmentId = body?.establishmentId
        ? String(body.establishmentId)
        : null;
    } else {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        return NextResponse.json(
          { error: "Não autenticado." },
          { status: 401 }
        );
      }

      const { data: membership } = await supabase
        .from("establishment_memberships")
        .select("establishment_id, role, is_active, created_at")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!membership) {
        return NextResponse.json(
          { error: "Sem acesso ao estabelecimento." },
          { status: 403 }
        );
      }

      if (!["admin", "operacao"].includes(String((membership as any).role ?? ""))) {
        return NextResponse.json(
          { error: "Sem permissão para executar esta verificação." },
          { status: 403 }
        );
      }

      establishmentId = String((membership as any).establishment_id ?? "");
    }

    if (!establishmentId) {
      return NextResponse.json(
        { error: "Estabelecimento não informado." },
        { status: 400 }
      );
    }

    const result = await dispatchOverdueOrderAlerts({
      establishmentId,
    });

    return NextResponse.json(
      {
        ok: true,
        ...result,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Erro ao verificar pedidos atrasados:", error);
    return NextResponse.json(
      { error: error?.message ?? "Erro inesperado." },
      { status: 500 }
    );
  }
}