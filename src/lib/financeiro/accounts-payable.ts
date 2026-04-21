import {
  assertSupabaseSuccess,
  createLegacyId,
  getLegacySupabase,
  toIsoString,
  toNumber,
  toText,
} from "@/lib/legacy/supabase";
import { createBankReconciliationEntry } from "@/lib/financeiro/bank-reconciliation";
import { createFinancialHistoryEntry } from "@/lib/financeiro/financial-history";
import type {
  AccountPayable,
  PayableStatus,
  UpdateAccountPayableStatusInput,
} from "@/types/compras";

const TABLE_NAME = "accounts_payable";

function normalizePayable(
  row: Record<string, unknown>
): AccountPayable {
  return {
    id: toText(row.id),
    origem: (toText(row.origem, "compra") ?? "compra") as AccountPayable["origem"],
    origemId: toText(row.origem_id),
    supplierId: toText(row.supplier_id),
    supplierName: toText(row.supplier_name),
    descricao: toText(row.descricao),
    valor: toNumber(row.valor),
    vencimento: toText(row.vencimento),
    statusPagamento: (toText(row.status_pagamento, "pendente") ??
      "pendente") as PayableStatus,
    dataPagamento: toText(row.data_pagamento),
    formaPagamento: toText(row.forma_pagamento),
    bankAccountId: toText(row.bank_account_id),
    bankAccountName: toText(row.bank_account_name),
    numeroDocumento: toText(row.numero_documento),
    categoriaId: toText(row.categoria_id),
    categoria: toText(row.categoria),
    centroCustoId: toText(row.centro_custo_id),
    centroCusto: toText(row.centro_custo),
    observacoes: toText(row.observacoes),
    createdAt: toIsoString(row.created_at as string | null | undefined),
    updatedAt: toIsoString(row.updated_at as string | null | undefined),
  };
}

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function computePayableStatus(payable: AccountPayable): PayableStatus {
  if (payable.statusPagamento === "cancelado") return "cancelado";
  if (payable.statusPagamento === "pago") return "pago";
  if (payable.vencimento && payable.vencimento < todayYmd()) return "vencido";
  return "pendente";
}

export async function listAccountsPayable(): Promise<AccountPayable[]> {
  const supabase = getLegacySupabase();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*")
    .order("created_at", { ascending: false });

  assertSupabaseSuccess(error, "Nao foi possivel listar as contas a pagar");

  return (data ?? [])
    .map((row) => normalizePayable(row as Record<string, unknown>))
    .map((item) => ({
      ...item,
      statusPagamento: computePayableStatus(item),
    }));
}

export async function getAccountPayableById(
  id: string
): Promise<AccountPayable | null> {
  const supabase = getLegacySupabase();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  assertSupabaseSuccess(error, "Nao foi possivel buscar a conta a pagar");
  if (!data) return null;

  const normalized = normalizePayable(data as Record<string, unknown>);
  return {
    ...normalized,
    statusPagamento: computePayableStatus(normalized),
  };
}

export async function createAccountPayable(input: {
  origem?: "compra" | "recebimento" | "manual";
  origemId?: string;
  supplierId?: string;
  supplierName: string;
  descricao: string;
  valor: number;
  vencimento: string;
  numeroDocumento?: string;
  categoriaId?: string;
  categoria?: string;
  centroCustoId?: string;
  centroCusto?: string;
  observacoes?: string;
}) {
  const supabase = getLegacySupabase();
  const id = createLegacyId();

  const { error } = await supabase.from(TABLE_NAME).insert({
    id,
    origem: input.origem ?? "manual",
    origem_id: input.origemId ?? "",
    supplier_id: input.supplierId ?? "",
    supplier_name: input.supplierName,
    descricao: input.descricao,
    valor: Number(input.valor ?? 0),
    vencimento: input.vencimento,
    status_pagamento: "pendente",
    data_pagamento: "",
    forma_pagamento: "",
    bank_account_id: "",
    bank_account_name: "",
    numero_documento: input.numeroDocumento ?? "",
    categoria_id: input.categoriaId ?? "",
    categoria: input.categoria ?? "",
    centro_custo_id: input.centroCustoId ?? "",
    centro_custo: input.centroCusto ?? "",
    observacoes: input.observacoes ?? "",
  });

  assertSupabaseSuccess(error, "Nao foi possivel criar a conta a pagar");

  await createFinancialHistoryEntry({
    financeType: "pagar",
    financeId: id,
    action: "criado",
    title: "Conta a pagar criada",
    description: `${input.supplierName} - ${input.descricao}`,
  });

  return id;
}

