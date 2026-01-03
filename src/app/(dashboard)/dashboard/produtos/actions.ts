// src/app/(dashboard)/dashboard/produtos/_actions.ts
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
 * Pega IDs do membership sem quebrar se não tiver establishment
 * e sem obrigar user_id (fica opcional).
 *
 * ✅ AJUSTE: seu banco NÃO tem organization_id na memberships,
 * então aqui usamos SOMENTE establishment_id.
 */
async function getMembershipIds() {
  const membership = await getActiveMembershipOrRedirect();
  const { establishment_id, user_id } = membership as any;

  const establishmentId = normalizeId(establishment_id);
  const userId = normalizeId(user_id) ?? null;

  if (!establishmentId) {
    throw new Error("Estabelecimento não encontrado no membership.");
  }

  return {
    establishmentId,
    userId,
  };
}

/**
 * Faz parse numérico seguro, sempre evitando retornar NaN.
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
 * Checkbox pode chegar como "on" (HTML), "true" (alguns forms) ou null
 */
function parseBoolean(value: FormDataEntryValue | null): boolean {
  if (value == null) return false;
  const s = String(value).toLowerCase().trim();
  return s === "on" || s === "true" || s === "1" || s === "yes";
}

/**
 * Log seguro (não explode circular) para Vercel Logs
 */
function safeJson(obj: any) {
  try {
    return JSON.stringify(obj);
  } catch {
    return String(obj);
  }
}

/* =========================================================
   CREATE PRODUCT
   ========================================================= */

export async function createProduct(formData: FormData) {
  const { establishmentId, userId } = await getMembershipIds();
  const supabase = await createSupabaseServerClient();

  const name = String(formData.get("name") ?? "").trim();
  const product_type = (formData.get("product_type") as ProductType) ?? "INSU";
  const default_unit_label = String(
    formData.get("default_unit_label") ?? "un",
  ).trim();

  const skuRaw = formData.get("sku");
  const categoryRaw = formData.get("category");
  const priceRaw = formData.get("price");
  const packageQtyRaw = formData.get("package_qty");
  const qtyPerPackageRaw = formData.get("qty_per_package");
  const conversionRaw = formData.get("conversion_factor");

  if (!name) throw new Error("Nome do produto é obrigatório.");

  const package_qty = parseNumber(packageQtyRaw, 3);
  const price = parseNumber(priceRaw, 2);
  const conversion_factor = parseNumber(conversionRaw, 4);

  const sku =
    skuRaw && String(skuRaw).trim().length > 0 ? String(skuRaw).trim() : null;

  const category =
    categoryRaw && String(categoryRaw).trim().length > 0
      ? String(categoryRaw).trim()
      : null;

  const qty_per_package =
    qtyPerPackageRaw && String(qtyPerPackageRaw).trim().length > 0
      ? String(qtyPerPackageRaw).trim()
      : null;

  const insertData: any = {
    establishment_id: establishmentId,
    name,
    sku,
    product_type,
    default_unit_label,
    package_qty: package_qty ?? null,
    qty_per_package,
    category,
    conversion_factor: conversion_factor ?? 1,
    price: price ?? 0,
    standard_cost: null,
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
    throw new Error(error.message ?? "Falha ao criar produto.");
  }

  console.log(
    "[products.create] ok",
    safeJson({ id: data?.id, establishmentId, userId }),
  );

  revalidatePath("/dashboard/produtos");
  redirect("/dashboard/produtos?success=new");
}

/* =========================================================
   UPDATE PRODUCT
   ========================================================= */

export async function updateProduct(formData: FormData) {
  const { establishmentId, userId } = await getMembershipIds();
  const supabase = await createSupabaseServerClient();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("ID do produto é obrigatório para edição.");

  const name = String(formData.get("name") ?? "").trim();
  const product_type = (formData.get("product_type") as ProductType) ?? "INSU";
  const default_unit_label = String(
    formData.get("default_unit_label") ?? "un",
  ).trim();

  const skuRaw = formData.get("sku");
  const categoryRaw = formData.get("category");
  const priceRaw = formData.get("price");
  const packageQtyRaw = formData.get("package_qty");
  const qtyPerPackageRaw = formData.get("qty_per_package");
  const conversionRaw = formData.get("conversion_factor");
  const isActiveRaw = formData.get("is_active");

  if (!name) throw new Error("Nome do produto é obrigatório.");

  const package_qty = parseNumber(packageQtyRaw, 3);
  const price = parseNumber(priceRaw, 2);
  const conversion_factor = parseNumber(conversionRaw, 4);

  const sku =
    skuRaw && String(skuRaw).trim().length > 0 ? String(skuRaw).trim() : null;

  const category =
    categoryRaw && String(categoryRaw).trim().length > 0
      ? String(categoryRaw).trim()
      : null;

  const qty_per_package =
    qtyPerPackageRaw && String(qtyPerPackageRaw).trim().length > 0
      ? String(qtyPerPackageRaw).trim()
      : null;

  const is_active = parseBoolean(isActiveRaw);

  const updateData: any = {
    name,
    sku,
    product_type,
    default_unit_label,
    package_qty: package_qty ?? null,
    qty_per_package,
    category,
    price: price ?? 0,
    conversion_factor: conversion_factor ?? 1,
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
    .eq("establishment_id", establishmentId)
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
    throw new Error(error.message ?? "Falha ao atualizar produto.");
  }

  console.log(
    "[products.update] ok",
    safeJson({ id: data?.id, establishmentId, userId }),
  );

  revalidatePath("/dashboard/produtos");
  redirect("/dashboard/produtos?success=updated");
}
