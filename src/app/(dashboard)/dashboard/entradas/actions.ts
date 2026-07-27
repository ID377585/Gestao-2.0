"use server";

import { markFiscalNfeAsImportedEntryAction } from "@/app/(dashboard)/dashboard/fiscal/actions";
import { revalidatePath } from "next/cache";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase/server";
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
  update_product_standard_cost?: boolean;
  approval_status?: "draft_review" | "approved";
  items: InvoiceEntryItemInput[];
};

export type InvoiceEntryDraftPayload = {
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
  update_product_standard_cost?: boolean;
  approval_status?: "draft_review" | "approved";
  items: InvoiceEntryItemInput[];
};

export type InvoiceEntryDraftRow = {
  id: string;
  establishment_id: string;
  created_by: string;
  name: string;
  data: InvoiceEntryDraftPayload;
  approval_status: "draft_review" | "approved";
  created_at: string;
  updated_at: string;
};

type NormalizedInvoiceEntryItem = {
  product_id: string;
  product_name_snapshot: string;
  quantity: number;
  unit_label: string;
  unit_cost: number;
  total_cost: number;
  sort_order: number;
  category_snapshot: string | null;
};

type SupabaseStockClient =
  | Awaited<ReturnType<typeof createSupabaseServerClient>>
  | ReturnType<typeof createSupabaseAdminClient>;

async function getContext() {
  const supabase = await createSupabaseServerClient();
  const stockSupabase = createSupabaseAdminClient();
  const membershipContext = await getActiveMembershipOrRedirect();

  const establishmentId = String(membershipContext.establishmentId ?? "").trim();

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
    stockSupabase,
    establishmentId,
    role: membershipContext.role,
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

function getApprovalStatus(input?: string | null): "draft_review" | "approved" {
  return input === "draft_review" ? "draft_review" : "approved";
}

function getReadableErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message?.trim()) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as any).message ?? "").trim();
    if (message) return message;
  }

  return fallback;
}

async function validateAndNormalizeItems(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  establishmentId: string,
  items: InvoiceEntryItemInput[]
): Promise<NormalizedInvoiceEntryItem[]> {
  if (!items?.length) {
    throw new Error("Adicione pelo menos um item na nota.");
  }

  const productIds = items.map((item) => String(item.product_id));

  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, establishment_id, name, default_unit_label, category")
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
      category: string | null;
    }
  >();

  for (const product of products ?? []) {
    if ((product as any).establishment_id === establishmentId) {
      validProducts.set(String((product as any).id), {
        id: String((product as any).id),
        establishment_id: String((product as any).establishment_id),
        name: String((product as any).name ?? ""),
        default_unit_label: ((product as any).default_unit_label ??
          null) as string | null,
        category: ((product as any).category ?? null) as string | null,
      });
    }
  }

  return items.map((item, index) => {
    const productId = String(item.product_id);
    const found = validProducts.get(productId);

    if (!found) {
      throw new Error(
        "Há item vinculado a produto inválido para este estabelecimento."
      );
    }

    const quantity = toNumber(item.quantity, 0);
    const unitCost = toNumber(item.unit_cost, 0);
    const totalCost = Number((quantity * unitCost).toFixed(2));
    const unitLabel = normalizeUnit(
      item.unit_label || found.default_unit_label || "UN"
    );

    if (quantity <= 0) {
      throw new Error(`Quantidade inválida no item ${found.name}.`);
    }

    if (unitCost < 0) {
      throw new Error(`Custo unitário inválido no item ${found.name}.`);
    }

    return {
      product_id: productId,
      product_name_snapshot:
        normalizeText(item.product_name_snapshot) || found.name,
      quantity,
      unit_label: unitLabel,
      unit_cost: unitCost,
      total_cost: totalCost,
      sort_order: item.sort_order ?? index,
      category_snapshot: found.category || null,
    };
  });
}

