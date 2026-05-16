import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembership } from "@/lib/auth/get-membership";

function csvEscape(value: any) {
  if (value == null) return "";
  const text = String(value);
  if (text.includes('"') || text.includes(",") || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function normalizeDateTo(value: string | null) {
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T23:59:59.999Z` : value;
}

export async function GET(req: Request) {
  const supabase = createSupabaseServerClient();
  const { user, membership } = await getActiveMembership();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const establishmentId = membership?.establishment_id ?? null;

  if (!establishmentId) {
    return NextResponse.json(
      { error: "Estabelecimento não encontrado." },
      { status: 400 }
    );
  }

  const url = new URL(req.url);
  const productId = url.searchParams.get("product_id")?.trim();
  const reason = url.searchParams.get("reason")?.trim();
  const dateFrom = url.searchParams.get("date_from")?.trim();
  const dateTo = normalizeDateTo(url.searchParams.get("date_to"));

  let query = supabase
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
    .eq("establishment_id", establishmentId)
    .order("created_at", { ascending: false });

  if (productId) query = query.eq("product_id", productId);
  if (reason) query = query.eq("reason", reason);
  if (dateFrom) query = query.gte("created_at", dateFrom);
  if (dateTo) query = query.lte("created_at", dateTo);

  const { data, error } = await query;

  if (error) {
    console.error("GET /api/export/losses error:", error);
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
    "Usuario",
    "Estoque Antes",
    "Estoque Depois",
  ];

  const rows = (data ?? []).map((row) => [
    csvEscape(new Date(row.created_at).toLocaleString("pt-BR")),
    csvEscape(row.product_name),
    csvEscape(row.sku),
    csvEscape(row.unit_label),
    csvEscape(row.qty),
    csvEscape(row.reason),
    csvEscape(row.reason_detail),
    csvEscape(row.lot),
    csvEscape(row.qrcode),
    csvEscape(row.user_id),
    csvEscape(row.stock_before),
    csvEscape(row.stock_after),
  ]);

  const csv = [header.join(","), ...rows.map((row) => row.join(","))].join("\n");

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
