"use server";

import forge from "node-forge";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";
import { parseNfeXml, type ParsedNfeProductItem } from "@/lib/fiscal/nfe-parser";

const CERTIFICATE_BUCKET = "fiscal-certificates";
const NFE_XML_BUCKET = "fiscal-nfe-xmls";

function sanitizeFileName(fileName: string) {
  return fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

function encryptPassword(password: string) {
  return forge.util.encode64(password);
}

function extractCertificateExpiration(_buffer: ArrayBuffer) {
  return null;
}

function normalizeForMatch(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase()
    .trim();
}

function toNumber(value: unknown, fallback = 0) {
  const n = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

async function getFiscalContext() {
  const supabase = await createSupabaseServerClient();
  const { membership, user } = await getActiveMembershipOrRedirect();
  const establishmentId = (membership as any)?.establishment_id;

  if (!establishmentId) {
    throw new Error("Estabelecimento não encontrado.");
  }

  return { supabase, establishmentId, userId: user.id };
}

type ProductMatchRow = {
  id: string;
  name: string;
  sku: string | null;
  default_unit_label: string | null;
  standard_cost: number | null;
  price: number | null;
};

function findProductMatch(item: ParsedNfeProductItem, products: ProductMatchRow[]) {
  const code = normalizeForMatch(item.code);
  const ean = normalizeForMatch(item.ean);
  const description = normalizeForMatch(item.description);

  const bySkuOrEan = products.find((product) => {
    const sku = normalizeForMatch(product.sku);
    return Boolean(sku && (sku === code || sku === ean));
  });

  if (bySkuOrEan) return bySkuOrEan;

  const byExactName = products.find((product) => {
    return normalizeForMatch(product.name) === description;
  });

  if (byExactName) return byExactName;

  const byContainsName = products.find((product) => {
    const productName = normalizeForMatch(product.name);
    return Boolean(
      productName &&
        description &&
        (productName.includes(description) || description.includes(productName))
    );
  });

  return byContainsName ?? null;
}

export async function uploadFiscalCertificateAction(formData: FormData) {
  const { supabase, establishmentId } = await getFiscalContext();

  const fileEntry = formData.get("file");
  const password = String(formData.get("password") ?? "").trim();
  const cnpj = String(formData.get("cnpj") ?? "").trim();

  if (!(fileEntry instanceof File)) {
    throw new Error("Nenhum certificado foi enviado.");
  }

  if (!password) {
    throw new Error("Informe a senha do certificado.");
  }

  if (!cnpj) {
    throw new Error("Informe o CNPJ.");
  }

  const file = fileEntry;
  const fileName = file.name.toLowerCase();

  if (!fileName.endsWith(".pfx") && !fileName.endsWith(".p12")) {
    throw new Error("Envie um certificado A1 válido (.pfx ou .p12).");
  }

  const safeName = sanitizeFileName(file.name);
  const filePath = `${establishmentId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(CERTIFICATE_BUCKET)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type || "application/x-pkcs12",
    });

  if (uploadError) {
    console.error(uploadError);
    throw new Error("Não foi possível enviar o certificado.");
  }

  const expiresAt = extractCertificateExpiration(await file.arrayBuffer());

  const { error: deactivateError } = await supabase
    .from("fiscal_certificates")
    .update({ status: "inactive", updated_at: new Date().toISOString() })
    .eq("establishment_id", establishmentId)
    .eq("status", "active");

  if (deactivateError) {
    console.error(deactivateError);
  }

  const { error: insertError } = await supabase
    .from("fiscal_certificates")
    .insert({
      establishment_id: establishmentId,
      cnpj,
      certificate_path: filePath,
      encrypted_password: encryptPassword(password),
      expires_at: expiresAt,
      status: "active",
    });

  if (insertError) {
    console.error(insertError);
    throw new Error("Não foi possível salvar o certificado.");
  }

  revalidatePath("/dashboard/fiscal/certificado");

  return { success: true };
}

export async function listFiscalCertificatesAction() {
  const { supabase, establishmentId } = await getFiscalContext();

  const { data, error } = await supabase
    .from("fiscal_certificates")
    .select("id, establishment_id, cnpj, certificate_path, expires_at, status, created_at, updated_at")
    .eq("establishment_id", establishmentId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    throw new Error("Não foi possível carregar os certificados fiscais.");
  }

  return data ?? [];
}

export async function listFiscalNfeInboxAction() {
  const { supabase, establishmentId } = await getFiscalContext();

  const { data, error } = await supabase
    .from("fiscal_nfe_inbox")
    .select("*")
    .eq("establishment_id", establishmentId)
    .order("data_emissao", { ascending: false, nullsFirst: false });

  if (error) {
    console.error(error);
    throw new Error("Não foi possível carregar as notas disponíveis.");
  }

  return data ?? [];
}

export async function importFiscalNfeXmlAction(formData: FormData) {
  const { supabase, establishmentId } = await getFiscalContext();

  const fileEntry = formData.get("file");

  if (!(fileEntry instanceof File)) {
    throw new Error("Nenhum XML foi enviado.");
  }

  const file = fileEntry;
  const fileName = file.name.toLowerCase();

  if (!fileName.endsWith(".xml")) {
    throw new Error("Envie um arquivo XML válido.");
  }

  const xmlContent = await file.text();
  const parsed = parseNfeXml(xmlContent);

  if (!parsed.invoiceKey) {
    throw new Error("Não foi possível identificar a chave de acesso da NF-e.");
  }

  const { data: existing, error: existingError } = await supabase
    .from("fiscal_nfe_inbox")
    .select("id")
    .eq("establishment_id", establishmentId)
    .eq("chave_acesso", parsed.invoiceKey)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    console.error(existingError);
    throw new Error("Não foi possível validar duplicidade da NF-e.");
  }

  if (existing) {
    throw new Error("Essa NF-e já está cadastrada nas notas disponíveis.");
  }

  const safeName = sanitizeFileName(file.name);
  const filePath = `${establishmentId}/${parsed.invoiceKey}-${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(NFE_XML_BUCKET)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "application/xml",
    });

  if (uploadError) {
    console.error(uploadError);
    throw new Error("Não foi possível salvar o XML fiscal.");
  }

  const { data, error } = await supabase
    .from("fiscal_nfe_inbox")
    .insert({
      establishment_id: establishmentId,
      nsu: null,
      chave_acesso: parsed.invoiceKey,
      numero: parsed.invoiceNumber || null,
      serie: parsed.invoiceSeries || null,
      fornecedor_nome: parsed.supplierName || null,
      fornecedor_cnpj: parsed.supplierDocument || null,
      valor_total: parsed.totalAmount || null,
      data_emissao: parsed.issueDate || null,
      status_manifestacao: "pendente",
      xml_path: filePath,
      imported_entry_id: null,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error(error);
    throw new Error("Não foi possível gravar a NF-e na inbox fiscal.");
  }

  revalidatePath("/dashboard/fiscal/notas");

  return {
    id: data.id,
    parsed,
  };
}

export async function createInvoiceEntryDraftFromFiscalNfeAction(noteId: string) {
  const { supabase, establishmentId, userId } = await getFiscalContext();

  const { data: note, error: noteError } = await supabase
    .from("fiscal_nfe_inbox")
    .select("*")
    .eq("id", noteId)
    .eq("establishment_id", establishmentId)
    .single();

  if (noteError || !note) {
    console.error(noteError);
    throw new Error("NF-e não encontrada.");
  }

  if ((note as any).imported_entry_id) {
    throw new Error("Essa NF-e já possui um rascunho ou entrada vinculada.");
  }

  if (!note.xml_path) {
    throw new Error("Essa NF-e não possui XML salvo.");
  }

  const { data: xmlFile, error: downloadError } = await supabase.storage
    .from(NFE_XML_BUCKET)
    .download(String(note.xml_path));

  if (downloadError || !xmlFile) {
    console.error(downloadError);
    throw new Error("Não foi possível ler o XML da NF-e.");
  }

  const parsed = parseNfeXml(await xmlFile.text());

  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, name, sku, default_unit_label, standard_cost, price")
    .eq("establishment_id", establishmentId);

  if (productsError) {
    console.error(productsError);
    throw new Error("Não foi possível carregar os produtos para vinculação.");
  }

  const productRows = (products ?? []) as ProductMatchRow[];
  const unmatched: string[] = [];

  const items = parsed.items
    .map((item, index) => {
      const product = findProductMatch(item, productRows);

      if (!product) {
        unmatched.push(item.description || item.code || `Item ${index + 1}`);
        return null;
      }

      const quantity = toNumber(item.quantity, 0);
      const unitCost = toNumber(item.unitCost, product.standard_cost ?? product.price ?? 0);

      return {
        product_id: String(product.id),
        product_name_snapshot: String(product.name),
        quantity,
        unit_label: String(product.default_unit_label || item.unit || "UN").toUpperCase(),
        unit_cost: unitCost,
        total_cost: Number((quantity * unitCost).toFixed(2)),
        sort_order: index,
      };
    })
    .filter(Boolean);

  if (unmatched.length > 0) {
    throw new Error(
      `Não foi possível vincular ${unmatched.length} item(ns) aos produtos cadastrados: ${unmatched
        .slice(0, 5)
        .join(", ")}. Ajuste o SKU/nome dos produtos antes de gerar o rascunho.`
    );
  }

  if (!items.length) {
    throw new Error("Nenhum item válido foi encontrado para gerar o rascunho.");
  }

  const payload = {
    supplier_name: parsed.supplierName || note.fornecedor_nome || "Fornecedor sem nome",
    supplier_document: parsed.supplierDocument || note.fornecedor_cnpj || null,
    invoice_number: parsed.invoiceNumber || note.numero || "",
    invoice_series: parsed.invoiceSeries || note.serie || null,
    invoice_key: parsed.invoiceKey || note.chave_acesso || null,
    issue_date: parsed.issueDate || note.data_emissao || "",
    entry_date: new Date().toISOString().slice(0, 10),
    notes: "Rascunho gerado a partir da inbox fiscal de NF-e.",
    imported_from_xml: true,
    attachment_xml_url: null,
    attachment_xml_path: note.xml_path || null,
    attachment_pdf_url: null,
    attachment_pdf_path: null,
    update_product_standard_cost: false,
    approval_status: "draft_review",
    items,
  };

  const { data: draft, error: draftError } = await supabase
    .from("invoice_entry_drafts")
    .insert({
      establishment_id: establishmentId,
      created_by: userId,
      name: `NF-e ${payload.invoice_number || note.chave_acesso}`,
      data: payload,
      approval_status: "draft_review",
    })
    .select("id")
    .single();

  if (draftError || !draft) {
    console.error(draftError);
    throw new Error("Não foi possível criar o rascunho de entrada.");
  }

  const { error: updateNoteError } = await supabase
    .from("fiscal_nfe_inbox")
    .update({
      imported_entry_id: draft.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", noteId)
    .eq("establishment_id", establishmentId);

  if (updateNoteError) {
    console.error(updateNoteError);
  }

  revalidatePath("/dashboard/fiscal/notas");
  revalidatePath("/dashboard/entradas");

  return { draftId: draft.id };
}

export async function markFiscalNfeAsImportedEntryAction(
  invoiceKey: string | null | undefined,
  entryId: string
) {
  const { supabase, establishmentId } = await getFiscalContext();

  const normalizedInvoiceKey = String(invoiceKey ?? "").trim();
  const normalizedEntryId = String(entryId ?? "").trim();

  if (!normalizedInvoiceKey || !normalizedEntryId) {
    return { success: false };
  }

  const { error } = await supabase
    .from("fiscal_nfe_inbox")
    .update({
      imported_entry_id: normalizedEntryId,
      updated_at: new Date().toISOString(),
    })
    .eq("establishment_id", establishmentId)
    .eq("chave_acesso", normalizedInvoiceKey);

  if (error) {
    console.error(error);
    throw new Error("Entrada criada, mas não foi possível atualizar o vínculo fiscal da NF-e.");
  }

  revalidatePath("/dashboard/fiscal/notas");

  return { success: true };
}