export async function updateAccountPayableStatus(
  id: string,
  input: UpdateAccountPayableStatusInput & {
    bankAccountId?: string;
    bankAccountName?: string;
  }
): Promise<void> {
  const supabase = getLegacySupabase();
  const { error } = await supabase
    .from(TABLE_NAME)
    .update({
      status_pagamento: input.statusPagamento,
      data_pagamento: input.dataPagamento ?? "",
      forma_pagamento: input.formaPagamento ?? "",
      bank_account_id: input.bankAccountId ?? "",
      bank_account_name: input.bankAccountName ?? "",
      observacoes: input.observacoes ?? "",
    })
    .eq("id", id);

  assertSupabaseSuccess(error, "Nao foi possivel atualizar o status da conta a pagar");
}

export async function updateAccountPayableDetails(params: {
  id: string;
  descricao?: string;
  vencimento?: string;
  numeroDocumento?: string;
  categoriaId?: string;
  categoria?: string;
  centroCustoId?: string;
  centroCusto?: string;
  observacoes?: string;
}) {
  const supabase = getLegacySupabase();
  const { error } = await supabase
    .from(TABLE_NAME)
    .update({
      descricao: params.descricao ?? "",
      vencimento: params.vencimento ?? "",
      numero_documento: params.numeroDocumento ?? "",
      categoria_id: params.categoriaId ?? "",
      categoria: params.categoria ?? "",
      centro_custo_id: params.centroCustoId ?? "",
      centro_custo: params.centroCusto ?? "",
      observacoes: params.observacoes ?? "",
    })
    .eq("id", params.id);

  assertSupabaseSuccess(error, "Nao foi possivel atualizar a conta a pagar");

  await createFinancialHistoryEntry({
    financeType: "pagar",
    financeId: params.id,
    action: "editado",
    title: "Conta a pagar editada",
    description: params.descricao ?? "",
  });
}

export async function markAccountPayableAsPaid(params: {
  id: string;
  dataPagamento?: string;
  formaPagamento?: string;
  bankAccountId?: string;
  bankAccountName?: string;
  observacoes?: string;
}) {
  const current = await getAccountPayableById(params.id);

  await updateAccountPayableStatus(params.id, {
    statusPagamento: "pago",
    dataPagamento: params.dataPagamento ?? todayYmd(),
    formaPagamento: params.formaPagamento ?? "",
    bankAccountId: params.bankAccountId ?? "",
    bankAccountName: params.bankAccountName ?? "",
    observacoes: params.observacoes ?? "",
  });

  if (
    current &&
    params.bankAccountId &&
    params.bankAccountName &&
    Number(current.valor) > 0
  ) {
    await createBankReconciliationEntry({
      bankAccountId: params.bankAccountId,
      bankAccountName: params.bankAccountName,
      data: params.dataPagamento ?? todayYmd(),
      descricao: `Pagamento - ${current.descricao}`,
      tipo: "saida",
      valor: Number(current.valor),
      origem: "financeiro",
      origemId: current.id,
      observacoes: params.observacoes ?? "",
    });
  }

  await createFinancialHistoryEntry({
    financeType: "pagar",
    financeId: params.id,
    action: "pago",
    title: "Conta marcada como paga",
    description: params.formaPagamento ?? "",
    bankAccountName: params.bankAccountName ?? "",
  });
}

export async function markAccountPayableAsPending(params: {
  id: string;
  observacoes?: string;
}) {
  await updateAccountPayableStatus(params.id, {
    statusPagamento: "pendente",
    dataPagamento: "",
    formaPagamento: "",
    bankAccountId: "",
    bankAccountName: "",
    observacoes: params.observacoes ?? "",
  });

  await createFinancialHistoryEntry({
    financeType: "pagar",
    financeId: params.id,
    action: "pendente",
    title: "Conta retornou para pendente",
    description: params.observacoes ?? "",
  });
}

export async function cancelAccountPayable(params: {
  id: string;
  observacoes?: string;
}) {
  await updateAccountPayableStatus(params.id, {
    statusPagamento: "cancelado",
    dataPagamento: "",
    formaPagamento: "",
    bankAccountId: "",
    bankAccountName: "",
    observacoes: params.observacoes ?? "",
  });

  await createFinancialHistoryEntry({
    financeType: "pagar",
    financeId: params.id,
    action: "cancelado",
    title: "Conta a pagar cancelada",
    description: params.observacoes ?? "",
  });
}
