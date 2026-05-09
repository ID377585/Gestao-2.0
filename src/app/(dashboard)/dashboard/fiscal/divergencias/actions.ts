"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";
import { auditFiscalNfeProductsAction } from "../auditoria/actions";

async function getContext() {
  const supabase = await createSupabaseServerClient();
  const { membership } = await getActiveMembershipOrRedirect();
  const establishmentId = (membership as any)?.establishment_id;

  if (!establishmentId) {
    throw new Error("Estabelecimento não encontrado.");
  }

  return { supabase, establishmentId: String(establishmentId) };
}

export async function listFiscalNotesForDivergenceAction() {
  const { supabase, establishmentId } = await getContext();

  const { data, error } = await supabase
    .from("fiscal_nfe_inbox")
    .select("id, numero, serie, fornecedor_nome, fornecedor_cnpj, valor_total, data_emissao, status_manifestacao, xml_path, imported_entry_id, updated_at")
    .eq("establishment_id", establishmentId)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error(error);
    throw new Error("Não foi possível listar NF-es para divergência.");
  }

  return data ?? [];
}

export async function auditFiscalNoteDivergencesAction(noteId: string) {
  return auditFiscalNfeProductsAction(noteId);
}
