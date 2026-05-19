import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedTenantUserOrThrow } from "@/lib/tenant/guards";

function csvEscape(value: any) {
  if (value == null) return "";
  const s = String(value);
  if (s.includes('"') || s.includes(",") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient();

  let establishment_id: string;
  try {
    const { tenant } = await getAuthenticatedTenantUserOrThrow();
    establishment_id = tenant.establishmentId;
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Estabelecimento não encontrado." },
      { status: error?.message === "Não autenticado." ? 401 : 403 }
    );
  }

  const url = new URL(req.url);
  const product_id = url.searchParams.get("product_id");
  const reason = url.searchParams.get("reason");
  const date_from = url.searchParams.get("date_from");
  const date_to = url.searchParams.get("date_to");

  let q = supabase
    .from("losses")
    .select(`
      created_at,
      product_name,
      sku,
      unit_label,
      qty,
      reason,
      reason_detail,
      lot,
      qrcode,
      stock_before,
      stock_after,
      user_id
    `)
    .eq("establishment_id", establishment_id)
    .order("created_at", { ascending: false });

  if (product_id) q = q.eq("product_id", product_id);
  if (reason) q = q.eq("reason", reason);
  if (date_from) q = q.gte("created_at", date_from);
  if (date_to) q = q.lte("created_at", date_to);

  const { data, error } = await q;

  if (error) {
    return NextResponse.json(
      { error: "Erro ao exportar perdas." },
      { status: 500 }
    );
  }

  const header = [
    "Data",
    "Produto",
    "SKU",
    "Unidade",
    "Quantidade",
    "Motivo",
    "Detalhe do Motivo",
    "Lote",
    "QR Code",
    "Usuário",
    "Estoque Antes",
    "Estoque Depois",
  ];

  const rows = ((data ?? []) as any[]).map((r: any) => [
    csvEscape(new Date(r.created_at).toLocaleString("pt-BR")),
    csvEscape(r.product_name),
    csvEscape(r.sku),
    csvEscape(r.unit_label),
    csvEscape(r.qty),
    csvEscape(r.reason),
    csvEscape(r.reason_detail),
    csvEscape(r.lot),
    csvEscape(r.qrcode),
    csvEscape(r.user_id),
    csvEscape(r.stock_before),
    csvEscape(r.stock_after),
  ]);

  const csv = [header.join(","), ...rows.map((r: string[]) => r.join(","))].join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="perdas-${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`,
    },
  });
}
