import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  isProductSectorConstraintError,
  normalizeProductSectorCategory,
} from "@/lib/product-sectors";

type SupabaseAdminClient = Awaited<ReturnType<typeof createSupabaseAdminClient>>;

type LinkTechnicalSheetToProductInput = {
  supabase?: SupabaseAdminClient;
  establishmentId: string;
  technicalSheetId: string;
  userId?: string | null;
};

function toNumber(value: unknown, fallback = 0) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function getTechnicalSheetFinalWeight(sheet: Record<string, any>) {
  const candidates = [sheet.correction_factor_grams, sheet.portion_weight];

  for (const candidate of candidates) {
    const value = toNumber(candidate, 0);

    if (value > 0) {
      return Number(value.toFixed(3));
    }
  }

  return 1;
}

function getTechnicalSheetTotalCost(sheet: Record<string, any>) {
  const totalCost = toNumber(sheet.total_cost, 0);

  if (totalCost > 0) {
    return Number(totalCost.toFixed(5));
  }

  return 0;
}

function normalizeProductUnit(value: unknown) {
  const unit = String(value ?? "KG").trim().toUpperCase();

  if (["KG", "G", "L", "ML", "UN"].includes(unit)) {
    return unit;
  }

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
  const cleanId = String(technicalSheetId ?? "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();

  return `FT-${cleanId.slice(0, 8)}`;
}

function getProductQtyPerPackage(unitLabel: string) {
  if (unitLabel === "KG") return "KILO";
  if (unitLabel === "L") return "LITRO";
  if (unitLabel === "UN") return "UNIDADE";

  return unitLabel;
}

function getAllergensPayload(value: unknown) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map((item) => String(item ?? "").trim())
      .filter(Boolean);
  }

  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function ensureStockBalanceForLinkedProduct(params: {
  supabase: SupabaseAdminClient;
  establishmentId: string;
  productId: string;
  unitLabel: string;
}) {
  const supabase = params.supabase as any;

  const { data: existing, error: existingError } = await supabase
    .from("stock_balances")
    .select("id")
    .eq("establishment_id", params.establishmentId)
    .eq("product_id", params.productId)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    console.error(
      "[technicalSheetLink.ensureStockBalance] lookup error",
      existingError
    );
    throw new Error("Não foi possível verificar o estoque do produto vinculado.");
  }

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from("stock_balances")
      .update({ unit_label: params.unitLabel })
      .eq("id", existing.id)
      .eq("establishment_id", params.establishmentId)
      .eq("product_id", params.productId);

    if (updateError) {
      console.error(
        "[technicalSheetLink.ensureStockBalance] update error",
        updateError
      );
      throw new Error("Não foi possível atualizar a unidade do estoque vinculado.");
    }

    return String(existing.id);
  }

  const { data: inserted, error: insertError } = await supabase
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
    console.error(
      "[technicalSheetLink.ensureStockBalance] insert error",
      insertError
    );
    throw new Error("Produto vinculado, mas não foi possível criar o item no estoque.");
  }

  return inserted?.id ? String(inserted.id) : null;
}

async function findExistingProductIdBySku(params: {
  supabase: SupabaseAdminClient;
  establishmentId: string;
  sku: string;
}) {
  const supabase = params.supabase as any;

  const { data: product, error } = await supabase
    .from("products")
    .select("id")
    .eq("establishment_id", params.establishmentId)
    .eq("sku", params.sku)
    .maybeSingle();

  if (error) {
    console.error("[technicalSheetLink] product lookup by sku error", error);
    throw new Error("Não foi possível verificar produto existente por SKU.");
  }

  return product?.id ? String(product.id) : null;
}

async function findExistingProductId(params: {
  supabase: SupabaseAdminClient;
  establishmentId: string;
  productName: string;
}) {
  const supabase = params.supabase as any;

  const { data: existingProducts, error: existingError } = await supabase
    .from("products")
    .select("id, name")
    .eq("establishment_id", params.establishmentId)
    .limit(5000);

  if (existingError) {
    console.error("[technicalSheetLink] product lookup error", existingError);
    throw new Error("Não foi possível verificar produtos existentes para atrelamento.");
  }

  const existingProduct = (existingProducts ?? []).find(
    (product: any) =>
      normalizeProductLookupName(product.name) ===
      normalizeProductLookupName(params.productName)
  );

  return existingProduct?.id ? String(existingProduct.id) : null;
}

async function getLinkedProductIdIfValid(params: {
  supabase: SupabaseAdminClient;
  establishmentId: string;
  linkedProductId: unknown;
}) {
  const supabase = params.supabase as any;
  const linkedProductId = params.linkedProductId
    ? String(params.linkedProductId)
    : null;

  if (!linkedProductId) return null;

  const { data: product, error } = await supabase
    .from("products")
    .select("id")
    .eq("id", linkedProductId)
    .eq("establishment_id", params.establishmentId)
    .maybeSingle();

  if (error) {
    console.error("[technicalSheetLink] linked product lookup error", error);
    throw new Error("Não foi possível verificar o produto já atrelado à ficha técnica.");
  }

  if (product?.id) return String(product.id);

  await supabase
    .from("technical_sheets")
    .update({
      linked_product_id: null,
      is_linked_to_product: false,
      updated_at: new Date().toISOString(),
    })
    .eq("linked_product_id", linkedProductId)
    .eq("establishment_id", params.establishmentId);

  return null;
}

