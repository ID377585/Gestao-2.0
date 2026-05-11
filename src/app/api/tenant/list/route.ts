import { NextResponse } from "next/server";
import { listCurrentUserTenants } from "@/lib/tenant/get-current-tenant";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
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
