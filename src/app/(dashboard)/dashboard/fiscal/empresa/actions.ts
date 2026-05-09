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

export async function getFiscalCompanyProfileAction() {
  const { supabase, establishmentId } = await getContext();

  const { data, error } = await supabase
    .from("fiscal_company_profiles")
    .select("*")
    .eq("establishment_id", establishmentId)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new Error("Não foi possível carregar os dados fiscais da empresa.");
  }

  return data;
}

export async function saveFiscalCompanyProfileAction(formData: FormData) {
  const { supabase, establishmentId } = await getContext();

  const payload = {
    establishment_id: establishmentId,
    razao_social: text(formData.get("razao_social")),
    nome_fantasia: text(formData.get("nome_fantasia")) || null,
    cnpj: text(formData.get("cnpj")),
    inscricao_estadual: text(formData.get("inscricao_estadual")) || null,
    telefone: text(formData.get("telefone")) || null,
    endereco: text(formData.get("endereco")) || null,
    numero: text(formData.get("numero")) || null,
    bairro: text(formData.get("bairro")) || null,
    cidade: text(formData.get("cidade")) || null,
    uf: text(formData.get("uf")) || null,
    cep: text(formData.get("cep")) || null,
    updated_at: new Date().toISOString(),
  };

  if (!payload.razao_social) {
    throw new Error("Informe a razão social.");
  }

  if (!payload.cnpj) {
    throw new Error("Informe o CNPJ.");
  }

  const { error } = await supabase
    .from("fiscal_company_profiles")
    .upsert(payload, { onConflict: "establishment_id" });

  if (error) {
    console.error(error);
    throw new Error("Não foi possível salvar os dados fiscais da empresa.");
  }

  revalidatePath("/dashboard/fiscal/empresa");

  return { success: true };
}