export async function linkTechnicalSheetToProduct({
  supabase: providedSupabase,
  establishmentId,
  technicalSheetId,
  userId,
}: LinkTechnicalSheetToProductInput) {
  const supabase = providedSupabase ?? createSupabaseAdminClient();
  const supabaseAny = supabase as any;

  const { data: rawSheet, error: sheetError } = await supabaseAny
    .from("technical_sheets")
    .select(
      [
        "id",
        "establishment_id",
        "name",
        "category",
        "sale_price",
        "total_cost",
        "cost_per_portion",
        "portion_weight",
        "portion_weight_unit",
        "correction_factor_grams",
        "shelf_life_frozen",
        "shelf_life_refrigerated",
        "shelf_life_room_temp",
        "storage_instructions",
        "sector",
        "allergens",
        "linked_product_id",
      ].join(", ")
    )
    .eq("id", technicalSheetId)
    .eq("establishment_id", establishmentId)
    .maybeSingle();

  const sheet = rawSheet as Record<string, any> | null;

  if (sheetError) {
    console.error("[technicalSheetLink] sheet lookup error", sheetError);
    throw new Error("Não foi possível localizar a ficha técnica para atrelamento.");
  }

  if (!sheet?.id) {
    throw new Error("Ficha técnica não encontrada para este estabelecimento.");
  }

  const productName = normalizeName(sheet.name);

  if (!productName) {
    throw new Error("Informe o nome da ficha técnica antes de atrelar ao produto.");
  }

  const category =
    normalizeStorageCategory(sheet.storage_instructions) ??
    normalizeStorageCategory(sheet.shelf_life_refrigerated) ??
    normalizeStorageCategory(sheet.shelf_life_frozen);

  const finalWeight = getTechnicalSheetFinalWeight(sheet);
  const totalCost = getTechnicalSheetTotalCost(sheet);
  const productUnitLabel = normalizeProductUnit(sheet.portion_weight_unit);
  const normalizedSectorCategory = normalizeProductSectorCategory(
    sheet.sector ? String(sheet.sector) : null
  );
  const now = new Date().toISOString();

  const productPayload: Record<string, unknown> = {
    establishment_id: establishmentId,
    name: productName,
    brand: "PROD. PRÓPRIA",
    product_type: normalizeProductType(sheet.category),
    default_unit_label: productUnitLabel,
    package_qty: finalWeight,
    qty_per_package: getProductQtyPerPackage(productUnitLabel),
    category,

    // Não gravar technical_sheets.sector diretamente em products.sector_category.
    // Esse campo tem check constraint no banco e precisa passar pelo normalizador.
    sector_category: normalizedSectorCategory,

    abc_curve: null,
    shelf_life_days: null,
    conversion_factor: 1,

    // Produto FT-* deve refletir o custo total atual da ficha técnica.
    price: totalCost,
    standard_cost: totalCost,

    allergens: getAllergensPayload(sheet.allergens),
    is_active: true,
    updated_at: now,
    ...(userId ? { updated_by: userId } : {}),
  };

  let productId = await getLinkedProductIdIfValid({
    supabase,
    establishmentId,
    linkedProductId: sheet.linked_product_id,
  });

  if (!productId) {
    productId = await findExistingProductIdBySku({
      supabase,
      establishmentId,
      sku: buildSkuFromSheetId(technicalSheetId),
    });
  }

  if (!productId) {
    productId = await findExistingProductId({
      supabase,
      establishmentId,
      productName,
    });
  }

  if (productId) {
    let payloadToUpdate = productPayload;

    let { data: updatedProduct, error: updateError } = await supabaseAny
      .from("products")
      .update(payloadToUpdate)
      .eq("id", productId)
      .eq("establishment_id", establishmentId)
      .select("id")
      .maybeSingle();

    if (isProductSectorConstraintError(updateError) && payloadToUpdate.sector_category) {
      payloadToUpdate = {
        ...payloadToUpdate,
        sector_category: null,
      };

      ({ data: updatedProduct, error: updateError } = await supabaseAny
        .from("products")
        .update(payloadToUpdate)
        .eq("id", productId)
        .eq("establishment_id", establishmentId)
        .select("id")
        .maybeSingle());
    }

    if (updateError) {
      console.error("[technicalSheetLink] product update error", updateError);
      throw new Error("Não foi possível atualizar o produto atrelado à ficha técnica.");
    }

    productId = String(updatedProduct?.id ?? productId);
  } else {
    let insertPayload: Record<string, unknown> = {
      ...productPayload,
      sku: buildSkuFromSheetId(technicalSheetId),
      ...(userId ? { created_by: userId } : {}),
    };

    let { data: insertedProduct, error: insertError } = await supabaseAny
      .from("products")
      .insert(insertPayload)
      .select("id")
      .maybeSingle();

    if (isProductSectorConstraintError(insertError) && insertPayload.sector_category) {
      insertPayload = {
        ...insertPayload,
        sector_category: null,
      };

      ({ data: insertedProduct, error: insertError } = await supabaseAny
        .from("products")
        .insert(insertPayload)
        .select("id")
        .maybeSingle());
    }

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
    unitLabel: productUnitLabel,
  });

  const { error: linkError } = await supabaseAny
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