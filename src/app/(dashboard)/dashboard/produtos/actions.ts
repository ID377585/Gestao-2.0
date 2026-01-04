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
 * Log seguro (não explode circular) para Vercel Logs
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
 * Redireciona com erro sem derrubar a página (evita Digest)
 */
function redirectWithError(message: string) {
  const msg = encodeURIComponent(String(message).slice(0, 180)); // evita URL gigante
  redirect(`/dashboard/produtos?error=${msg}`);
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
 * ✅ MELHORIA CRÍTICA:
 * Se o helper getActiveMembershipOrRedirect NÃO trouxer establishment_id,
 * fazemos fallback consultando a tabela memberships.
 *
 * Isso resolve o seu erro: ?error=estabelecimento_nao_encontrado
 */
async function getMembershipIds() {
  const supabase = await createSupabaseServerClient();

  // 1) Tenta pegar membership do helper (fluxo atual/validado)
  const membership = await getActiveMembershipOrRedirect();
  const establishmentFromHelper = normalizeId((membership as any)?.establishment_id);
  const userIdFromHelper = normalizeId((membership as any)?.user_id) ?? null;

  // ✅ Debug: ajuda a enxergar no Vercel logs quando der erro
  console.log(
    "[products.membership] helper",
    safeJson({
      establishment_id: (membership as any)?.establishment_id ?? null,
      user_id: (membership as any)?.user_id ?? null,
      role: (membership as any)?.role ?? null,
      is_active: (membership as any)?.is_active ?? null,
    }),
  );

  // 2) Se veio do helper, ok
  if (establishmentFromHelper) {
    return {
      establishmentId: establishmentFromHelper as string,
      userId: userIdFromHelper,
    };
  }

  // 3) Fallback: pegar user_id do auth + consultar memberships diretamente
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError) {
    console.error("[products.membership] auth.getUser error", safeJson(authError));
    redirect("/dashboard/produtos?error=usuario_nao_autenticado");
  }

  const authUserId = normalizeId(authData?.user?.id);
  if (!authUserId) {
    redirect("/dashboard/produtos?error=usuario_nao_autenticado");
  }

  // Busca o membership ativo mais recente do usuário
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

  if (!name) {
    redirectWithError("Nome do produto é obrigatório.");
  }

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
  if (!id) {
    redirectWithError("ID do produto é obrigatório para edição.");
  }

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

  if (!name) {
    redirectWithError("Nome do produto é obrigatório.");
  }

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

  // ✅ Mantido como você já tinha validado (sem .eq(establishment_id))
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
    safeJson({ id: data?.id, establishmentId, userId }),
  );

  revalidatePath("/dashboard/produtos");
  redirect("/dashboard/produtos?success=updated");
}
