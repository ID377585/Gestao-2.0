// src/lib/stock/product-stock-sync.ts

export function normalizeStockUnitLabel(input: any): string {
  const value = String(input ?? "").trim().toUpperCase();
  const allowed = ["UN", "KG", "G", "L", "ML"];
  if (!value) return "UN";
  return allowed.includes(value) ? value : "UN";
}

export async function ensureProductStockBalance(params: {
  supabase: any;
  establishmentId: string;
  productId: string;
  unitLabel?: string | null;
  defaultLocation?: string;
}) {
  const unitLabel = normalizeStockUnitLabel(params.unitLabel);
  const defaultLocation = params.defaultLocation ?? "Estoque Principal";

  const { data: existing, error: existingError } = await params.supabase
    .from("stock_balances")
    .select("id, unit_label, location")
    .eq("establishment_id", params.establishmentId)
    .eq("product_id", params.productId)
    .maybeSingle();

  if (existingError) {
    console.error(
      "[product-stock-sync.ensureProductStockBalance] lookup error",
      existingError,
    );
    throw new Error(
      "Não foi possível verificar o vínculo do produto com o estoque.",
    );
  }

  if (existing?.id) {
    return existing;
  }

  const { data: inserted, error: insertError } = await params.supabase
    .from("stock_balances")
    .insert({
      establishment_id: params.establishmentId,
      product_id: params.productId,
      quantity: 0,
      unit_label: unitLabel,
      min_qty: 0,
      med_qty: 0,
      max_qty: 0,
      location: defaultLocation,
    })
    .select("id, unit_label, location")
    .maybeSingle();

  if (insertError) {
    console.error(
      "[product-stock-sync.ensureProductStockBalance] insert error",
      insertError,
    );
    throw new Error(
      "Não foi possível criar o item correspondente no estoque.",
    );
  }

  return inserted;
}

export async function syncProductStockBalance(params: {
  supabase: any;
  establishmentId: string;
  productId: string;
  unitLabel?: string | null;
  preserveLocation?: boolean;
}) {
  const normalizedUnit = normalizeStockUnitLabel(params.unitLabel);

  await ensureProductStockBalance({
    supabase: params.supabase,
    establishmentId: params.establishmentId,
    productId: params.productId,
    unitLabel: normalizedUnit,
  });

  const updatePayload: Record<string, any> = {
    unit_label: normalizedUnit,
  };

  const { error } = await params.supabase
    .from("stock_balances")
    .update(updatePayload)
    .eq("establishment_id", params.establishmentId)
    .eq("product_id", params.productId);

  if (error) {
    console.error(
      "[product-stock-sync.syncProductStockBalance] update error",
      error,
    );
    throw new Error(
      "Não foi possível sincronizar os dados estruturais do estoque para este produto.",
    );
  }
}