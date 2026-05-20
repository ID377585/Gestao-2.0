"use server";

import { parsePtBrNumber } from "@/lib/number-format";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createSupabaseServerClient,
  getSupabaseAdminClient,
} from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";
import { normalizeAllergenList } from "@/lib/allergens";
import {
  isProductSectorConstraintError,
  normalizeProductSectorCategory,
} from "@/lib/product-sectors";
import {
  isProductAbcConstraintError,
  normalizeProductAbcCurve,
} from "@/lib/product-curves";
import { assertBillingLimitAvailable } from "@/lib/billing/limits";

export type ProductType = "INSU" | "PREP" | "PROD";

function normalizeId(value: any): string | null {
  if (!value) return null;
  const v = String(value).trim();
  if (!v || v.toLowerCase() === "undefined" || v.toLowerCase() === "null") {
    return null;
  }
  return v;
}

function normalizeText(value: FormDataEntryValue | null): string | null {
  if (value == null) return null;
  const v = String(value).trim();
  return v.length > 0 ? v : null;
}

function normalizeUnit(value: FormDataEntryValue | null): string | null {
  if (!value) return null;
  const v = String(value).trim().toUpperCase();
  const ALLOWED = ["UN", "KG", "G", "L", "ML"] as const;
  return (ALLOWED as readonly string[]).includes(v) ? v : null;
}

function normalizeStockUnit(value: string | null | undefined): string {
  const v = String(value ?? "").trim().toUpperCase();
  if (!v) return "UN";
  return v;
}

async function getProductDefaultUnit(params: {
  supabase: any;
  establishmentId: string;
  productId: string;
}) {
  const { data, error } = await params.supabase
    .from("products")
    .select("default_unit_label")
    .eq("id", params.productId)
    .eq("establishment_id", params.establishmentId)
    .maybeSingle();

  if (error) {
    console.error("[products.getProductDefaultUnit] error", error);
    throw new Error("Não foi possível consultar a unidade padrão do produto.");
  }

  return normalizeStockUnit((data as any)?.default_unit_label);
}

async function ensureStockBalanceForProduct(params: {
  supabase: any;
  establishmentId: string;
  productId: string;
  unitLabel?: string | null;
}) {
  const unit_label =
    normalizeStockUnit(params.unitLabel) ||
    (await getProductDefaultUnit({
      supabase: params.supabase,
      establishmentId: params.establishmentId,
      productId: params.productId,
    }));

  const { data: rows, error: existingError } = await params.supabase
    .from("stock_balances")
    .select("id, quantity, unit_label, min_qty, med_qty, max_qty, location")
    .eq("establishment_id", params.establishmentId)
    .eq("product_id", params.productId)
    .order("id", { ascending: true });

  if (existingError) {
    console.error("[products.ensureStockBalanceForProduct] error", existingError);
    throw new Error("Não foi possível verificar o vínculo do produto com o estoque.");
  }

  const existingRows = (rows ?? []) as any[];

  if (existingRows.length === 0) {
    const { data: inserted, error: insertError } = await params.supabase
      .from("stock_balances")
      .insert({
        establishment_id: params.establishmentId,
        product_id: params.productId,
        quantity: 0,
        unit_label,
        min_qty: 0,
        med_qty: 0,
        max_qty: 0,
        location: "Estoque Principal",
      })
      .select("id")
      .maybeSingle();

    if (insertError) {
      console.error("[products.ensureStockBalanceForProduct] insert error", insertError);
      throw new Error(
        "Produto criado, mas não foi possível criar o item correspondente no estoque.",
      );
    }

    return inserted?.id as string | undefined;
  }

  if (existingRows.length === 1) {
    const onlyRow = existingRows[0];

    const { error: updateSingleError } = await params.supabase
      .from("stock_balances")
      .update({
        unit_label,
      })
      .eq("id", onlyRow.id);

    if (updateSingleError) {
      console.error(
        "[products.ensureStockBalanceForProduct] single update error",
        updateSingleError,
      );
      throw new Error(
        "Não foi possível padronizar a unidade do estoque para este produto.",
      );
    }

    return onlyRow.id as string;
  }

  const keeper = existingRows[0];
  const duplicateIds = existingRows.slice(1).map((row) => String(row.id));

  const mergedQuantity = existingRows.reduce(
    (acc, row) => acc + Number(row.quantity ?? 0),
    0,
  );

  const mergedMin = existingRows.reduce(
    (acc, row) => Math.max(acc, Number(row.min_qty ?? 0)),
    0,
  );

  const mergedMed = existingRows.reduce(
    (acc, row) => Math.max(acc, Number(row.med_qty ?? 0)),
    0,
  );

  const mergedMax = existingRows.reduce(
    (acc, row) => Math.max(acc, Number(row.max_qty ?? 0)),
    0,
  );

  const mergedLocation =
    existingRows.find((row) => String(row.location ?? "").trim())?.location ??
    "Estoque Principal";

  const { error: keeperError } = await params.supabase
    .from("stock_balances")
    .update({
      quantity: mergedQuantity,
      unit_label,
      min_qty: mergedMin,
      med_qty: mergedMed,
      max_qty: mergedMax,
      location: mergedLocation,
    })
    .eq("id", keeper.id);

  if (keeperError) {
    console.error(
      "[products.ensureStockBalanceForProduct] keeper update error",
      keeperError,
    );
    throw new Error(
      "Não foi possível consolidar registros duplicados de estoque deste produto.",
    );
  }

  if (duplicateIds.length > 0) {
    const { error: deleteError } = await params.supabase
      .from("stock_balances")
      .delete()
      .in("id", duplicateIds);

    if (deleteError) {
      console.error(
        "[products.ensureStockBalanceForProduct] duplicate delete error",
        deleteError,
      );
      throw new Error(
        "Não foi possível remover duplicidades de estoque deste produto.",
      );
    }
  }

  return keeper.id as string;
}

