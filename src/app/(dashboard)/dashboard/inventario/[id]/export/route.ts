// src/app/(dashboard)/dashboard/inventario/[id]/export/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const inventoryId = params.id;

  const { membership } = await getActiveMembershipOrRedirect();
  const establishmentId = membership.establishment_id;

  const supabase = await createSupabaseServerClient();

  // Confere se o inventário é da unidade do usuário
  const { data: count, error: countError } = await supabase
    .from("inventory_counts")
    .select("id, establishment_id")
    .eq("id", inventoryId)
    .maybeSingle();

  if (countError || !count || count.establishment_id !== establishmentId) {
    return NextResponse.json(
      { error: "Inventário não encontrado ou não autorizado." },
      { status: 404 }
    );
  }

  // Busca itens + produto
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
    `
    )
    .eq("inventory_count_id", inventoryId);

  if (itemsError) {
    console.error("Erro ao carregar itens para export:", itemsError);
    return NextResponse.json(
      { error: "Erro ao carregar itens de inventário." },
      { status: 500 }
    );
  }

  const rows = [
    ["Produto", "Unidade", "Estoque_antes", "Contado", "Diferenca"],
    ...(items ?? []).map((r) => [
      r.products?.name ?? "",
      r.unit_label ?? "",
      r.current_stock_before ?? 0,
      r.counted_qty ?? 0,
      r.diff_qty ?? 0,
    ]),
  ];

  const csv = rows
    .map((cols) =>
      cols
        .map((v) => {
          const s = String(v ?? "");
          // Escapa aspas e separa por ;
          return `"${s.replace(/"/g, '""')}"`;
        })
        .join(";")
    )
    .join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="inventario-${inventoryId}.csv"`,
    },
  });
}
