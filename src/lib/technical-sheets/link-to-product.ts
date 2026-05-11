import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";

type SupabaseAdminClient = Awaited<ReturnType<typeof createSupabaseAdminClient>>;

type LinkTechnicalSheetToProductInput = {
  supabase?: SupabaseAdminClient;
  establishmentId: string;
  technicalSheetId: string;
  userId?: string | null;
};

function normalizeUnit(value: unknown) {
  const unit = String(value ?? "").trim().toUpperCase();
  if (["UN", "KG", "G", "L", "ML"].includes(unit)) return unit;
  return "KG";
}

function normalizeStorageCategory(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (/congel/i.test(raw)) return "Congelado";
  if (/resfri|refrig/i.test(raw)) return "Resfriado";
  if (/ambiente|seco/i.test(raw)) return "Temp. Ambiente";
  return raw;
}

function normalizeProductType(category: unknown) {
  const raw = String(category ?? "").toLowerCase();
  if (raw.includes("pré") || raw.includes("pre") || raw.includes("rapida")) {
    return "PREP";
  }
  return "PROD";
}

function normalizeName(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function normalizeProductLookupName(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function buildSkuFromSheetId(technicalSheetId: string) {
  return `FT-${technicalSheetId.slice(0, 8).toUpperCase()}`;
}

async function ensureStockBalanceForLinkedProduct(params: {
  supabase: SupabaseAdminClient;
  establishmentId: string;
  productId: string;
  unitLabel: string;
}) {
  const { data: existing, error: existingError } = await params.supabase
    .from("stock_balances")
    .select("id")
    .eq("establishment_id", params.establishmentId)
    .eq("product_id", params.productId)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    console.error("[technicalSheetLink.ensureStockBalance] lookup error", existingError);
    throw new Error("Não foi possível verificar o estoque do produto vinculado.");
  }

  if (existing?.id) {
    const { error: updateError } = await params.supabase
      .from("stock_balances")
      .update({ unit_label: params.unitLabel })
      .eq("id", existing.id);

    if (updateError) {
      console.error("[technicalSheetLink.ensureStockBalance] update error", updateError);
      throw new Error("Não foi possível atualizar a unidade do estoque vinculado.");
    }

    return String(existing.id);
  }

  const { data: inserted, error: insertError } = await params.supabase
    .from("stock_balances")
    .insert({
      establishment_id: params.establishmentId,
      product_id: params.productId,
      quantity: 0,
      unit_label: params.unitLabel,
      min_qty: 0,
      med_qty: 0,
      max_qty: 0,
      location: "Estoque Principal",
    })
    .select("id")
    .maybeSingle();

  if (insertError) {
    console.error("[technicalSheetLink.ensureStockBalance] insert error", insertError);
    throw new Error("Produto vinculado, mas não foi possível criar o item no estoque.");
  }

  return inserted?.id ? String(inserted.id) : null;
}

export async function linkTechnicalSheetToProduct({
  supabase: providedSupabase,
  establishmentId,
  technicalSheetId,
  userId,
}: LinkTechnicalSheetToProductInput) {
  const supabase = providedSupabase ?? createSupabaseAdminClient();

  const { data: sheet, error: sheetError } = await supabase
    .from("technical_sheets")
    .select(
      "id, establishment_id, name, category, sale_price, cost_per_portion, portion_weight, portion_weight_unit, shelf_life_frozen, shelf_life_refrigerated, shelf_life_room_temp, storage_instructions, sector, allergens, linked_product_id"
    )
    .eq("id", technicalSheetId)
    .eq("establishment_id", establishmentId)
    .maybeSingle();

  if (sheetError) {
    console.error("[technicalSheetLink] sheet lookup error", sheetError);
    throw new Error("Não foi possível localizar a ficha técnica para atrelamento.");
  }

  if (!sheet?.id) {
    throw new Error("Ficha técnica não encontrada para este estabelecimento.");
  }

  const productName = normalizeName((sheet as any).name);
  if (!productName) {
    throw new Error("Informe o nome da ficha técnica antes de atrelar ao produto.");
  }

  const defaultUnitLabel = normalizeUnit((sheet as any).portion_weight_unit);
  const category =
    normalizeStorageCategory((sheet as any).storage_instructions) ??
    normalizeStorageCategory((sheet as any).shelf_life_refrigerated) ??
    normalizeStorageCategory((sheet as any).shelf_life_frozen);

  const productPayload: Record<string, unknown> = {
    establishment_id: establishmentId,
    name: productName,
    brand: "PROD. PRÓPRIA",
    product_type: normalizeProductType((sheet as any).category),
    default_unit_label: defaultUnitLabel,
    package_qty: Number((sheet as any).portion_weight ?? 0) || null,
    qty_per_package: defaultUnitLabel === "KG" ? "KILO" : defaultUnitLabel,
    category,
    sector_category: (sheet as any).sector || null,
    abc_curve: null,
    shelf_life_days: null,
    conversion_factor: 1,
    price: Number((sheet as any).cost_per_portion ?? 0) || Number((sheet as any).sale_price ?? 0) || 0,
    standard_cost: Number((sheet as any).cost_per_portion ?? 0) || null,
    allergens: (sheet as any).allergens ? String((sheet as any).allergens).split(",").map((item) => item.trim()).filter(Boolean) : [],
    is_active: true,
    ...(userId ? { updated_by: userId, updated_at: new Date().toISOString() } : {}),
  };

  let productId = (sheet as any).linked_product_id ? String((sheet as any).linked_product_id) : null;

  if (!productId) {
    const { data: existingProducts, error: existingError } = await supabase
      .from("products")
      .select("id, name")
      .eq("establishment_id", establishmentId)
      .limit(5000);

    if (existingError) {
      console.error("[technicalSheetLink] product lookup error", existingError);
      throw new Error("Não foi possível verificar produtos existentes para atrelamento.");
    }

    const existingProduct = (existingProducts ?? []).find(
      (product: any) => normalizeProductLookupName(product.name) === normalizeProductLookupName(productName)
    );

    if (existingProduct?.id) {
      productId = String(existingProduct.id);
    }
  }

  if (productId) {
    const { data: updatedProduct, error: updateError } = await supabase
      .from("products")
      .update(productPayload)
      .eq("id", productId)
      .eq("establishment_id", establishmentId)
      .select("id")
      .maybeSingle();

    if (updateError) {
      console.error("[technicalSheetLink] product update error", updateError);
      throw new Error("Não foi possível atualizar o produto atrelado à ficha técnica.");
    }

    productId = String(updatedProduct?.id ?? productId);
  } else {
    const { data: insertedProduct, error: insertError } = await supabase
      .from("products")
      .insert({
        ...productPayload,
        sku: buildSkuFromSheetId(technicalSheetId),
        ...(userId ? { created_by: userId } : {}),
      })
      .select("id")
      .maybeSingle();

    if (insertError) {
      console.error("[technicalSheetLink] product insert error", insertError);
      throw new Error("Não foi possível criar o produto a partir da ficha técnica.");
    }

    if (!insertedProduct?.id) {
      throw new Error("Produto não foi criado ao atrelar a ficha técnica.");
    }

    productId = String(insertedProduct.id);
  }

  await ensureStockBalanceForLinkedProduct({
    supabase,
    establishmentId,
    productId,
    unitLabel: defaultUnitLabel,
  });

  const { error: linkError } = await supabase
    .from("technical_sheets")
    .update({
      linked_product_id: productId,
      is_linked_to_product: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", technicalSheetId)
    .eq("establishment_id", establishmentId);

  if (linkError) {
    console.error("[technicalSheetLink] sheet link update error", linkError);
    throw new Error("Produto criado, mas não foi possível gravar o vínculo na ficha técnica.");
  }

  return {
    productId,
    technicalSheetId,
  };
}