function safeJson(obj: any) {
  try {
    return JSON.stringify(obj);
  } catch {
    return String(obj);
  }
}

function supabaseErrorText(error: any) {
  const parts = [
    error?.message,
    error?.details ? `details: ${error.details}` : null,
    error?.hint ? `hint: ${error.hint}` : null,
    error?.code ? `code: ${error.code}` : null,
  ].filter(Boolean);

  return parts.join(" | ") || "Falha desconhecida no Supabase";
}

function redirectWithError(message: string) {
  const msg = encodeURIComponent(String(message).slice(0, 220));
  redirect(`/dashboard/produtos?error=${msg}`);
}

function isNextRedirectError(error: unknown) {
  const digest = String((error as any)?.digest ?? "");
  const message = String((error as any)?.message ?? "");
  return digest.includes("NEXT_REDIRECT") || message.includes("NEXT_REDIRECT");
}

function isMissingRelationError(error: any) {
  const code = String(error?.code ?? "");
  const message = String(error?.message ?? "").toLowerCase();

  return (
    code === "42P01" ||
    code === "42703" ||
    message.includes("does not exist") ||
    message.includes("schema cache")
  );
}

function parseNumber(value: FormDataEntryValue | null, decimals = 2) {
  const parsed = parsePtBrNumber(value, null);

  if (parsed === null) return null;

  return Number(parsed.toFixed(decimals));
}

function parseIntSafe(value: FormDataEntryValue | null): number | null {
  if (value == null) return null;
  const str = String(value).trim();
  if (!str) return null;

  const n = Number(str);
  if (Number.isNaN(n)) return null;

  const i = Math.trunc(n);
  if (i < 0) return null;

  return i;
}

function parseBoolean(value: FormDataEntryValue | null): boolean {
  if (value == null) return false;
  const s = String(value).toLowerCase().trim();
  return s === "on" || s === "true" || s === "1" || s === "yes";
}

function parseAllergens(formData: FormData): string[] {
  return normalizeAllergenList(formData.getAll("allergens"));
}

