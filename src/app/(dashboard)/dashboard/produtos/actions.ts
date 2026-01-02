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
 * Pega IDs do membership sem quebrar se não tiver establishment
 * e sem obrigar user_id (fica opcional).
 */
async function getMembershipIds() {
  const membership = await getActiveMembershipOrRedirect();
  const { organization_id, establishment_id, user_id } = membership as any;

  const establishmentId =
    normalizeId(establishment_id) ?? normalizeId(organization_id);

  // userId agora é OPCIONAL (pode ser null)
  const userId = normalizeId(user_id) ?? null;

  return {
    establishmentId, // string | null
    userId, // string | null
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

/* =========================================================
   CREATE PRODUCT
   ========================================================= */

export async function createProduct(formData: FormData) {
  const { establishmentId, userId } = await getMembershipIds();
  const supabase = await createSupabaseServerClient();

  const name = (formData.get("name") as string)?.trim();
  const product_type = formData.get("product_type") as ProductType;
  const skuRaw = formData.get("sku");
  const default_unit_label = (formData.get("default_unit_label") as string)?.trim();
  const categoryRaw = formData.get("category");
  const priceRaw = formData.get("price");
  const packageQtyRaw = formData.get("package_qty");
  const qtyPerPackageRaw = formData.get("qty_per_package"); // TEXTO
  const conversionRaw = formData.get("conversion_factor");

  if (!name) {
    throw new Error("Nome do produto é obrigatório.");
  }

  // Campos numéricos
  const package_qty = parseNumber(packageQtyRaw, 3);
  const price = parseNumber(priceRaw, 2);
  const conversion_factor = parseNumber(conversionRaw, 4);

  // SKU opcional
  const sku =
    skuRaw && String(skuRaw).trim().length > 0
      ? String(skuRaw).trim()
      : null;

  // Categoria opcional
  const category =
    categoryRaw && String(categoryRaw).trim().length > 0
      ? String(categoryRaw).trim()
      : null;

  // qty_per_package AGORA É STRING/TEXTO LIVRE
  const qty_per_package =
    qtyPerPackageRaw && String(qtyPerPackageRaw).trim().length > 0
      ? String(qtyPerPackageRaw).trim()
      : null;

  const insertData: any = {
    name,
    sku,
    product_type,
    default_unit_label,
    package_qty,
    qty_per_package, // string | null
    category,
    conversion_factor: conversion_factor ?? 1,
    price: price ?? 0,
    standard_cost: null,
    is_active: true,
  };

  if (establishmentId) {
    insertData.establishment_id = establishmentId;
  }

  if (userId) {
    insertData.created_by = userId;
  }

  const { error } = await supabase.from("products").insert(insertData);

  if (error) {
    console.error("Erro ao criar produto", error);
    throw error;
  }

  // Atualiza a lista
  revalidatePath("/dashboard/produtos");

  // Fecha o modal e volta com mensagem de sucesso
  redirect("/dashboard/produtos?success=new");
}

/* =========================================================
   UPDATE PRODUCT
   ========================================================= */

export async function updateProduct(formData: FormData) {
  const { userId } = await getMembershipIds();
  const supabase = await createSupabaseServerClient();

  const id = formData.get("id") as string;
  if (!id) {
    throw new Error("ID do produto é obrigatório para edição.");
  }

  const name = (formData.get("name") as string)?.trim();
  const product_type = formData.get("product_type") as ProductType;
  const skuRaw = formData.get("sku");
  const default_unit_label = (formData.get("default_unit_label") as string)?.trim();
  const categoryRaw = formData.get("category");
  const priceRaw = formData.get("price");
  const packageQtyRaw = formData.get("package_qty");
  const qtyPerPackageRaw = formData.get("qty_per_package"); // TEXTO
  const conversionRaw = formData.get("conversion_factor");
  const isActiveRaw = formData.get("is_active");

  // Numéricos
  const package_qty = parseNumber(packageQtyRaw, 3);
  const price = parseNumber(priceRaw, 2);
  const conversion_factor = parseNumber(conversionRaw, 4);

  // SKU opcional
  const sku =
    skuRaw && String(skuRaw).trim().length > 0
      ? String(skuRaw).trim()
      : null;

  // Categoria opcional
  const category =
    categoryRaw && String(categoryRaw).trim().length > 0
      ? String(categoryRaw).trim()
      : null;

  // qty_per_package como STRING (igual createProduct)
  const qty_per_package =
    qtyPerPackageRaw && String(qtyPerPackageRaw).trim().length > 0
      ? String(qtyPerPackageRaw).trim()
      : null;

  const is_active = isActiveRaw === "on";

  const updateData: any = {
    name,
    sku,
    product_type,
    default_unit_label,
    package_qty,
    qty_per_package, // string | null
    category,
    price,
    conversion_factor,
    is_active,
  };

  if (userId) {
    updateData.updated_by = userId;
    updateData.updated_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("products")
    .update(updateData)
    .eq("id", id);

  if (error) {
    console.error("Erro ao atualizar produto", error);
    throw error;
  }

  revalidatePath("/dashboard/produtos");
  redirect("/dashboard/produtos?success=updated");
}
