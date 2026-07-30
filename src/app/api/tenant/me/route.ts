import { NextResponse } from "next/server";
import {
  getCurrentTenant,
  listCurrentUserTenants,
} from "@/lib/tenant/get-current-tenant";
import { getCompanySubscriptionStatus } from "@/lib/billing/subscription-status";
import { rateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const limited = rateLimit(request, {
      key: "api:tenant:me",
      limit: 120,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const tenant = await getCurrentTenant();

    if (!tenant) {
      return NextResponse.json(
        { error: "Nenhuma empresa ativa encontrada." },
        { status: 404 }
      );
    }

    const [tenants, subscription] = await Promise.all([
      listCurrentUserTenants(),
      getCompanySubscriptionStatus(tenant.establishmentId),
    ]);

    return NextResponse.json(
      {
        tenant,
        tenants,
        subscription,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Erro inesperado em /api/tenant/me:", error);
    return NextResponse.json(
      { error: error?.message ?? "Erro ao buscar empresa ativa." },
      { status: 500 }
    );
  }
}
