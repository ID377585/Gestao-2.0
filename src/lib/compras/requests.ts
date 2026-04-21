"use client";

import {
  assertSupabaseSuccess,
  createLegacyId,
  getLegacySupabase,
  toIsoString,
  toNumber,
  toText,
} from "@/lib/legacy/supabase";
import type {
  CreatePurchaseRequestInput,
  PurchaseRequest,
  PurchaseRequestItem,
  PurchaseRequestStatus,
} from "@/types/compras";

const REQUESTS_TABLE = "purchase_requests";
const REQUEST_ITEMS_TABLE = "purchase_request_items";

function normalizeRequest(row: Record<string, unknown>): PurchaseRequest {
  return {
    id: toText(row.id),
    numero: toText(row.numero),
    setorSolicitante: toText(row.setor_solicitante),
    solicitanteId: toText(row.solicitante_id),
    solicitanteNome: toText(row.solicitante_nome),
    dataSolicitacao: toText(row.data_solicitacao),
    prioridade: (toText(row.prioridade, "media") ?? "media") as PurchaseRequest["prioridade"],
    status: (toText(row.status, "pendente") ?? "pendente") as PurchaseRequestStatus,
    observacoes: toText(row.observacoes),
    totalItens: toNumber(row.total_itens),
    createdAt: toIsoString(row.created_at as string | null | undefined),
    updatedAt: toIsoString(row.updated_at as string | null | undefined),
  };
}

function normalizeRequestItem(
  row: Record<string, unknown>
): PurchaseRequestItem {
  return {
    id: toText(row.id),
    requestId: toText(row.request_id),
    productId: toText(row.product_id),
    produtoNome: toText(row.produto_nome),
    unidade: toText(row.unidade),
    quantidade: toNumber(row.quantidade),
    observacao: toText(row.observacao),
  };
}

function generateRequestNumber() {
  return `SC-${Date.now()}`;
}

export async function createPurchaseRequest(
  input: CreatePurchaseRequestInput
): Promise<string> {
  if (!input.items.length) {
    throw new Error("A solicitacao precisa ter ao menos um item.");
  }

  const supabase = getLegacySupabase();
  const requestId = createLegacyId();

  const { error: requestError } = await supabase.from(REQUESTS_TABLE).insert({
    id: requestId,
    numero: generateRequestNumber(),
    setor_solicitante: input.setorSolicitante.trim(),
    solicitante_id: input.solicitanteId.trim(),
    solicitante_nome: input.solicitanteNome.trim(),
    data_solicitacao: new Date().toISOString(),
    prioridade: input.prioridade,
    status: "pendente",
    observacoes: input.observacoes?.trim() ?? "",
    total_itens: input.items.length,
  });

  assertSupabaseSuccess(requestError, "Nao foi possivel criar a solicitacao");

  const itemsPayload = input.items.map((item) => ({
    id: createLegacyId(),
    request_id: requestId,
    product_id: item.productId?.trim() ?? "",
    produto_nome: item.produtoNome.trim(),
    unidade: item.unidade.trim(),
    quantidade: Number(item.quantidade),
    observacao: item.observacao?.trim() ?? "",
  }));

  const { error: itemsError } = await supabase
    .from(REQUEST_ITEMS_TABLE)
    .insert(itemsPayload);

  assertSupabaseSuccess(itemsError, "Nao foi possivel salvar os itens da solicitacao");
  return requestId;
}

export async function listPurchaseRequests(): Promise<PurchaseRequest[]> {
  const supabase = getLegacySupabase();
  const { data, error } = await supabase
    .from(REQUESTS_TABLE)
    .select("*")
    .order("created_at", { ascending: false });

  assertSupabaseSuccess(error, "Nao foi possivel listar as solicitacoes");
  return (data ?? []).map((row) => normalizeRequest(row as Record<string, unknown>));
}

export async function getPurchaseRequestById(
  id: string
): Promise<PurchaseRequest | null> {
  const supabase = getLegacySupabase();
  const { data, error } = await supabase
    .from(REQUESTS_TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  assertSupabaseSuccess(error, "Nao foi possivel buscar a solicitacao");
  return data ? normalizeRequest(data as Record<string, unknown>) : null;
}

export async function listPurchaseRequestItems(
  requestId: string
): Promise<PurchaseRequestItem[]> {
  const supabase = getLegacySupabase();
  const { data, error } = await supabase
    .from(REQUEST_ITEMS_TABLE)
    .select("*")
    .eq("request_id", requestId)
    .order("produto_nome", { ascending: true });

  assertSupabaseSuccess(error, "Nao foi possivel listar os itens da solicitacao");
  return (data ?? []).map((row) =>
    normalizeRequestItem(row as Record<string, unknown>)
  );
}

export async function updatePurchaseRequestStatus(
  id: string,
  status: PurchaseRequestStatus,
  actor?: {
    userId?: string;
    userName?: string;
  }
): Promise<void> {
  const supabase = getLegacySupabase();
  const { error } = await supabase
    .from(REQUESTS_TABLE)
    .update({
      status,
      updated_by: actor?.userId ?? "",
      updated_by_name: actor?.userName ?? "",
    })
    .eq("id", id);

  assertSupabaseSuccess(error, "Nao foi possivel atualizar o status da solicitacao");
}
