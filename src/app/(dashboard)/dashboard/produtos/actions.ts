// src/app/(dashboard)/dashboard/produtos/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";

export type ProductType = "INSU" | "PREP" | "PROD";

/**
 * Normaliza possível ID para evitar "undefined"/"null" em string.
 */
function normalizeId(value: any): string | null {
  if (!value) return null;
  const v = String(value).trim();
  if (!v || v.toLowerCase() === "undefined" || v.toLowerCase() === "null") {
    return null;
  }
  return v;
}

/**
 * Normaliza texto (string) para:
 * - null quando vazio
 * - string trim quando preenchido
 */
function normalizeText(value: FormDataEntryValue | null): string | null {
  if (value == null) return null;
  const v = String(value).trim();
  return v.length > 0 ? v : null;
}

/**
 * Normaliza unidade para evitar inconsistência.
 */
function normalizeUnit(value: FormDataEntryValue | null): string | null {
  if (!value) return null;
  const v = String(value).trim().toUpperCase();
  const ALLOWED = ["UN", "KG", "G", "L", "ML"] as const;
  return (ALLOWED as readonly string[]).includes(v) ? v : null;
}

/**
 * Log seguro.
 */
function safeJson(obj: any) {
  try {
    return JSON.stringify(obj);
  } catch {
    return String(obj);
  }
}

/**
 * Converte erro do Supabase em texto curto pra querystring
 */
function supabaseErrorText(error: any) {
  const parts = [
    error?.message,
    error?.details ? `details: ${error.details}` : null,
    error?.hint ? `hint: ${error.hint}` : null,
    error?.code ? `code: ${error.code}` : null,
  ].filter(Boolean);
  return parts.join(" | ") || "Falha desconhecida no Supabase";
}

/**
 * Redireciona com erro sem derrubar a página.
 */
function redirectWithError(message: string) {
  const msg = encodeURIComponent(String(message).slice(0, 180));
  redirect(`/dashboard/produtos?error=${msg}`);
}

/**
 * Faz parse numérico seguro.
 */
function parseNumber(
  value: FormDataEntryValue | null,
  decimals: number = 3,
): number | null {
  if (value == null) return null;
  const str = String(value).replace(",", ".").trim();
  if (!str) return null;
  const n = Number(str);
  if (Number.isNaN(n)) return null;
  return Number(n.toFixed(decimals));
}

/**
 * Parse inteiro seguro.
 */
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

/**
 * Checkbox pode chegar como "on", "true" etc.
 */
function parseBoolean(value: FormDataEntryValue | null): boolean {
  if (value == null) return false;
  const s = String(value).toLowerCase().trim();
  return s === "on" || s === "true" || s === "1" || s === "yes";
}

function parseAllergens(formData: FormData): string[] {
  return formData
    .getAll("allergens")
    .map((item) => String(item).trim())
    .filter(Boolean);
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

/**
 * Membership robusto.
 */
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
    console.error("[products.membership] memberships lookup error", safeJson(mError));
    redirectWithError(supabaseErrorText(mError));
  }

  const establishmentId = normalizeId(mData?.establishment_id);
  const userId = normalizeId(mData?.user_id) ?? authUserId;

  console.log(
    "[products.membership] fallback",
    safeJson({
      authUserId,
      membershipFound: Boolean(mData),
      establishment_id: mData?.establishment_id ?? null,
      role: mData?.role ?? null,
      is_active: mData?.is_active ?? null,
    }),
  );

  if (!establishmentId) {
    redirect("/dashboard/produtos?error=estabelecimento_nao_encontrado");
  }

  return {
    establishmentId: establishmentId as string,
    userId,
  };
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
  const shelfLifeRaw = formData.get("shelf_life_days");
  const priceRaw = formData.get("price");
  const packageQtyRaw = formData.get("package_qty");
  const qtyPerPackageRaw = formData.get("qty_per_package");
  const conversionRaw = formData.get("conversion_factor");
  const allergens = parseAllergens(formData);
  if (!name) {
    redirectWithError("Nome do produto é obrigatório.");
  }
  const package_qty = parseNumber(packageQtyRaw, 3);
  const price = parseNumber(priceRaw, 2);
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
    sector_category,
    shelf_life_days,
    conversion_factor: conversion_factor ?? 1,
    price: price ?? 0,
    standard_cost: null,
    allergens,
    is_active: true,
    ...(userId ? { created_by: userId } : {}),
  };

  const { data, error } = await supabase
    .from("products")
    .insert(insertData)
    .select("id")
    .maybeSingle();

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
    console.error(
      "[products.create] no-row",
      safeJson({ establishmentId, userId, insertData }),
    );
    redirectWithError(
      "Produto não foi criado (sem permissão/RLS ou nenhuma linha inserida).",
    );
  }

  console.log(
    "[products.create] ok",
    safeJson({
      id: data?.id,
      establishmentId,
      userId,
      sku,
      brand,
      sector_category,
      shelf_life_days,
    }),
  );

  revalidatePath("/dashboard/produtos");
  redirect("/dashboard/produtos?success=new");
}

