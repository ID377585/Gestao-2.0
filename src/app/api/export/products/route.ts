// src/app/(dashboard)/dashboard/inventario/[id]/export/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";

/**
 * Normaliza possível ID para evitar "undefined"/"null" em string.
 */
function normalizeId(value: any): string | null {
  if (!value) return null;
  const v = String(value).trim();
  if (!v || v.toLowerCase() === "undefined" || v.toLowerCase() === "null") {
    return null;
  }
  return v;
}

/**
 * Escapa campo para CSV usando ; como separador.
 */
function csvField(value: any): string {
  if (value === null || value === undefined) return "";
  let text = String(value);

  // Se contiver ;, " ou quebra de linha, envolve em aspas e escapa aspas internas
  if (/[;"\r\n]/.test(text)) {
    text = text.replace(/"/g, '""');
    return `"${text}"`;
  }
  return text;
}

/**
 * Tipo do item retornado pelo select do Supabase:
 * products pode vir como array ou objeto, dependendo do schema/join.
 */
type InventoryItemRow = {
  unit_label: string | null;
  counted_qty: number | null;
  current_stock_before: number | null;
  diff_qty: number | null;
  products?: { name: string | null } | { name: string | null }[] | null;
};

function getProductName(
  products: InventoryItemRow["products"],
): string {
  if (!products) return "";
  if (Array.isArray(products)) return products[0]?.name ?? "";
  return products.name ?? "";
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const inventoryId = params.id;

    const { membership } = await getActiveMembershipOrRedirect();
    const establishmentId = normalizeId((membership as any)?.establishment_id);

    if (!establishmentId) {
      return NextResponse.json(
        { error: "Estabelecimento não encontrado para o usuário atual." },
        { status: 403 },
      );
    }

    const supabase = await createSupabaseServerClient();

    // 1) Confere se o inventário pertence ao estabelecimento do usuário
    const { data: count, error: countError } = await supabase
      .from("inventory_counts")
      .select("id, establishment_id")
      .eq("id", inventoryId)
      .maybeSingle();

    if (countError || !count || count.establishment_id !== establishmentId) {
      return NextResponse.json(
        { error: "Inventário não encontrado ou não autorizado." },
        { status: 404 },
      );
    }

    // 2) Busca itens + nome do produto (join)
    const { data: items, error: itemsError } = await supabase
      .from("inventory_count_items")
      .select(
        `
        unit_label,
        counted_qty,
        current_stock_before,
        diff_qty,
        products (
          name
        )
      `,
      )
      .eq("inventory_count_id", inventoryId);

    if (itemsError) {
      console.error("Erro ao carregar itens para export:", itemsError);
      return NextResponse.json(
        { error: "Erro ao carregar itens de inventário." },
        { status: 500 },
      );
    }

    const safeItems = (items ?? []) as InventoryItemRow[];

    // 3) Monta CSV (Excel-friendly) com separador ;
    const header = ["Produto", "Unidade", "Estoque_antes", "Contado", "Diferenca"];

    const rows: string[] = [];
    rows.push(header.join(";"));

    for (const r of safeItems) {
      const row = [
        csvField(getProductName(r.products)),
        csvField(r.unit_label ?? ""),
        csvField(r.current_stock_before ?? 0),
        csvField(r.counted_qty ?? 0),
        csvField(r.diff_qty ?? 0),
      ];
      rows.push(row.join(";"));
    }

    // Adiciona BOM para Excel reconhecer UTF-8
    const csvContent = "\uFEFF" + rows.join("\r\n");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="inventario-${inventoryId}.csv"`,
      },
    });
  } catch (err) {
    console.error("Erro inesperado em export inventário:", err);
    return NextResponse.json(
      { error: "Erro inesperado ao exportar inventário." },
      { status: 500 },
    );
  }
}
