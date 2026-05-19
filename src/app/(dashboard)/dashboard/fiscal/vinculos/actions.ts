"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";

async function getContext() {
  const supabase = await createSupabaseServerClient();
  const { membership } = await getActiveMembershipOrRedirect();
  const establishmentId = (membership as any)?.establishment_id;

  if (!establishmentId) {
    throw new Error("Estabelecimento não encontrado.");
  }

  return { supabase, establishmentId: String(establishmentId) };
}

function text(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function normalize(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase()
    .trim();
}

async function assertProductBelongsToEstablishment(params: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  establishmentId: string;
  productId: string;
}) {
  const { data, error } = await params.supabase
    .from("products")
    .select("id")
    .eq("id", params.productId)
    .eq("establishment_id", params.establishmentId)
    .maybeSingle();

  if (error) {
    console.error("Erro ao validar produto do vínculo fiscal:", error);
    throw new Error("Não foi possível validar o produto selecionado.");
  }

  if (!data?.id) {
    throw new Error("Produto inválido para a empresa ativa.");
  }
}

export async function listFiscalProductMappingsAction() {
  const { supabase, establishmentId } = await getContext();

  const { data, error } = await supabase
    .from("fiscal_product_mappings")
    .select("*, products(id, name, sku, default_unit_label, standard_cost, price)")
    .eq("establishment_id", establishmentId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error(error);
    throw new Error("Não foi possível carregar os vínculos fiscais de produtos.");
  }

  return data ?? [];
}

export async function listProductsForFiscalMappingAction() {
  const { supabase, establishmentId } = await getContext();

  const { data, error } = await supabase
    .from("products")
    .select("id, name, sku, default_unit_label, standard_cost, price")
    .eq("establishment_id", establishmentId)
    .order("name", { ascending: true });

  if (error) {
    console.error(error);
    throw new Error("Não foi possível carregar produtos.");
  }

  return data ?? [];
}

export async function saveFiscalProductMappingAction(formData: FormData) {
  const { supabase, establishmentId } = await getContext();

  const productId = text(formData.get("product_id"));
  const supplierDocument = text(formData.get("supplier_document"));
  const xmlCode = text(formData.get("xml_code"));
  const xmlEan = text(formData.get("xml_ean"));
  const xmlDescription = text(formData.get("xml_description"));
  const xmlUnit = text(formData.get("xml_unit"));

  if (!productId) {
    throw new Error("Selecione o produto interno.");
  }

  if (!xmlCode && !xmlEan && !xmlDescription) {
    throw new Error("Informe ao menos código, EAN ou descrição do item XML.");
  }

  await assertProductBelongsToEstablishment({
    supabase,
    establishmentId,
    productId,
  });

  const payload = {
    establishment_id: establishmentId,
    product_id: productId,
    supplier_document: supplierDocument || null,
    xml_code: xmlCode || null,
    xml_ean: xmlEan || null,
    xml_description: xmlDescription || null,
    xml_unit: xmlUnit || null,
    normalized_key: normalize(`${supplierDocument}|${xmlCode}|${xmlEan}|${xmlDescription}`),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("fiscal_product_mappings")
    .upsert(payload, {
      onConflict: "establishment_id,normalized_key",
    });

  if (error) {
    console.error(error);
    throw new Error("Não foi possível salvar o vínculo fiscal do produto.");
  }

  revalidatePath("/dashboard/fiscal/vinculos");
  revalidatePath("/dashboard/fiscal/divergencias");

  return { success: true };
}

export async function deleteFiscalProductMappingAction(mappingId: string) {
  const { supabase, establishmentId } = await getContext();

  const { error } = await supabase
    .from("fiscal_product_mappings")
    .delete()
    .eq("id", mappingId)
    .eq("establishment_id", establishmentId);

  if (error) {
    console.error(error);
    throw new Error("Não foi possível excluir o vínculo fiscal.");
  }

  revalidatePath("/dashboard/fiscal/vinculos");
  revalidatePath("/dashboard/fiscal/divergencias");

  return { success: true };
}
