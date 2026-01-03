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

function normalizeOne<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Mantém seu gate já validado (não mexi)
    await getActiveMembershipOrRedirect();

    const supabase = await createSupabaseServerClient();
    const countId = params.id;

    // ✅ FIX: colunas corretas no nested select
    // - current_stock_before -> alias stock_before
    // - error_message -> alias message
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
          stock_before:current_stock_before,
          diff_qty,
          status,
          message:error_message,
          product:products(id,sku,name)
        )
      `
      )
      .eq("id", countId)
      .maybeSingle();

    if (error) {
      console.error("Erro export inventory count:", error);
      return NextResponse.json(
        { error: "Erro ao exportar inventário." },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Inventário não encontrado." },
        { status: 404 }
      );
    }

    const estab = normalizeOne((data as any)?.establishment);
    const establishmentName = estab?.name ?? "";
    const establishmentId = estab?.id ?? "";

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

    const rows: string[] = [header.join(";")];

    const items = ((data as any)?.items ?? []) as any[];

    for (const it of items) {
      const product = normalizeOne(it.product);

      rows.push(
        [
          csvEscape((data as any).id),
          csvEscape((data as any).created_at),
          csvEscape((data as any).started_at),
          csvEscape((data as any).finished_at),
          csvEscape(establishmentId),
          csvEscape(establishmentName),
          csvEscape(createdBy),
          csvEscape(it.product_id ?? ""),
          csvEscape(product?.sku ?? ""),
          csvEscape(product?.name ?? ""),
          csvEscape(it.unit_label ?? ""),
          csvEscape(it.counted_qty ?? ""),
          csvEscape(it.stock_before ?? ""), // ✅ agora vem do alias current_stock_before
          csvEscape(it.diff_qty ?? ""),
          csvEscape(it.status ?? ""),
          csvEscape(it.message ?? ""), // ✅ agora vem do alias error_message
        ].join(";")
      );
    }

    // ✅ BOM ajuda o Excel (pt-BR) a abrir acentuação certinho
    const BOM = "\ufeff";
    const csv = BOM + rows.join("\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="inventario_${countId}.csv"`,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    console.error("Erro inesperado export inventory count:", err);
    return NextResponse.json(
      { error: "Erro inesperado ao exportar." },
      { status: 500 }
    );
  }
}