async function applyStockFromItems(
  supabase: SupabaseStockClient,
  establishmentId: string,
  items: Array<{
    product_id: string;
    quantity: number;
    unit_label: string;
  }>
) {
  for (const item of items) {
    try {
      await moveStock(supabase as any, {
        establishment_id: establishmentId,
        product_id: item.product_id,
        unit_label: normalizeUnit(item.unit_label),
        qty_delta: toNumber(item.quantity, 0),
        reason: "nf_entrada",
        source: "invoice_entry",
      });
    } catch (error) {
      console.error("[applyStockFromItems] erro ao movimentar estoque:", {
        item,
        error,
      });

      const detail = getReadableErrorMessage(
        error,
        `Falha ao movimentar o estoque do produto ${item.product_id}.`
      );

      throw new Error(detail);
    }
  }
}

async function reverseStockFromItems(
  supabase: SupabaseStockClient,
  establishmentId: string,
  items: Array<{
    product_id: string;
    quantity: number;
    unit_label: string;
  }>
) {
  for (const item of items) {
    try {
      await moveStock(supabase as any, {
        establishment_id: establishmentId,
        product_id: item.product_id,
        unit_label: normalizeUnit(item.unit_label),
        qty_delta: -Math.abs(toNumber(item.quantity, 0)),
        reason: "estorno_nf_entrada",
        source: "invoice_entry_reverse",
      });
    } catch (error) {
      console.error("[reverseStockFromItems] erro ao estornar estoque:", {
        item,
        error,
      });

      const detail = getReadableErrorMessage(
        error,
        `Falha ao estornar o estoque do produto ${item.product_id}.`
      );

      throw new Error(detail);
    }
  }
}

