"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";
import { moveStock } from "@/lib/stock/moveStock";

const INVOICE_ENTRY_BUCKET = "invoice-entry-files";

export type InvoiceEntryItemInput = {
  product_id: string;
  product_name_snapshot: string;
  quantity: number;
  unit_label: string;
  unit_cost: number;
  total_cost: number;
  sort_order: number;
};

export type InvoiceEntryInput = {
  id?: string;
  supplier_name: string;
  supplier_document?: string | null;
  invoice_number: string;
  invoice_series?: string | null;
  invoice_key?: string | null;
  issue_date: string;
  entry_date: string;
  notes?: string | null;
  imported_from_xml?: boolean;
  attachment_xml_url?: string | null;
  attachment_xml_path?: string | null;
  attachment_pdf_url?: string | null;
  attachment_pdf_path?: string | null;
  items: InvoiceEntryItemInput[];
};

async function getContext() {
  const supabase = await createSupabaseServerClient();
  const { membership } = await getActiveMembershipOrRedirect();

  const establishmentId = (membership as any)?.establishment_id as
    | string
    | undefined;

  if (!establishmentId) {
    throw new Error("Estabelecimento não encontrado para o usuário atual.");
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Usuário não autenticado.");
  }

  return {
    supabase,
    establishmentId,
    userId: user.id,
  };
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeDate(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeUnit(value: unknown) {
  return String(value ?? "UN").trim().toUpperCase() || "UN";
}

function toNumber(value: unknown, fallback = 0) {
  const n = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

function sanitizeFileName(fileName: string) {
  return fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

export async function uploadInvoiceEntryAttachmentAction(formData: FormData) {
  const { supabase, establishmentId, userId } = await getContext();

  const fileEntry = formData.get("file");
  const kind = String(formData.get("kind") ?? "").trim().toLowerCase();

  if (!(fileEntry instanceof File)) {
    throw new Error("Nenhum arquivo foi enviado.");
  }

  if (!["xml", "pdf"].includes(kind)) {
    throw new Error("Tipo de anexo inválido.");
  }

  const file = fileEntry;
  const maxSizeInBytes = 12 * 1024 * 1024;

  if (file.size > maxSizeInBytes) {
    throw new Error("O arquivo deve ter no máximo 12MB.");
  }

  if (kind === "xml") {
    const fileName = file.name.toLowerCase();
    if (
      file.type !== "text/xml" &&
      file.type !== "application/xml" &&
      !fileName.endsWith(".xml")
    ) {
      throw new Error("O anexo XML precisa ser um arquivo .xml válido.");
    }
  }

  if (kind === "pdf") {
    const fileName = file.name.toLowerCase();
    if (file.type !== "application/pdf" && !fileName.endsWith(".pdf")) {
      throw new Error("O anexo PDF precisa ser um arquivo .pdf válido.");
    }
  }

  const safeName = sanitizeFileName(file.name);
  const filePath = `${establishmentId}/${userId}/${kind}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(INVOICE_ENTRY_BUCKET)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });

  if (uploadError) {
    console.error("Erro ao enviar anexo da entrada:", uploadError);
    throw new Error(
      `Não foi possível enviar o anexo para o Supabase. ${uploadError.message}`
    );
  }

  const { data: publicUrlData } = supabase.storage
    .from(INVOICE_ENTRY_BUCKET)
    .getPublicUrl(filePath);

  return {
    fileUrl: publicUrlData.publicUrl,
    filePath,
    kind,
  };
}

export async function deleteInvoiceEntryAttachmentAction(filePath: string) {
  const { supabase } = await getContext();

  if (!filePath?.trim()) return;

  const { error } = await supabase.storage
    .from(INVOICE_ENTRY_BUCKET)
    .remove([filePath]);

  if (error) {
    console.error("Erro ao excluir anexo da entrada:", error);
  }
}

export async function listInvoiceEntries() {
  const { supabase, establishmentId } = await getContext();

  const { data, error } = await supabase
    .from("invoice_entries")
    .select(`
      id,
      establishment_id,
      supplier_name,
      supplier_document,
      invoice_number,
      invoice_series,
      invoice_key,
      issue_date,
      entry_date,
      total_amount,
      notes,
      status,
      imported_from_xml,
      attachment_xml_url,
      attachment_xml_path,
      attachment_pdf_url,
      attachment_pdf_path,
      created_by,
      created_at,
      updated_at,
      cancelled_at,
      cancelled_by,
      items:invoice_entry_items (
        id,
        invoice_entry_id,
        product_id,
        product_name_snapshot,
        quantity,
        unit_label,
        unit_cost,
        total_cost,
        sort_order,
        created_at
      )
    `)
    .eq("establishment_id", establishmentId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao listar entradas:", error);
    throw new Error("Não foi possível carregar o histórico de entradas.");
  }

  return data ?? [];
}

export async function createInvoiceEntry(input: InvoiceEntryInput) {
  const { supabase, establishmentId, userId } = await getContext();

  const supplierName = normalizeText(input.supplier_name);
  const supplierDocument = normalizeText(input.supplier_document);
  const invoiceNumber = normalizeText(input.invoice_number);
  const invoiceSeries = normalizeText(input.invoice_series);
  const invoiceKey = normalizeText(input.invoice_key);
  const issueDate = normalizeDate(input.issue_date);
  const entryDate = normalizeDate(input.entry_date);
  const notes = normalizeText(input.notes);

  if (!supplierName) {
    throw new Error("Informe o fornecedor.");
  }

  if (!invoiceNumber) {
    throw new Error("Informe o número da nota fiscal.");
  }

  if (!issueDate) {
    throw new Error("Informe a data de emissão.");
  }

  if (!entryDate) {
    throw new Error("Informe a data de entrada.");
  }

  if (!input.items?.length) {
    throw new Error("Adicione pelo menos um item na nota.");
  }

  if (invoiceKey) {
    const { data: existingByKey, error: duplicateKeyError } = await supabase
      .from("invoice_entries")
      .select("id")
      .eq("establishment_id", establishmentId)
      .eq("invoice_key", invoiceKey)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (duplicateKeyError) {
      console.error("Erro ao verificar duplicidade por chave:", duplicateKeyError);
      throw new Error("Não foi possível validar duplicidade por chave NF-e.");
    }

    if (existingByKey) {
      throw new Error("Já existe uma nota ativa lançada com essa chave NF-e.");
    }
  }

  const { data: existingByNumberSeries, error: duplicateNumberError } = await supabase
    .from("invoice_entries")
    .select("id")
    .eq("establishment_id", establishmentId)
    .eq("invoice_number", invoiceNumber)
    .eq("invoice_series", invoiceSeries || null)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (duplicateNumberError) {
    console.error(
      "Erro ao verificar duplicidade por número/série:",
      duplicateNumberError
    );
    throw new Error("Não foi possível validar duplicidade por número e série.");
  }

  if (existingByNumberSeries) {
    throw new Error("Já existe uma nota ativa lançada com esse número e série.");
  }

  const productIds = input.items.map((item) => item.product_id);

  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, establishment_id, name, default_unit_label")
    .in("id", productIds);

  if (productsError) {
    console.error("Erro ao validar produtos da entrada:", productsError);
    throw new Error("Não foi possível validar os produtos da entrada.");
  }

  const validProducts = new Map<
    string,
    {
      id: string;
      establishment_id: string;
      name: string;
      default_unit_label: string | null;
    }
  >();

  for (const product of products ?? []) {
    if ((product as any).establishment_id === establishmentId) {
      validProducts.set(String((product as any).id), {
        id: String((product as any).id),
        establishment_id: String((product as any).establishment_id),
        name: String((product as any).name ?? ""),
        default_unit_label: ((product as any).default_unit_label ?? null) as string | null,
      });
    }
  }

  const normalizedItems = input.items.map((item, index) => {
    const productId = String(item.product_id);
    const found = validProducts.get(productId);

    if (!found) {
      throw new Error("Há item vinculado a produto inválido para este estabelecimento.");
    }

    const quantity = toNumber(item.quantity, 0);
    const unitCost = toNumber(item.unit_cost, 0);
    const totalCost = Number((quantity * unitCost).toFixed(2));
    const unitLabel = normalizeUnit(item.unit_label || found.default_unit_label || "UN");

    if (quantity <= 0) {
      throw new Error(`Quantidade inválida no item ${found.name}.`);
    }

    if (unitCost < 0) {
      throw new Error(`Custo unitário inválido no item ${found.name}.`);
    }

    return {
      product_id: productId,
      product_name_snapshot: normalizeText(item.product_name_snapshot) || found.name,
      quantity,
      unit_label: unitLabel,
      unit_cost: unitCost,
      total_cost: totalCost,
      sort_order: item.sort_order ?? index,
    };
  });

  const totalAmount = Number(
    normalizedItems.reduce((acc, item) => acc + item.total_cost, 0).toFixed(2)
  );

  const { data: entry, error: entryError } = await supabase
    .from("invoice_entries")
    .insert({
      establishment_id: establishmentId,
      supplier_name: supplierName,
      supplier_document: supplierDocument || null,
      invoice_number: invoiceNumber,
      invoice_series: invoiceSeries || null,
      invoice_key: invoiceKey || null,
      issue_date: issueDate,
      entry_date: entryDate,
      total_amount: totalAmount,
      notes: notes || null,
      status: "active",
      imported_from_xml: Boolean(input.imported_from_xml),
      attachment_xml_url: input.attachment_xml_url?.trim() || null,
      attachment_xml_path: input.attachment_xml_path?.trim() || null,
      attachment_pdf_url: input.attachment_pdf_url?.trim() || null,
      attachment_pdf_path: input.attachment_pdf_path?.trim() || null,
      created_by: userId,
    })
    .select("id")
    .single();

  if (entryError || !entry) {
    console.error("Erro ao criar entrada:", entryError);
    throw new Error(
      entryError?.message ?? "Não foi possível gravar a entrada da nota fiscal."
    );
  }

  const itemsPayload = normalizedItems.map((item) => ({
    invoice_entry_id: entry.id,
    product_id: item.product_id,
    product_name_snapshot: item.product_name_snapshot,
    quantity: item.quantity,
    unit_label: item.unit_label,
    unit_cost: item.unit_cost,
    total_cost: item.total_cost,
    sort_order: item.sort_order,
  }));

  const { error: itemsError } = await supabase
    .from("invoice_entry_items")
    .insert(itemsPayload);

  if (itemsError) {
    console.error("Erro ao criar itens da entrada:", itemsError);
    throw new Error("Entrada criada, mas houve erro ao salvar os itens.");
  }

  for (const item of normalizedItems) {
    await moveStock(supabase as any, {
      establishment_id: establishmentId,
      product_id: item.product_id,
      unit_label: item.unit_label,
      qty_delta: item.quantity,
      reason: "nf_entrada",
      source: "invoice_entry",
    });
  }

  revalidatePath("/dashboard/entradas");
  revalidatePath("/dashboard/estoque");

  return entry;
}

export async function reverseInvoiceEntry(entryId: string) {
  const { supabase, establishmentId, userId } = await getContext();

  if (!entryId?.trim()) {
    throw new Error("ID da entrada não informado.");
  }

  const { data: entry, error: entryError } = await supabase
    .from("invoice_entries")
    .select(`
      id,
      establishment_id,
      status,
      items:invoice_entry_items (
        id,
        product_id,
        quantity,
        unit_label
      )
    `)
    .eq("id", entryId)
    .eq("establishment_id", establishmentId)
    .single();

  if (entryError || !entry) {
    console.error("Erro ao buscar entrada para estorno:", entryError);
    throw new Error("Entrada não encontrada.");
  }

  if (String((entry as any).status) === "cancelled") {
    throw new Error("Essa entrada já foi estornada.");
  }

  const items = Array.isArray((entry as any).items) ? (entry as any).items : [];

  for (const item of items) {
    await moveStock(supabase as any, {
      establishment_id: establishmentId,
      product_id: String(item.product_id),
      unit_label: normalizeUnit(item.unit_label),
      qty_delta: -Math.abs(toNumber(item.quantity, 0)),
      reason: "estorno_nf_entrada",
      source: "invoice_entry_reverse",
    });
  }

  const { error: updateError } = await supabase
    .from("invoice_entries")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancelled_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", entryId)
    .eq("establishment_id", establishmentId);

  if (updateError) {
    console.error("Erro ao marcar entrada como cancelada:", updateError);
    throw new Error("Não foi possível concluir o estorno da entrada.");
  }

  revalidatePath("/dashboard/entradas");
  revalidatePath("/dashboard/estoque");
}