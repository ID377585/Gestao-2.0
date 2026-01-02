import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("inventory_counts")
      .select(
        "id, created_at, started_at, finished_at, total_items, total_products"
      )
      .order("created_at", { ascending: true });

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
      cols
        .map((value) => {
          const v = value ?? "";
          const s = String(v).replace(/"/g, '""');
          return `"${s}"`;
        })
        .join(";")
    );

    const csv = csvLines.join("\r\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="inventarios.csv"',
      },
    });
  } catch (e) {
    console.error("Erro inesperado ao gerar export:", e);
    return new NextResponse("Erro interno ao gerar exportação", {
      status: 500,
    });
  }
}