async function updateProductsStandardCostIfNeeded(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  establishmentId: string,
  items: Array<{
    product_id: string;
    unit_cost: number;
  }>,
  enabled?: boolean
) {
  if (!enabled) return;

  for (const item of items) {
    const { error } = await supabase
      .from("products")
      .update({
        standard_cost: item.unit_cost,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.product_id)
      .eq("establishment_id", establishmentId);

    if (error) {
      console.error("Erro ao atualizar standard_cost do produto:", error);
    }
  }
}

async function cleanupFailedInvoiceEntry(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  entryId: string
) {
  try {
    await supabase
      .from("invoice_entry_items")
      .delete()
      .eq("invoice_entry_id", entryId);

    await supabase.from("invoice_entries").delete().eq("id", entryId);
  } catch (cleanupError) {
    console.error(
      "[cleanupFailedInvoiceEntry] falha ao limpar dados após erro:",
      cleanupError
    );
  }
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
      total_items_qty,
      category_snapshot,
      notes,
      status,
      approval_status,
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
      approved_at,
      approved_by,
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

export async function listInvoiceEntryDrafts(): Promise<InvoiceEntryDraftRow[]> {
  const { supabase, establishmentId } = await getContext();

  const { data, error } = await supabase
    .from("invoice_entry_drafts")
    .select(
      "id, establishment_id, created_by, name, data, approval_status, created_at, updated_at"
    )
    .eq("establishment_id", establishmentId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Erro ao listar rascunhos:", error);
    throw new Error("Não foi possível carregar os rascunhos.");
  }

  return (data ?? []) as InvoiceEntryDraftRow[];
}

export async function saveInvoiceEntryDraft(
  name: string,
  payload: InvoiceEntryDraftPayload,
  draftId?: string
) {
  const { supabase, establishmentId, userId } = await getContext();

  const draftName = normalizeText(name) || "Rascunho de entrada";

  const draftPayload = {
    supplier_name: normalizeText(payload.supplier_name),
    supplier_document: normalizeText(payload.supplier_document) || null,
    invoice_number: normalizeText(payload.invoice_number),
    invoice_series: normalizeText(payload.invoice_series) || null,
    invoice_key: normalizeText(payload.invoice_key) || null,
    issue_date: normalizeDate(payload.issue_date),
    entry_date: normalizeDate(payload.entry_date),
    notes: normalizeText(payload.notes) || null,
    imported_from_xml: Boolean(payload.imported_from_xml),
    attachment_xml_url: normalizeText(payload.attachment_xml_url) || null,
    attachment_xml_path: normalizeText(payload.attachment_xml_path) || null,
    attachment_pdf_url: normalizeText(payload.attachment_pdf_url) || null,
    attachment_pdf_path: normalizeText(payload.attachment_pdf_path) || null,
    update_product_standard_cost: Boolean(payload.update_product_standard_cost),
    approval_status: getApprovalStatus(payload.approval_status),
    items: (payload.items ?? []).map((item, index) => ({
      product_id: String(item.product_id),
      product_name_snapshot: normalizeText(item.product_name_snapshot),
      quantity: toNumber(item.quantity, 0),
      unit_label: normalizeUnit(item.unit_label),
      unit_cost: toNumber(item.unit_cost, 0),
      total_cost: toNumber(item.total_cost, 0),
      sort_order: item.sort_order ?? index,
    })),
  };

  if (draftId?.trim()) {
    const { error } = await supabase
      .from("invoice_entry_drafts")
      .update({
        name: draftName,
        data: draftPayload,
        approval_status: getApprovalStatus(payload.approval_status),
        updated_at: new Date().toISOString(),
      })
      .eq("id", draftId)
      .eq("establishment_id", establishmentId);

    if (error) {
      console.error("Erro ao atualizar rascunho:", error);
      throw new Error("Não foi possível atualizar o rascunho.");
    }

    revalidatePath("/dashboard/entradas");
    return { id: draftId };
  }

  const { data, error } = await supabase
    .from("invoice_entry_drafts")
    .insert({
      establishment_id: establishmentId,
      created_by: userId,
      name: draftName,
      data: draftPayload,
      approval_status: getApprovalStatus(payload.approval_status),
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Erro ao criar rascunho:", error);
    throw new Error("Não foi possível salvar o rascunho.");
  }

  revalidatePath("/dashboard/entradas");
  return data;
}

export async function deleteInvoiceEntryDraft(draftId: string) {
  const { supabase, establishmentId } = await getContext();

  if (!draftId?.trim()) {
    throw new Error("ID do rascunho não informado.");
  }

  const { error } = await supabase
    .from("invoice_entry_drafts")
    .delete()
    .eq("id", draftId)
    .eq("establishment_id", establishmentId);

  if (error) {
    console.error("Erro ao excluir rascunho:", error);
    throw new Error("Não foi possível excluir o rascunho.");
  }

  revalidatePath("/dashboard/entradas");
}

export async function createInvoiceEntry(input: InvoiceEntryInput) {
  const { supabase, stockSupabase, establishmentId, userId } = await getContext();

  const supplierName = normalizeText(input.supplier_name);
  const supplierDocument = normalizeText(input.supplier_document);
  const invoiceNumber = normalizeText(input.invoice_number);
  const invoiceSeries = normalizeText(input.invoice_series);
  const invoiceKey = normalizeText(input.invoice_key);
  const issueDate = normalizeDate(input.issue_date);
  const entryDate = normalizeDate(input.entry_date);
  const notes = normalizeText(input.notes);
  const approvalStatus = getApprovalStatus(input.approval_status);

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

  const { data: existingByNumberSeries, error: duplicateNumberError } =
    await supabase
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

  const normalizedItems = await validateAndNormalizeItems(
    supabase,
    establishmentId,
    input.items
  );

  const totalAmount = Number(
    normalizedItems.reduce((acc, item) => acc + item.total_cost, 0).toFixed(2)
  );

  const totalItemsQty = Number(
    normalizedItems.reduce((acc, item) => acc + item.quantity, 0).toFixed(3)
  );

  const categorySnapshot = normalizedItems[0]?.category_snapshot || null;

  let createdEntryId: string | null = null;

  try {
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
        total_items_qty: totalItemsQty,
        category_snapshot: categorySnapshot,
        notes: notes || null,
        status: "active",
        approval_status: approvalStatus,
        approved_at:
          approvalStatus === "approved" ? new Date().toISOString() : null,
        approved_by: approvalStatus === "approved" ? userId : null,
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
        entryError?.message ??
          "Não foi possível gravar a entrada da nota fiscal."
      );
    }

    createdEntryId = String(entry.id);

    const itemsPayload = normalizedItems.map((item) => ({
      invoice_entry_id: createdEntryId,
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

    if (approvalStatus === "approved") {
      try {
        await applyStockFromItems(stockSupabase, establishmentId, normalizedItems);
      } catch (stockError) {
        console.error("Erro ao aplicar estoque na entrada:", stockError);

        await cleanupFailedInvoiceEntry(supabase, createdEntryId);

        createdEntryId = null;

        throw new Error(
          `Falha ao registrar a entrada no estoque. A operação foi revertida. Detalhe: ${getReadableErrorMessage(
            stockError,
            "Erro interno ao movimentar estoque."
          )}`
        );
      }

      await updateProductsStandardCostIfNeeded(
        supabase,
        establishmentId,
        normalizedItems,
        input.update_product_standard_cost
      );
    }

    if (invoiceKey && createdEntryId) {
      try {
        await markFiscalNfeAsImportedEntryAction(invoiceKey, createdEntryId);
      } catch (fiscalError) {
        console.error(
          "Entrada registrada, mas falhou ao vincular NF-e fiscal:",
          fiscalError
        );
      }
    }

    revalidatePath("/dashboard/entradas");
    revalidatePath("/dashboard/estoque");

    return { id: createdEntryId };
  } catch (error) {
    if (createdEntryId) {
      await cleanupFailedInvoiceEntry(supabase, createdEntryId);
    }

    throw new Error(
      getReadableErrorMessage(
        error,
        "Não foi possível concluir o lançamento da entrada."
      )
    );
  }
}

export async function approveInvoiceEntry(entryId: string) {
  const { supabase, stockSupabase, establishmentId, userId } = await getContext();

  const { data: entry, error } = await supabase
    .from("invoice_entries")
    .select(`
      id,
      establishment_id,
      approval_status,
      status,
      items:invoice_entry_items (
        product_id,
        quantity,
        unit_label,
        unit_cost
      )
    `)
    .eq("id", entryId)
    .eq("establishment_id", establishmentId)
    .single();

  if (error || !entry) {
    throw new Error("Entrada não encontrada para aprovação.");
  }

  if ((entry as any).status !== "active") {
    throw new Error("Somente entradas ativas podem ser aprovadas.");
  }

  if ((entry as any).approval_status === "approved") {
    throw new Error("Essa entrada já está aprovada.");
  }

  const items = Array.isArray((entry as any).items) ? (entry as any).items : [];

  await applyStockFromItems(
    stockSupabase,
    establishmentId,
    items.map((item: any) => ({
      product_id: String(item.product_id),
      quantity: toNumber(item.quantity, 0),
      unit_label: normalizeUnit(item.unit_label),
    }))
  );

  const { error: updateError } = await supabase
    .from("invoice_entries")
    .update({
      approval_status: "approved",
      approved_at: new Date().toISOString(),
      approved_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", entryId)
    .eq("establishment_id", establishmentId);

  if (updateError) {
    console.error("Erro ao aprovar entrada:", updateError);
    throw new Error(
      "O estoque foi aplicado, mas falhou ao atualizar o status da nota."
    );
  }

  revalidatePath("/dashboard/entradas");
  revalidatePath("/dashboard/estoque");
}

export async function updateInvoiceEntry(input: InvoiceEntryInput) {
  const { supabase, stockSupabase, establishmentId, userId } = await getContext();

  if (!input.id?.trim()) {
    throw new Error("ID da entrada não informado.");
  }

  const supplierName = normalizeText(input.supplier_name);
  const supplierDocument = normalizeText(input.supplier_document);
  const invoiceNumber = normalizeText(input.invoice_number);
  const invoiceSeries = normalizeText(input.invoice_series);
  const invoiceKey = normalizeText(input.invoice_key);
  const issueDate = normalizeDate(input.issue_date);
  const entryDate = normalizeDate(input.entry_date);
  const notes = normalizeText(input.notes);
  const approvalStatus = getApprovalStatus(input.approval_status);

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

  const { data: current, error: currentError } = await supabase
    .from("invoice_entries")
    .select(`
      id,
      establishment_id,
      status,
      approval_status,
      invoice_key,
      invoice_number,
      invoice_series,
      items:invoice_entry_items (
        id,
        product_id,
        quantity,
        unit_label,
        unit_cost
      )
    `)
    .eq("id", input.id)
    .eq("establishment_id", establishmentId)
    .single();

  if (currentError || !current) {
    console.error("Erro ao buscar entrada para edição:", currentError);
    throw new Error("Entrada não encontrada.");
  }

  if (String((current as any).status) !== "active") {
    throw new Error("Apenas entradas ativas podem ser editadas.");
  }

  if (invoiceKey) {
    const { data: duplicateByKey, error: duplicateKeyError } = await supabase
      .from("invoice_entries")
      .select("id")
      .eq("establishment_id", establishmentId)
      .eq("invoice_key", invoiceKey)
      .eq("status", "active")
      .neq("id", input.id)
      .limit(1)
      .maybeSingle();

    if (duplicateKeyError) {
      console.error(
        "Erro ao validar duplicidade por chave na edição:",
        duplicateKeyError
      );
      throw new Error("Não foi possível validar duplicidade por chave NF-e.");
    }

    if (duplicateByKey) {
      throw new Error("Já existe outra nota ativa lançada com essa chave NF-e.");
    }
  }

  const { data: duplicateByNumberSeries, error: duplicateNumberError } =
    await supabase
      .from("invoice_entries")
      .select("id")
      .eq("establishment_id", establishmentId)
      .eq("invoice_number", invoiceNumber)
      .eq("invoice_series", invoiceSeries || null)
      .eq("status", "active")
      .neq("id", input.id)
      .limit(1)
      .maybeSingle();

  if (duplicateNumberError) {
    console.error(
      "Erro ao validar duplicidade por número/série na edição:",
      duplicateNumberError
    );
    throw new Error("Não foi possível validar duplicidade por número e série.");
  }

  if (duplicateByNumberSeries) {
    throw new Error("Já existe outra nota ativa com esse número e série.");
  }

  const normalizedItems = await validateAndNormalizeItems(
    supabase,
    establishmentId,
    input.items
  );

  const currentItems = Array.isArray((current as any).items)
    ? (current as any).items
    : [];
  const currentApprovalStatus = String((current as any).approval_status);

  const totalAmount = Number(
    normalizedItems.reduce((acc, item) => acc + item.total_cost, 0).toFixed(2)
  );

  const totalItemsQty = Number(
    normalizedItems.reduce((acc, item) => acc + item.quantity, 0).toFixed(3)
  );

  const categorySnapshot = normalizedItems[0]?.category_snapshot || null;

  if (currentApprovalStatus === "approved") {
    await reverseStockFromItems(
      stockSupabase,
      establishmentId,
      currentItems.map((item: any) => ({
        product_id: String(item.product_id),
        quantity: toNumber(item.quantity, 0),
        unit_label: normalizeUnit(item.unit_label),
      }))
    );
  }

  const { error: updateError } = await supabase
    .from("invoice_entries")
    .update({
      supplier_name: supplierName,
      supplier_document: supplierDocument || null,
      invoice_number: invoiceNumber,
      invoice_series: invoiceSeries || null,
      invoice_key: invoiceKey || null,
      issue_date: issueDate,
      entry_date: entryDate,
      total_amount: totalAmount,
      total_items_qty: totalItemsQty,
      category_snapshot: categorySnapshot,
      notes: notes || null,
      approval_status: approvalStatus,
      approved_at:
        approvalStatus === "approved" ? new Date().toISOString() : null,
      approved_by: approvalStatus === "approved" ? userId : null,
      imported_from_xml: Boolean(input.imported_from_xml),
      attachment_xml_url: input.attachment_xml_url?.trim() || null,
      attachment_xml_path: input.attachment_xml_path?.trim() || null,
      attachment_pdf_url: input.attachment_pdf_url?.trim() || null,
      attachment_pdf_path: input.attachment_pdf_path?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .eq("establishment_id", establishmentId);

  if (updateError) {
    console.error("Erro ao atualizar entrada:", updateError);
    throw new Error("Não foi possível atualizar a entrada.");
  }

  const { error: deleteItemsError } = await supabase
    .from("invoice_entry_items")
    .delete()
    .eq("invoice_entry_id", input.id);

  if (deleteItemsError) {
    console.error("Erro ao limpar itens antigos da entrada:", deleteItemsError);
    throw new Error(
      "A entrada foi atualizada, mas houve erro ao recriar os itens."
    );
  }

  const itemsPayload = normalizedItems.map((item) => ({
    invoice_entry_id: input.id,
    product_id: item.product_id,
    product_name_snapshot: item.product_name_snapshot,
    quantity: item.quantity,
    unit_label: item.unit_label,
    unit_cost: item.unit_cost,
    total_cost: item.total_cost,
    sort_order: item.sort_order,
  }));

  const { error: insertItemsError } = await supabase
    .from("invoice_entry_items")
    .insert(itemsPayload);

  if (insertItemsError) {
    console.error("Erro ao inserir itens novos da entrada:", insertItemsError);
    throw new Error(
      "A entrada foi atualizada, mas houve erro ao salvar os novos itens."
    );
  }

  if (approvalStatus === "approved") {
    await applyStockFromItems(stockSupabase, establishmentId, normalizedItems);

    await updateProductsStandardCostIfNeeded(
      supabase,
      establishmentId,
      normalizedItems,
      input.update_product_standard_cost
    );
  }

  if (invoiceKey && input.id) {
    try {
      await markFiscalNfeAsImportedEntryAction(invoiceKey, input.id);
    } catch (fiscalError) {
      console.error(
        "Entrada atualizada, mas falhou ao vincular NF-e fiscal:",
        fiscalError
      );
    }
  }

  revalidatePath("/dashboard/entradas");
  revalidatePath("/dashboard/estoque");
}

export async function reverseInvoiceEntry(entryId: string) {
  const { supabase, stockSupabase, establishmentId, role, userId } =
    await getContext();

  if (!entryId?.trim()) {
    throw new Error("ID da entrada não informado.");
  }

  const { data: entry, error: entryError } = await supabase
    .from("invoice_entries")
    .select(`
      id,
      establishment_id,
      status,
      approval_status,
      created_by,
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

  const createdBy = String((entry as any).created_by ?? "");
  const canReverse = role === "admin" || createdBy === userId;

  if (!canReverse) {
    throw new Error(
      "Apenas administradores ou o usuário que registrou a entrada podem estornar esta nota."
    );
  }

  const items = Array.isArray((entry as any).items) ? (entry as any).items : [];

  if (String((entry as any).approval_status) === "approved") {
    await reverseStockFromItems(
      stockSupabase,
      establishmentId,
      items.map((item: any) => ({
        product_id: String(item.product_id),
        quantity: toNumber(item.quantity, 0),
        unit_label: normalizeUnit(item.unit_label),
      }))
    );
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
