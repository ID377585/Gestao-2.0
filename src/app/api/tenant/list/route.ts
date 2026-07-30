import { NextResponse } from "next/server";
import { listCurrentUserTenants } from "@/lib/tenant/get-current-tenant";
import { rateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const limited = rateLimit(request, {
      key: "api:tenant:list",
      limit: 90,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const tenants = await listCurrentUserTenants();
    return NextResponse.json({ tenants }, { status: 200 });
  } catch (error: any) {
    console.error("Erro inesperado em /api/tenant/list:", error);
    return NextResponse.json(
      { error: error?.message ?? "Erro ao listar empresas disponíveis." },
      { status: 500 }
    );
  }
}
