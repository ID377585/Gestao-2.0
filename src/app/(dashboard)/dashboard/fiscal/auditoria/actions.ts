"use server";

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

function classifyIssue(note: any) {
  const issues: string[] = [];

  if (!note.imported_entry_id) {
    issues.push("sem_entrada");
  }

  if (!note.xml_path) {
    issues.push("sem_xml");
  }

  if (note.status_manifestacao === "resumo_disponivel") {
    issues.push("somente_resumo");
  }

  if (["pendente", null, undefined, ""].includes(note.status_manifestacao)) {
    issues.push("manifestacao_pendente");
  }

  if (!note.fornecedor_cnpj) {
    issues.push("fornecedor_sem_cnpj");
  }

  if (!note.valor_total || Number(note.valor_total) <= 0) {
    issues.push("valor_zerado");
  }

  return issues;
}

export async function getFiscalAuditAction() {
  const { supabase, establishmentId } = await getContext();

  const { data: notes, error } = await supabase
    .from("fiscal_nfe_inbox")
    .select("id, chave_acesso, numero, serie, fornecedor_nome, fornecedor_cnpj, valor_total, data_emissao, status_manifestacao, xml_path, imported_entry_id, created_at, updated_at")
    .eq("establishment_id", establishmentId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error(error);
    throw new Error("Não foi possível carregar auditoria fiscal.");
  }

  const audited = (notes ?? []).map((note: any) => ({
    ...note,
    issues: classifyIssue(note),
  }));

  const withIssues = audited.filter((note: any) => note.issues.length > 0);

  return {
    summary: {
      total: audited.length,
      withIssues: withIssues.length,
      withoutEntry: audited.filter((note: any) => note.issues.includes("sem_entrada")).length,
      xmlPending: audited.filter((note: any) => note.issues.includes("sem_xml") || note.issues.includes("somente_resumo")).length,
      manifestationPending: audited.filter((note: any) => note.issues.includes("manifestacao_pendente")).length,
      supplierIssues: audited.filter((note: any) => note.issues.includes("fornecedor_sem_cnpj")).length,
    },
    issues: withIssues.slice(0, 100),
  };
}
