import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvEscape(v: any) {
  const s = v == null ? "" : String(v);
  // se tiver ; " ou quebra de linha, coloca em aspas e duplica aspas internas
  if (/[;"\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await getActiveMembershipOrRedirect();
    const supabase = await createSupabaseServerClient();

    const countId = params.id;

    // Busca header + itens + joins úteis
    // Observação: se você tiver tabela profiles, dá pra trocar created_by por profile.nome.
    const { data, error } = await supabase
      .from("inventory_counts")
      .select(
        `
        id,
        created_at,
        started_at,
        finished_at,
        created_by,
        establishment:establishments(id,name),
        items:inventory_count_items(
          id,
          product_id,
          unit_label,
          counted_qty,
          stock_before,
          diff_qty,
          status,
          message,
          product:products(id,sku,name)
        )
      `
      )
      .eq("id", countId)
      .maybeSingle();

    if (error) {
      console.error("Erro export inventory count:", error);
      return NextResponse.json({ error: "Erro ao exportar inventário." }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Inventário não encontrado." }, { status: 404 });
    }

    const establishmentName = (data as any)?.establishment?.name ?? "";
    const createdBy = (data as any)?.created_by ?? "";

    const header = [
      "inventory_id",
      "created_at",
      "started_at",
      "finished_at",
      "establishment_id",
      "establishment_name",
      "created_by_user_id",
      "product_id",
      "sku",
      "product_name",
      "unit_label",
      "counted_qty",
      "stock_before",
      "diff_qty",
      "status",
      "message",
    ];

    const rows = [header.join(";")];

    const items = ((data as any)?.items ?? []) as any[];

    for (const it of items) {
      rows.push(
        [
          csvEscape(data.id),
          csvEscape(data.created_at),
          csvEscape(data.started_at),
          csvEscape(data.finished_at),
          csvEscape((data as any)?.establishment?.id ?? ""),
          csvEscape(establishmentName),
          csvEscape(createdBy),
          csvEscape(it.product_id ?? ""),
          csvEscape(it.product?.sku ?? ""),
          csvEscape(it.product?.name ?? ""),
          csvEscape(it.unit_label ?? ""),
          csvEscape(it.counted_qty ?? ""),
          csvEscape(it.stock_before ?? ""),
          csvEscape(it.diff_qty ?? ""),
          csvEscape(it.status ?? ""),
          csvEscape(it.message ?? ""),
        ].join(";")
      );
    }

    const csv = rows.join("\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="inventario_${countId}.csv"`,
      },
    });
  } catch (err) {
    console.error("Erro inesperado export inventory count:", err);
    return NextResponse.json({ error: "Erro inesperado ao exportar." }, { status: 500 });
  }
}
