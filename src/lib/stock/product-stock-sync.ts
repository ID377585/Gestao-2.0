// src/lib/stock/product-stock-sync.ts

export function normalizeStockUnitLabel(input: any): string {
  const value = String(input ?? "").trim().toUpperCase();
  const allowed = ["UN", "KG", "G", "L", "ML"];
  if (!value) return "UN";
  return allowed.includes(value) ? value : "UN";
}

function isMissingRpcError(error: any) {
  const code = String(error?.code ?? "");
  const message = String(error?.message ?? "").toLowerCase();

  return (
    code === "42883" ||
    code === "PGRST202" ||
    message.includes("could not find the function") ||
    message.includes("function public.gestify_ensure_stock_balance_for_product")
  );
}

async function selectExistingStockBalance(params: {
  supabase: any;
  establishmentId: string;
  productId: string;
}) {
  return params.supabase
    .from("stock_balances")
    .select("id, unit_label, location")
    .eq("establishment_id", params.establishmentId)
    .eq("product_id", params.productId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();
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

  const { data: ensured, error: rpcError } = await params.supabase
    .rpc("gestify_ensure_stock_balance_for_product", {
      p_establishment_id: params.establishmentId,
      p_product_id: params.productId,
      p_unit_label: unitLabel,
      p_default_location: defaultLocation,
    })
    .maybeSingle();

  if (!rpcError && ensured?.id) {
    return ensured;
  }

  if (rpcError && !isMissingRpcError(rpcError)) {
    console.error(
      "[product-stock-sync.ensureProductStockBalance] rpc error",
      rpcError,
    );
    throw new Error(
      "Não foi possível garantir o item correspondente no estoque.",
    );
  }

  const { data: existing, error: existingError } =
    await selectExistingStockBalance({
      supabase: params.supabase,
      establishmentId: params.establishmentId,
      productId: params.productId,
    });

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
    if (insertError.code === "23505") {
      const { data: racedExisting, error: racedExistingError } =
        await selectExistingStockBalance({
          supabase: params.supabase,
          establishmentId: params.establishmentId,
          productId: params.productId,
        });

      if (!racedExistingError && racedExisting?.id) {
        return racedExisting;
      }
    }

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

  const ensured = await ensureProductStockBalance({
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
    .eq("id", ensured.id)
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