export async function updateProduct(formData: FormData) {
  const { establishmentId, userId } = await getMembershipIds();
  const supabase = await createSupabaseServerClient();
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
  const price = parseNumber(priceRaw, 2);
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

  const updateData: any = {
    name,
    sku,
    brand,
    product_type,
    default_unit_label,
    package_qty: package_qty ?? null,
    qty_per_package,
    category,
    sector_category,
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

  const { data, error } = await supabase
    .from("products")
    .update(updateData)
    .eq("id", id)
    .select("id")
    .maybeSingle();

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
    console.error(
      "[products.update] no-row-updated",
      safeJson({
        establishmentId,
        userId,
        id,
        updateData,
        note: "Nenhuma linha atualizada. Possível RLS/policy bloqueando ou produto não pertence ao usuário.",
      }),
    );
    redirectWithError(
      "Não foi possível salvar: produto não encontrado ou sem permissão (RLS).",
    );
  }

  console.log(
    "[products.update] ok",
    safeJson({
      id: data?.id,
      establishmentId,
      userId,
      brand,
      sector_category,
      shelf_life_days,
    }),
  );

  revalidatePath("/dashboard/produtos");
  redirect("/dashboard/produtos?success=updated");
}

/* =========================================================
   DELETE PRODUCT
   ========================================================= */

export async function deleteProduct(formData: FormData) {
  const { establishmentId, userId } = await getMembershipIds();
  const supabase = await createSupabaseServerClient();

  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    redirectWithError("ID do produto é obrigatório para exclusão.");
  }

  const { data, error } = await supabase
    .from("products")
    .delete()
    .eq("id", id)
    .eq("establishment_id", establishmentId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(
      "[products.delete] error",
      safeJson({
        message: error.message,
        code: (error as any).code,
        details: (error as any).details,
        hint: (error as any).hint,
        establishmentId,
        userId,
        id,
      }),
    );

    const errorText = supabaseErrorText(error);

    if (
      errorText.toLowerCase().includes("foreign key") ||
      errorText.toLowerCase().includes("violates foreign key constraint")
    ) {
      redirectWithError(
        "Não foi possível excluir: este insumo já está vinculado a outros registros do sistema."
      );
    }

    redirectWithError(errorText);
  }

  if (!data?.id) {
    console.error(
      "[products.delete] no-row-deleted",
      safeJson({
        establishmentId,
        userId,
        id,
        note: "Nenhuma linha excluída. Possível RLS/policy bloqueando ou produto não pertence ao usuário.",
      }),
    );
    redirectWithError(
      "Não foi possível excluir: produto não encontrado ou sem permissão."
    );
  }

  console.log(
    "[products.delete] ok",
    safeJson({
      id: data?.id,
      establishmentId,
      userId,
    }),
  );

  revalidatePath("/dashboard/produtos");
  redirect("/dashboard/produtos?success=deleted");
}