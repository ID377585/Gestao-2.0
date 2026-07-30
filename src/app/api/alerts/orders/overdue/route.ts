import { NextResponse } from "next/server";
import { dispatchOverdueOrderAlerts } from "@/lib/alerts/domain-triggers";
import { rateLimit } from "@/lib/security/rate-limit";
import { assertActiveTenantRole } from "@/lib/tenant/guards";

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
    const limited = rateLimit(request, {
      key: "alerts-orders-overdue",
      limit: 30,
      windowMs: 60_000,
    });
    if (limited) return limited;

    let establishmentId: string | null = null;

    if (isAuthorizedBySecret(request)) {
      const body = (await request.json().catch(() => ({}))) as {
        establishmentId?: string;
      };

      establishmentId = body?.establishmentId
        ? String(body.establishmentId)
        : null;
    } else {
      try {
        const tenant = await assertActiveTenantRole(["admin", "operacao"]);
        establishmentId = tenant.establishmentId;
      } catch (error: any) {
        return NextResponse.json(
          { error: error?.message ?? "Sem permissão para executar esta verificação." },
          { status: 403 }
        );
      }
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