async function generateNextSku(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  establishmentId: string,
): Promise<string> {
  const pageSize = 1000;
  let from = 0;
  let maxNumericSku = 0;

  while (true) {
    const to = from + pageSize - 1;

    const { data, error } = await supabase
      .from("products")
      .select("sku")
      .eq("establishment_id", establishmentId)
      .range(from, to);

    if (error) {
      throw new Error(`Falha ao gerar SKU automático: ${error.message}`);
    }

    const rows = data ?? [];
    for (const row of rows) {
      const raw = String((row as any)?.sku ?? "").trim();
      if (!raw) continue;

      if (/^\d+$/.test(raw)) {
        const n = Number(raw);
        if (!Number.isNaN(n) && n > maxNumericSku) {
          maxNumericSku = n;
        }
      }
    }

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return String(maxNumericSku + 1);
}

async function getMembershipIds() {
  const supabase = await createSupabaseServerClient();

  const membership = await getActiveMembershipOrRedirect();
  const establishmentFromHelper = normalizeId(
    (membership as any)?.establishment_id,
  );
  const userIdFromHelper = normalizeId((membership as any)?.user_id) ?? null;

  console.log(
    "[products.membership] helper",
    safeJson({
      establishment_id: (membership as any)?.establishment_id ?? null,
      user_id: (membership as any)?.user_id ?? null,
      role: (membership as any)?.role ?? null,
      is_active: (membership as any)?.is_active ?? null,
    }),
  );

  if (establishmentFromHelper) {
    return {
      establishmentId: establishmentFromHelper as string,
      userId: userIdFromHelper,
    };
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError) {
    console.error("[products.membership] auth.getUser error", safeJson(authError));
    redirect("/dashboard/produtos?error=usuario_nao_autenticado");
  }

  const authUserId = normalizeId(authData?.user?.id);
  if (!authUserId) {
    redirect("/dashboard/produtos?error=usuario_nao_autenticado");
  }

  const { data: mData, error: mError } = await supabase
    .from("memberships")
    .select("establishment_id, user_id, role, is_active, created_at")
    .eq("user_id", authUserId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (mError) {
    console.error(
      "[products.membership] memberships lookup error",
      safeJson(mError),
    );
    redirectWithError(supabaseErrorText(mError));
  }

  const establishmentId = normalizeId(mData?.establishment_id);
  const userId = normalizeId(mData?.user_id) ?? authUserId;

  if (!establishmentId) {
    redirect("/dashboard/produtos?error=estabelecimento_nao_encontrado");
  }

  return {
    establishmentId: establishmentId as string,
    userId,
  };
}

async function productHasHistory(params: {
  supabase: any;
  establishmentId: string;
  productId: string;
}) {
  const checks = [
    {
      table: "inventory_movements",
      filters: (q: any) =>
        q
          .eq("establishment_id", params.establishmentId)
          .eq("product_id", params.productId),
    },
    {
      table: "inventory_items",
      filters: (q: any) => q.eq("product_id", params.productId),
    },
  ];

  for (const check of checks) {
    try {
      let query = params.supabase
        .from(check.table)
        .select("id", { count: "exact", head: true });

      query = check.filters(query);

      const { count, error } = await query;

      if (!error && Number(count ?? 0) > 0) {
        return true;
      }
    } catch {
      // mantém compatibilidade sem quebrar
    }
  }

  return false;
}

async function deactivateProduct(params: {
  supabase: any;
  establishmentId: string;
  productId: string;
  userId?: string | null;
}) {
  const payload: Record<string, any> = {
    is_active: false,
  };

  if (params.userId) {
    payload.updated_by = params.userId;
    payload.updated_at = new Date().toISOString();
  }

  const { error } = await params.supabase
    .from("products")
    .update(payload)
    .eq("id", params.productId)
    .eq("establishment_id", params.establishmentId);

  if (error) {
    console.error(
      "[products.deactivateProduct] error",
      safeJson({
        message: error.message,
        code: (error as any)?.code,
        details: (error as any)?.details,
        hint: (error as any)?.hint,
        productId: params.productId,
      }),
    );
    throw new Error("Não foi possível inativar o produto que possui histórico.");
  }
}

async function deleteKnownProductDependenciesAdmin(params: {
  adminSupabase: any;
  productId: string;
}) {
  const operations = [
    "inventory_items",
    "inventory_movements",
    "inventory_count_items",
    "stock_movements",
    "stock_balances",
    "recipe_items",
    "recipe_components",
    "technical_sheet_items",
    "technical_sheet_components",
    "ficha_tecnica_itens",
    "fichas_tecnicas_itens",
    "production_items",
    "pedido_items",
    "order_items",
  ];

  for (const table of operations) {
    const { error } = await params.adminSupabase
      .from(table)
      .delete()
      .eq("product_id", params.productId);

    if (error && !isMissingRelationError(error)) {
      console.error(
        "[products.deleteKnownProductDependenciesAdmin] delete error",
        safeJson({
          table,
          message: error.message,
          code: (error as any)?.code,
          details: (error as any)?.details,
          hint: (error as any)?.hint,
          productId: params.productId,
        }),
      );
      throw new Error(
        `Não foi possível remover os vínculos do produto na tabela ${table}.`,
      );
    }
  }
}

function revalidateProductAndStockPages() {
  revalidatePath("/dashboard/produtos");
  revalidatePath("/dashboard/estoque");
}

export async function createProduct(formData: FormData) {
  const { establishmentId, userId } = await getMembershipIds();
  const supabase = await createSupabaseServerClient();

  const name = String(formData.get("name") ?? "").trim();
  const product_type = (formData.get("product_type") as ProductType) ?? "INSU";
  const default_unit_label =
    normalizeUnit(formData.get("default_unit_label")) ?? "UN";

  const skuRaw = formData.get("sku");
  const brandRaw = formData.get("brand");
  const categoryRaw = formData.get("category");
  const sectorCategoryRaw = formData.get("sector_category");
  const abcCurveRaw = formData.get("abc_curve");
  const shelfLifeRaw = formData.get("shelf_life_days");
  const priceRaw = formData.get("price");
  const packageQtyRaw = formData.get("package_qty");
  const qtyPerPackageRaw = formData.get("qty_per_package");
  const conversionRaw = formData.get("conversion_factor");
  const allergens = parseAllergens(formData);

  if (!name) {
    redirectWithError("Nome do produto é obrigatório.");
  }

  try {
    await assertBillingLimitAvailable({
      supabaseAdmin: getSupabaseAdminClient(),
      establishmentId,
      kind: "products",
    });
  } catch (limitError: any) {
    redirectWithError(limitError?.message ?? "Limite de produtos do plano atingido.");
  }

  const package_qty = parseNumber(packageQtyRaw, 3);
  const price = parseNumber(priceRaw, 5);
  const conversion_factor = parseNumber(conversionRaw, 4);
  const shelf_life_days = parseIntSafe(shelfLifeRaw);

  let sku =
    skuRaw && String(skuRaw).trim().length > 0 ? String(skuRaw).trim() : null;

  if (!sku) {
    try {
      sku = await generateNextSku(supabase, establishmentId);
    } catch (err: any) {
      redirectWithError(err?.message ?? "Falha ao gerar SKU automático.");
    }
  }

  const brand = normalizeText(brandRaw);

  const category =
    categoryRaw && String(categoryRaw).trim().length > 0
      ? String(categoryRaw).trim()
      : null;

  const qty_per_package =
    qtyPerPackageRaw && String(qtyPerPackageRaw).trim().length > 0
      ? String(qtyPerPackageRaw).trim()
      : null;

  const sector_category = normalizeText(sectorCategoryRaw);
  const normalizedSectorCategory =
    normalizeProductSectorCategory(sector_category);

  const abc_curve = normalizeProductAbcCurve(abcCurveRaw);

  const insertData: any = {
    establishment_id: establishmentId,
    name,
    sku,
    brand,
    product_type,
    default_unit_label,
    package_qty: package_qty ?? null,
    qty_per_package,
    category,
    sector_category: normalizedSectorCategory,
    abc_curve,
    shelf_life_days,
    conversion_factor: conversion_factor ?? 1,
    price: price ?? 0,
    standard_cost: null,
    allergens,
    is_active: true,
    ...(userId ? { created_by: userId } : {}),
  };

  let { data, error } = await supabase
    .from("products")
    .insert(insertData)
    .select("id")
    .maybeSingle();

  if (isProductSectorConstraintError(error) && insertData.sector_category) {
    const retryData = {
      ...insertData,
      sector_category: null,
    };

    ({ data, error } = await supabase
      .from("products")
      .insert(retryData)
      .select("id")
      .maybeSingle());

    if (!error) {
      insertData.sector_category = null;
    }
  }

  if (isProductAbcConstraintError(error) && insertData.abc_curve) {
    const retryData = {
      ...insertData,
      abc_curve: null,
    };

    ({ data, error } = await supabase
      .from("products")
      .insert(retryData)
      .select("id")
      .maybeSingle());

    if (!error) {
      insertData.abc_curve = null;
    }
  }

  if (error) {
    console.error(
      "[products.create] error",
      safeJson({
        message: error.message,
        code: (error as any).code,
        details: (error as any).details,
        hint: (error as any).hint,
        establishmentId,
        userId,
        insertData,
      }),
    );

    redirectWithError(supabaseErrorText(error));
  }

  if (!data?.id) {
    redirectWithError(
      "Produto não foi criado (sem permissão/RLS ou nenhuma linha inserida).",
    );
  }

  const createdProductId = String(data!.id);

  try {
    await ensureStockBalanceForProduct({
      supabase,
      establishmentId,
      productId: createdProductId,
      unitLabel: default_unit_label,
    });
  } catch (stockError: any) {
    redirectWithError(
      stockError?.message ??
        "Produto criado, mas houve falha ao sincronizar com o estoque.",
    );
  }

  revalidateProductAndStockPages();
  redirect("/dashboard/produtos?success=new");
}

export async function updateProduct(formData: FormData) {
  const { establishmentId, userId } = await getMembershipIds();
  const supabase = await createSupabaseServerClient();
  const adminSupabase = getSupabaseAdminClient();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    redirectWithError("ID do produto é obrigatório para edição.");
  }

  const name = String(formData.get("name") ?? "").trim();
  const product_type = (formData.get("product_type") as ProductType) ?? "INSU";
  const default_unit_label =
    normalizeUnit(formData.get("default_unit_label")) ?? "UN";

  const skuRaw = formData.get("sku");
  const brandRaw = formData.get("brand");
  const categoryRaw = formData.get("category");
  const sectorCategoryRaw = formData.get("sector_category");
  const abcCurveRaw = formData.get("abc_curve");
  const shelfLifeRaw = formData.get("shelf_life_days");
  const priceRaw = formData.get("price");
  const packageQtyRaw = formData.get("package_qty");
  const qtyPerPackageRaw = formData.get("qty_per_package");
  const conversionRaw = formData.get("conversion_factor");
  const isActiveRaw = formData.get("is_active");
  const allergens = parseAllergens(formData);

  if (!name) {
    redirectWithError("Nome do produto é obrigatório.");
  }

  const package_qty = parseNumber(packageQtyRaw, 3);
  const price = parseNumber(priceRaw, 5);
  const conversion_factor = parseNumber(conversionRaw, 4);
  const shelf_life_days = parseIntSafe(shelfLifeRaw);

  const sku =
    skuRaw && String(skuRaw).trim().length > 0 ? String(skuRaw).trim() : null;

  const brand = normalizeText(brandRaw);

  const category =
    categoryRaw && String(categoryRaw).trim().length > 0
      ? String(categoryRaw).trim()
      : null;

  const qty_per_package =
    qtyPerPackageRaw && String(qtyPerPackageRaw).trim().length > 0
      ? String(qtyPerPackageRaw).trim()
      : null;

  const is_active = parseBoolean(isActiveRaw);
  const sector_category = normalizeText(sectorCategoryRaw);
  const normalizedSectorCategory =
    normalizeProductSectorCategory(sector_category);
  const abc_curve = normalizeProductAbcCurve(abcCurveRaw);

  const updateData: any = {
    name,
    sku,
    brand,
    product_type,
    default_unit_label,
    package_qty: package_qty ?? null,
    qty_per_package,
    category,
    sector_category: normalizedSectorCategory,
    abc_curve,
    shelf_life_days,
    price: price ?? 0,
    conversion_factor: conversion_factor ?? 1,
    allergens,
    is_active,
    ...(userId
      ? {
          updated_by: userId,
          updated_at: new Date().toISOString(),
        }
      : {}),
  };

  let { data, error } = await supabase
    .from("products")
    .update(updateData)
    .eq("id", id)
    .eq("establishment_id", establishmentId)
    .select("id")
    .maybeSingle();

  if (isProductSectorConstraintError(error) && updateData.sector_category) {
    const retryData = {
      ...updateData,
      sector_category: null,
    };

    ({ data, error } = await supabase
      .from("products")
      .update(retryData)
      .eq("id", id)
      .eq("establishment_id", establishmentId)
      .select("id")
      .maybeSingle());

    if (!error) {
      updateData.sector_category = null;
    }
  }

  if (isProductAbcConstraintError(error) && updateData.abc_curve) {
    const retryData = {
      ...updateData,
      abc_curve: null,
    };

    ({ data, error } = await supabase
      .from("products")
      .update(retryData)
      .eq("id", id)
      .eq("establishment_id", establishmentId)
      .select("id")
      .maybeSingle());

    if (!error) {
      updateData.abc_curve = null;
    }
  }

  if (error) {
    console.error(
      "[products.update] error",
      safeJson({
        message: error.message,
        code: (error as any).code,
        details: (error as any).details,
        hint: (error as any).hint,
        establishmentId,
        userId,
        id,
        updateData,
      }),
    );

    redirectWithError(supabaseErrorText(error));
  }

  if (!data?.id) {
    redirectWithError(
      "Não foi possível salvar: produto não encontrado ou sem permissão (RLS).",
    );
  }

  try {
    await ensureStockBalanceForProduct({
      supabase: adminSupabase,
      establishmentId,
      productId: id,
      unitLabel: default_unit_label,
    });
  } catch (stockError: any) {
    console.error(
      "[products.update] produto atualizado, mas falhou ao sincronizar estoque",
      safeJson({
        productId: id,
        establishmentId,
        unitLabel: default_unit_label,
        message: stockError?.message,
        code: stockError?.code,
        details: stockError?.details,
      }),
    );
  }

  revalidateProductAndStockPages();
  redirect("/dashboard/produtos?success=updated");
}

export async function deleteProduct(formData: FormData) {
  const { establishmentId, userId } = await getMembershipIds();
  const supabase = await createSupabaseServerClient();
  const adminSupabase = getSupabaseAdminClient();

  const id = String(formData.get("id") ?? "").trim();
  const deleteSecurityPassword = String(
    formData.get("delete_security_password") ?? "",
  ).trim();

  if (!id) {
    redirectWithError("ID do produto é obrigatório para exclusão.");
  }

  if (deleteSecurityPassword && deleteSecurityPassword !== "123456") {
    redirectWithError("Senha de segurança inválida para exclusão definitiva.");
  }

  const { data: productBeforeDelete, error: productLookupError } = await supabase
    .from("products")
    .select("id, name, default_unit_label, is_active")
    .eq("id", id)
    .eq("establishment_id", establishmentId)
    .maybeSingle();

  if (productLookupError) {
    redirectWithError("Não foi possível localizar o produto para exclusão.");
  }

  if (!productBeforeDelete?.id) {
    redirectWithError(
      "Não foi possível excluir: produto não encontrado ou sem permissão.",
    );
  }

  try {
    await deleteKnownProductDependenciesAdmin({
      adminSupabase,
      productId: id,
    });
  } catch (dependencyError: any) {
    if (isNextRedirectError(dependencyError)) {
      throw dependencyError;
    }

    redirectWithError(
      dependencyError?.message ??
        "Não foi possível remover os vínculos do produto antes da exclusão.",
    );
  }

  const { data, error } = await adminSupabase
    .from("products")
    .delete()
    .eq("id", id)
    .eq("establishment_id", establishmentId)
    .select("id")
    .maybeSingle();

  if (error) {
    redirectWithError(supabaseErrorText(error));
  }

  if (!data?.id) {
    redirectWithError(
      "Não foi possível excluir: produto não encontrado após a limpeza dos vínculos.",
    );
  }

  console.log(
    "[products.delete] ok",
    safeJson({
      id: data?.id,
      establishmentId,
      userId,
      forced: true,
    }),
  );

  revalidateProductAndStockPages();
  redirect("/dashboard/produtos?success=deleted");
}
