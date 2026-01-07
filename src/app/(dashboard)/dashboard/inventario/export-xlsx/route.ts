// src/app/(dashboard)/dashboard/inventario/export-xlsx/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";

function csvEscape(value: unknown) {
  const v = value ?? "";
  const s = String(v).replace(/"/g, '""');
  return `"${s}"`;
}

export async function GET() {
  try {
    // ✅ garante que existe sessão + membership (usa cookie)
    const { membership } = await getActiveMembershipOrRedirect();
    const establishmentId = membership.establishment_id;

    const supabase = await createSupabaseServerClient();

    // ✅ exporta SOMENTE do estabelecimento do usuário
    const { data, error } = await supabase
      .from("inventory_counts")
      .select(
        "id, created_at, started_at, finished_at, total_items, total_products, establishment_id"
      )
      .eq("establishment_id", establishmentId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao carregar inventory_counts para export:", error);
      return new NextResponse("Erro ao gerar exportação", { status: 500 });
    }

    const header = [
      "ID",
      "Criado em",
      "Iniciado em",
      "Finalizado em",
      "Itens lançados",
      "Produtos distintos",
    ];

    const rows = (data ?? []).map((row: any) => [
      row.id,
      row.created_at ?? "",
      row.started_at ?? "",
      row.finished_at ?? "",
      row.total_items ?? "",
      row.total_products ?? "",
    ]);

    const csvLines = [header, ...rows].map((cols) =>
      cols.map(csvEscape).join(";")
    );

    // ✅ BOM para Excel (abre acentos certinho)
    const csv = "\uFEFF" + csvLines.join("\r\n");

    const today = new Date().toISOString().slice(0, 10);
    const filename = `inventarios-${today}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("Erro inesperado ao gerar export:", e);
    return new NextResponse("Erro interno ao gerar exportação", { status: 500 });
  }
}
