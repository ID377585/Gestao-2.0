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
  AccountReceivable,
  ReceivableStatus,
  UpdateAccountReceivableStatusInput,
} from "@/types/compras";

const TABLE_NAME = "accounts_receivable";

function normalizeReceivable(
  row: Record<string, unknown>
): AccountReceivable {
  return {
    id: toText(row.id),
    origem: (toText(row.origem, "manual") ?? "manual") as AccountReceivable["origem"],
    origemId: toText(row.origem_id),
    customerId: toText(row.customer_id),
    customerName: toText(row.customer_name),
    descricao: toText(row.descricao),
    valor: toNumber(row.valor),
    vencimento: toText(row.vencimento),
    statusRecebimento: (toText(row.status_recebimento, "pendente") ??
      "pendente") as ReceivableStatus,
    dataRecebimento: toText(row.data_recebimento),
    formaRecebimento: toText(row.forma_recebimento),
    bankAccountId: toText(row.bank_account_id),
    bankAccountName: toText(row.bank_account_name),
    observacoes: toText(row.observacoes),
    categoriaId: toText(row.categoria_id),
    categoria: toText(row.categoria),
    createdAt: toIsoString(row.created_at as string | null | undefined),
    updatedAt: toIsoString(row.updated_at as string | null | undefined),
  };
}

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function computeReceivableStatus(
  receivable: AccountReceivable
): ReceivableStatus {
  if (receivable.statusRecebimento === "cancelado") return "cancelado";
  if (receivable.statusRecebimento === "recebido") return "recebido";
  if (receivable.vencimento && receivable.vencimento < todayYmd()) {
    return "vencido";
  }
  return "pendente";
}

export async function listAccountsReceivable(): Promise<AccountReceivable[]> {
  const supabase = getLegacySupabase();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*")
    .order("created_at", { ascending: false });

  assertSupabaseSuccess(error, "Nao foi possivel listar as contas a receber");

  return (data ?? [])
    .map((row) => normalizeReceivable(row as Record<string, unknown>))
    .map((item) => ({
      ...item,
      statusRecebimento: computeReceivableStatus(item),
    }));
}

export async function getAccountReceivableById(
  id: string
): Promise<AccountReceivable | null> {
  const supabase = getLegacySupabase();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  assertSupabaseSuccess(error, "Nao foi possivel buscar a conta a receber");
  if (!data) return null;

  const normalized = normalizeReceivable(data as Record<string, unknown>);
  return {
    ...normalized,
    statusRecebimento: computeReceivableStatus(normalized),
  };
}

export async function createAccountReceivable(input: {
  origem?: "pedido" | "manual";
  origemId?: string;
  customerId?: string;
  customerName: string;
  descricao: string;
  valor: number;
  vencimento: string;
  categoriaId?: string;
  categoria?: string;
  observacoes?: string;
}) {
  const supabase = getLegacySupabase();
  const id = createLegacyId();

  const { error } = await supabase.from(TABLE_NAME).insert({
    id,
    origem: input.origem ?? "manual",
    origem_id: input.origemId ?? "",
    customer_id: input.customerId ?? "",
    customer_name: input.customerName,
    descricao: input.descricao,
    valor: Number(input.valor ?? 0),
    vencimento: input.vencimento,
    status_recebimento: "pendente",
    data_recebimento: "",
    forma_recebimento: "",
    bank_account_id: "",
    bank_account_name: "",
    categoria_id: input.categoriaId ?? "",
    categoria: input.categoria ?? "",
    observacoes: input.observacoes ?? "",
  });

  assertSupabaseSuccess(error, "Nao foi possivel criar a conta a receber");

  await createFinancialHistoryEntry({
    financeType: "receber",
    financeId: id,
    action: "criado",
    title: "Conta a receber criada",
    description: `${input.customerName} - ${input.descricao}`,
  });

  return id;
}

export async function updateAccountReceivableDetails(params: {
  id: string;
  descricao?: string;
  vencimento?: string;
  categoriaId?: string;
  categoria?: string;
  observacoes?: string;
}) {
  const supabase = getLegacySupabase();
  const { error } = await supabase
    .from(TABLE_NAME)
    .update({
      descricao: params.descricao ?? "",
      vencimento: params.vencimento ?? "",
      categoria_id: params.categoriaId ?? "",
      categoria: params.categoria ?? "",
      observacoes: params.observacoes ?? "",
    })
    .eq("id", params.id);

  assertSupabaseSuccess(error, "Nao foi possivel atualizar a conta a receber");

  await createFinancialHistoryEntry({
    financeType: "receber",
    financeId: params.id,
    action: "editado",
    title: "Conta a receber editada",
    description: params.descricao ?? "",
  });
}

export async function updateAccountReceivableStatus(
  id: string,
  input: UpdateAccountReceivableStatusInput & {
    bankAccountId?: string;
    bankAccountName?: string;
  }
): Promise<void> {
  const supabase = getLegacySupabase();
  const { error } = await supabase
    .from(TABLE_NAME)
    .update({
      status_recebimento: input.statusRecebimento,
      data_recebimento: input.dataRecebimento ?? "",
      forma_recebimento: input.formaRecebimento ?? "",
      bank_account_id: input.bankAccountId ?? "",
      bank_account_name: input.bankAccountName ?? "",
      observacoes: input.observacoes ?? "",
    })
    .eq("id", id);

  assertSupabaseSuccess(error, "Nao foi possivel atualizar o status da conta a receber");
}

export async function markAccountReceivableAsReceived(params: {
  id: string;
  dataRecebimento?: string;
  formaRecebimento?: string;
  bankAccountId?: string;
  bankAccountName?: string;
  observacoes?: string;
}) {
  const current = await getAccountReceivableById(params.id);

  await updateAccountReceivableStatus(params.id, {
    statusRecebimento: "recebido",
    dataRecebimento: params.dataRecebimento ?? todayYmd(),
    formaRecebimento: params.formaRecebimento ?? "",
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
      data: params.dataRecebimento ?? todayYmd(),
      descricao: `Recebimento - ${current.descricao}`,
      tipo: "entrada",
      valor: Number(current.valor),
      origem: "financeiro",
      origemId: current.id,
      observacoes: params.observacoes ?? "",
    });
  }

  await createFinancialHistoryEntry({
    financeType: "receber",
    financeId: params.id,
    action: "recebido",
    title: "Conta marcada como recebida",
    description: params.formaRecebimento ?? "",
    bankAccountName: params.bankAccountName ?? "",
  });
}

export async function markAccountReceivableAsPending(params: {
  id: string;
  observacoes?: string;
}) {
  await updateAccountReceivableStatus(params.id, {
    statusRecebimento: "pendente",
    dataRecebimento: "",
    formaRecebimento: "",
    bankAccountId: "",
    bankAccountName: "",
    observacoes: params.observacoes ?? "",
  });

  await createFinancialHistoryEntry({
    financeType: "receber",
    financeId: params.id,
    action: "pendente",
    title: "Conta retornou para pendente",
    description: params.observacoes ?? "",
  });
}

export async function cancelAccountReceivable(params: {
  id: string;
  observacoes?: string;
}) {
  await updateAccountReceivableStatus(params.id, {
    statusRecebimento: "cancelado",
    dataRecebimento: "",
    formaRecebimento: "",
    bankAccountId: "",
    bankAccountName: "",
    observacoes: params.observacoes ?? "",
  });

  await createFinancialHistoryEntry({
    financeType: "receber",
    financeId: params.id,
    action: "cancelado",
    title: "Conta a receber cancelada",
    description: params.observacoes ?? "",
  });
}
