// src/app/(dashboard)/dashboard/inventario/[id]/export/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";

/* =========================================================
   Tipagens corretas do Supabase
   ========================================================= */

type ProductJoin =
  | { name: string | null }
  | { name: string | null }[]
  | null;

type InventoryItemRow = {
  unit_label: string | null;
  counted_qty: number | null;
  current_stock_before: number | null;
  diff_qty: number | null;
  products: ProductJoin;
};

/**
 * Normaliza o nome do produto independente
 * se o Supabase retornar objeto ou array
 */
function getProductName(products: ProductJoin): string {
  if (!products) return "";
  if (Array.isArray(products)) {
    return products[0]?.name ?? "";
  }
  return products.name ?? "";
}

/* =========================================================
   Route
   ========================================================= */

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const inventoryId = params.id;

    const { membership } = await getActiveMembershipOrRedirect();
    const establishmentId = membership.establishment_id;

    const supabase = await createSupabaseServerClient();

    // 1️⃣ Confere se o inventário pertence ao estabelecimento
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

    // 2️⃣ Busca itens + produto (join)
    const { data, error } = await supabase
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

    if (error) {
      console.error("Erro ao carregar itens para export:", error);
      return NextResponse.json(
        { error: "Erro ao carregar itens de inventário." },
        { status: 500 },
      );
    }

    const items = (data ?? []) as InventoryItemRow[];

    // 3️⃣ Monta CSV
    const rows: string[][] = [
      ["Produto", "Unidade", "Estoque_antes", "Contado", "Diferenca"],
      ...items.map((r) => [
        getProductName(r.products),
        r.unit_label ?? "",
        String(r.current_stock_before ?? 0),
        String(r.counted_qty ?? 0),
        String(r.diff_qty ?? 0),
      ]),
    ];

    const csv = rows
      .map((cols) =>
        cols
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(";"),
      )
      .join("\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="inventario-${inventoryId}.csv"`,
      },
    });
  } catch (err) {
    console.error("Erro inesperado ao exportar inventário:", err);
    return NextResponse.json(
      { error: "Erro inesperado ao exportar inventário." },
      { status: 500 },
    );
  }
}
