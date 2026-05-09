"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";
import {
  createInvoiceEntry,
  type InvoiceEntryInput,
} from "@/app/(dashboard)/dashboard/entradas/actions";
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

function normalizeDate(value: unknown) {
  return String(value ?? "").slice(0, 10);
}

export async function createAutomaticInvoiceEntryFromFiscalNfeAction(noteId: string) {
  const { supabase, establishmentId } = await getContext();

  const { data: note, error: noteError } = await supabase
    .from("fiscal_nfe_inbox")
    .select("*")
    .eq("id", noteId)
    .eq("establishment_id", establishmentId)
    .single();

  if (noteError || !note) {
    console.error(noteError);
    throw new Error("NF-e não encontrada para entrada automática.");
  }

  if ((note as any).imported_entry_id) {
    throw new Error("Essa NF-e já possui entrada ou rascunho vinculado.");
  }

  if ((note as any).status_manifestacao !== "xml_completo") {
    throw new Error("A entrada automática só é permitida quando o XML completo estiver disponível.");
  }

  const audit = await auditFiscalNfeProductsAction(noteId);

  if (!audit.items.length) {
    throw new Error("Nenhum item encontrado no XML para gerar entrada automática.");
  }

  const criticalIssues = audit.items.flatMap((item: any) =>
    (item.issues ?? []).filter((issue: string) =>
      ["produto_nao_vinculado", "unidade_divergente"].includes(issue)
    )
  );

  if (criticalIssues.length > 0 || audit.summary.unmatched > 0 || audit.summary.unitDivergences > 0) {
    throw new Error(
      "A entrada automática foi bloqueada: existem produtos sem vínculo ou unidades divergentes. Revise em Divergências Fiscais."
    );
  }

  const items = audit.items.map((item: any, index: number) => ({
    product_id: String(item.product.id),
    product_name_snapshot: String(item.product.name),
    quantity: Number(item.xml.quantity || 0),
    unit_label: String(item.product.unit || item.xml.unit || "UN").toUpperCase(),
    unit_cost: Number(item.xml.unitCost || 0),
    total_cost: Number(item.xml.totalCost || Number(item.xml.quantity || 0) * Number(item.xml.unitCost || 0)),
    sort_order: index,
  }));

  const invalidItem = items.find((item: any) => item.quantity <= 0 || item.unit_cost < 0);

  if (invalidItem) {
    throw new Error("A entrada automática foi bloqueada: há item com quantidade ou custo inválido.");
  }

  const payload: InvoiceEntryInput = {
    supplier_name: String((note as any).fornecedor_nome || "Fornecedor sem nome"),
    supplier_document: (note as any).fornecedor_cnpj || null,
    invoice_number: String((note as any).numero || (note as any).chave_acesso || "NF-e"),
    invoice_series: (note as any).serie || null,
    invoice_key: (note as any).chave_acesso || null,
    issue_date: normalizeDate((note as any).data_emissao) || new Date().toISOString().slice(0, 10),
    entry_date: new Date().toISOString().slice(0, 10),
    notes: "Entrada automática gerada pelo módulo fiscal do Gestify.",
    imported_from_xml: true,
    attachment_xml_url: null,
    attachment_xml_path: (note as any).xml_path || null,
    attachment_pdf_url: null,
    attachment_pdf_path: null,
    update_product_standard_cost: true,
    approval_status: "approved",
    items,
  };

  const result = await createInvoiceEntry(payload);

  revalidatePath("/dashboard/fiscal/notas");
  revalidatePath("/dashboard/fiscal/dashboard");
  revalidatePath("/dashboard/fiscal/auditoria");
  revalidatePath("/dashboard/fiscal/divergencias");
  revalidatePath("/dashboard/entradas");
  revalidatePath("/dashboard/estoque");

  return {
    entryId: result.id,
    totalItems: items.length,
    costDivergences: audit.summary.costDivergences,
  };
}
