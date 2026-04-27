import { supabase } from "@/lib/supabase/client";

export type LossFilters = {
  dateFrom?: string;
  dateTo?: string;
};

export type LossEntry = {
  id: string;
  created_at: string;
  product_id: string;
  product_name: string;
  sku: string;
  unit_label: string;
  qty: number;
  lot: string | null;
  reason: string;
  reason_detail: string | null;
  qrcode: string | null;
  user_id: string;
  establishment_id: string;
  stock_before: number | null;
  stock_after: number | null;
};

function startOfDay(value: string) {
  return `${value}T00:00:00`;
}

function endOfDay(value: string) {
  return `${value}T23:59:59.999`;
}

export async function listLosses(
  filters: LossFilters = {}
): Promise<LossEntry[]> {

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Não autenticado.");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("establishment_id")
    .eq("user_id", user.id)
    .single();

  if (membershipError || !membership?.establishment_id) {
    throw new Error("Estabelecimento não encontrado.");
  }

  let query = supabase
    .from("losses")
    .select(
      [
        "id",
        "created_at",
        "product_id",
        "product_name",
        "sku",
        "unit_label",
        "qty",
        "lot",
        "reason",
        "reason_detail",
        "qrcode",
        "user_id",
        "establishment_id",
        "stock_before",
        "stock_after",
      ].join(",")
    )
    .eq("establishment_id", membership.establishment_id)
    .order("created_at", { ascending: false });

  if (filters.dateFrom) {
    query = query.gte("created_at", startOfDay(filters.dateFrom));
  }

  if (filters.dateTo) {
    query = query.lte("created_at", endOfDay(filters.dateTo));
  }

  const { data, error } = await query;

if (error) {
  console.error(error);
  return [];
}

const rows = data as any[];

return rows.map((item) => ({
  id: String(item.id),
    created_at: String(item.created_at),
    product_id: String(item.product_id ?? ""),
    product_name: String(item.product_name ?? ""),
    sku: String(item.sku ?? ""),
    unit_label: String(item.unit_label ?? ""),
    qty: Number(item.qty ?? 0),
    lot: item.lot ? String(item.lot) : null,
    reason: String(item.reason ?? "Sem motivo"),
    reason_detail: item.reason_detail ? String(item.reason_detail) : null,
    qrcode: item.qrcode ? String(item.qrcode) : null,
    user_id: String(item.user_id ?? ""),
    establishment_id: String(item.establishment_id ?? ""),
    stock_before:
      item.stock_before == null ? null : Number(item.stock_before),
    stock_after: item.stock_after == null ? null : Number(item.stock_after),
  }));
}