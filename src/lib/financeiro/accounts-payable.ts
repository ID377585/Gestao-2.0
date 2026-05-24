import {
  assertSupabaseSuccess,
  createLegacyId,
  getLegacyTenantScope,
  legacyInsert,
  legacySelect,
  legacyUpdate,
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

type InvoiceEntryFallback = {
  id: string;
  supplier_name: string;
  supplier_document?: string | null;
  invoice_number?: string | null;
  invoice_series?: string | null;
  invoice_key?: string | null;
  issue_date?: string | null;
  entry_date?: string | null;
  total_amount: number;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function isSafeFallbackError(error: unknown) {
  const message =
    error instanceof Error ? error.message : String(error ?? "");

  return (
    message.includes("does not exist") ||
    message.includes("Could not find the table") ||
    message.includes("Could not find") ||
    message.includes("relation") ||
    message.includes("schema cache") ||
    message.includes("column") ||
    message.includes("Não autenticado") ||
    message.includes("Nao autenticado") ||
    message.includes("Usuário não autenticado") ||
    message.includes("Usuario nao autenticado") ||
    message.includes("Estabelecimento não encontrado") ||
    message.includes("Estabelecimento nao encontrado")
  );
}

function normalizePayable(row: Record<string, unknown>): AccountPayable {
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

function normalizeInvoiceEntry(row: Record<string, unknown>): InvoiceEntryFallback {
  return {
    id: String(row.id ?? ""),
    supplier_name: String(
      row.supplier_name ??
        row.supplierName ??
        row.fornecedor_nome ??
        row.fornecedor ??
        ""
    ),
    supplier_document:
      row.supplier_document || row.supplierDocument || row.cnpj
        ? String(row.supplier_document ?? row.supplierDocument ?? row.cnpj)
        : null,
    invoice_number:
      row.invoice_number || row.invoiceNumber || row.numero_nota || row.nota
        ? String(row.invoice_number ?? row.invoiceNumber ?? row.numero_nota ?? row.nota)
        : null,
    invoice_series:
      row.invoice_series || row.invoiceSeries || row.serie
        ? String(row.invoice_series ?? row.invoiceSeries ?? row.serie)
        : null,
    invoice_key:
      row.invoice_key || row.invoiceKey || row.chave_nfe
        ? String(row.invoice_key ?? row.invoiceKey ?? row.chave_nfe)
        : null,
    issue_date:
      row.issue_date || row.issueDate || row.data_emissao
        ? String(row.issue_date ?? row.issueDate ?? row.data_emissao)
        : null,
    entry_date:
      row.entry_date || row.entryDate || row.data_entrada
        ? String(row.entry_date ?? row.entryDate ?? row.data_entrada)
        : null,
    total_amount: Number(row.total_amount ?? row.totalAmount ?? row.valor_total ?? row.total ?? 0),
    status: row.status ? String(row.status) : "active",
    created_at: row.created_at ? String(row.created_at) : null,
    updated_at: row.updated_at ? String(row.updated_at) : null,
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

function invoiceEntryToPayable(entry: InvoiceEntryFallback): AccountPayable {
  const date =
    entry.entry_date ||
    entry.issue_date ||
    entry.created_at ||
    todayYmd();

  const numeroDocumento = [
    entry.invoice_number,
    entry.invoice_series ? `Série ${entry.invoice_series}` : "",
  ]
    .filter(Boolean)
    .join(" / ");

  const descricao = numeroDocumento
    ? `Nota fiscal ${numeroDocumento}`
    : "Nota fiscal de entrada";

  const payable: AccountPayable = {
    id: `entrada-${entry.id}`,
    origem: "recebimento",
    origemId: entry.id,
    supplierId: "",
    supplierName: entry.supplier_name || "Fornecedor não informado",
    descricao,
    valor: Number(entry.total_amount || 0),
    vencimento: String(date).slice(0, 10),
    statusPagamento: "pendente",
    dataPagamento: "",
    formaPagamento: "",
    bankAccountId: "",
    bankAccountName: "",
    numeroDocumento,
    categoriaId: "",
    categoria: "CMV / Entradas / Notas fiscais",
    centroCustoId: "",
    centroCusto: "Compras / Estoque",
    observacoes:
      "Conta gerencial criada automaticamente a partir da sessão de Entradas.",
    createdAt: toIsoString(entry.created_at),
    updatedAt: toIsoString(entry.updated_at),
  };

  return {
    ...payable,
    statusPagamento: computePayableStatus(payable),
  };
}

async function listInvoiceEntriesAsPayables(): Promise<AccountPayable[]> {
  const { supabase, establishmentId } = await getLegacyTenantScope();

  const possibleTables = [
    "invoice_entries",
    "compras_invoice_entries",
    "purchase_invoice_entries",
    "entrada_notas",
    "entradas_notas",
    "invoice_entry",
    "invoice_entries_v3",
  ];

  for (const tableName of possibleTables) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select("*")
        .eq("establishment_id", establishmentId)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      if (!Array.isArray(data)) {
        return [];
      }

      return data
        .map((row) => normalizeInvoiceEntry(row as Record<string, unknown>))
        .filter((entry) => entry.status !== "cancelled")
        .filter((entry) => Number(entry.total_amount || 0) > 0)
        .map(invoiceEntryToPayable);
    } catch (error) {
      if (isSafeFallbackError(error)) {
        continue;
      }

      console.warn(
        `[accounts-payable] Não foi possível carregar entradas da tabela ${tableName}.`,
        error
      );

      continue;
    }
  }

  return [];
}

async function listAccountsPayableFromTable(): Promise<AccountPayable[]> {
  const { query } = await legacySelect(TABLE_NAME);
  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as Record<string, unknown>[])
    .map((row) => normalizePayable(row as Record<string, unknown>))
    .map((item) => ({
      ...item,
      statusPagamento: computePayableStatus(item),
    }));
}

export async function listAccountsPayable(): Promise<AccountPayable[]> {
  let tablePayables: AccountPayable[] = [];

  try {
    tablePayables = await listAccountsPayableFromTable();
  } catch (error) {
    if (!isSafeFallbackError(error)) {
      console.warn("[accounts-payable] Não foi possível listar contas a pagar.", error);
    }

    tablePayables = [];
  }

  const invoicePayables = await listInvoiceEntriesAsPayables();

  const existingOriginIds = new Set(
    tablePayables
      .map((item) => item.origemId)
      .filter(Boolean)
  );

  const virtualInvoicePayables = invoicePayables.filter(
    (item) => !existingOriginIds.has(item.origemId)
  );

  return [...tablePayables, ...virtualInvoicePayables].sort((a, b) =>
    String(b.createdAt || b.vencimento).localeCompare(String(a.createdAt || a.vencimento))
  );
}

export async function getAccountPayableById(
  id: string
): Promise<AccountPayable | null> {
  if (id.startsWith("entrada-")) {
    const payables = await listInvoiceEntriesAsPayables();
    return payables.find((item) => item.id === id) ?? null;
  }

  try {
    const { query } = await legacySelect(TABLE_NAME);
    const { data, error } = await query
      .eq("id", id)
      .maybeSingle();

    assertSupabaseSuccess(error, "Nao foi possivel buscar a conta a pagar");

    if (!data) return null;

    const normalized = normalizePayable(data as Record<string, unknown>);

    return {
      ...normalized,
      statusPagamento: computePayableStatus(normalized),
    };
  } catch (error) {
    if (isSafeFallbackError(error)) {
      return null;
    }

    throw error;
  }
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
  const id = createLegacyId();

  const { error } = await legacyInsert(TABLE_NAME, {
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

  try {
    await createFinancialHistoryEntry({
      financeType: "pagar",
      financeId: id,
      action: "criado",
      title: "Conta a pagar criada",
      description: `${input.supplierName} - ${input.descricao}`,
    });
  } catch (error) {
    console.warn("[accounts-payable] Histórico financeiro não registrado.", error);
  }

  return id;
}

export async function updateAccountPayableStatus(
  id: string,
  input: UpdateAccountPayableStatusInput & {
    bankAccountId?: string;
    bankAccountName?: string;
  }
): Promise<void> {
  if (id.startsWith("entrada-")) {
    throw new Error(
      "Esta conta foi gerada automaticamente pela sessão de Entradas. Para alterar o pagamento, crie uma conta a pagar manual ou provisione a tabela financeira."
    );
  }

  const { query } = await legacyUpdate(TABLE_NAME, {
    status_pagamento: input.statusPagamento,
    data_pagamento: input.dataPagamento ?? "",
    forma_pagamento: input.formaPagamento ?? "",
    bank_account_id: input.bankAccountId ?? "",
    bank_account_name: input.bankAccountName ?? "",
    observacoes: input.observacoes ?? "",
  });
  const { error } = await query.eq("id", id);

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
  if (params.id.startsWith("entrada-")) {
    throw new Error(
      "Esta conta foi gerada automaticamente pela sessão de Entradas. Para editar, crie uma conta a pagar manual ou provisione a tabela financeira."
    );
  }

  const { query } = await legacyUpdate(TABLE_NAME, {
    descricao: params.descricao ?? "",
    vencimento: params.vencimento ?? "",
    numero_documento: params.numeroDocumento ?? "",
    categoria_id: params.categoriaId ?? "",
    categoria: params.categoria ?? "",
    centro_custo_id: params.centroCustoId ?? "",
    centro_custo: params.centroCusto ?? "",
    observacoes: params.observacoes ?? "",
  });
  const { error } = await query.eq("id", params.id);

  assertSupabaseSuccess(error, "Nao foi possivel atualizar a conta a pagar");

  try {
    await createFinancialHistoryEntry({
      financeType: "pagar",
      financeId: params.id,
      action: "editado",
      title: "Conta a pagar editada",
      description: params.descricao ?? "",
    });
  } catch (error) {
    console.warn("[accounts-payable] Histórico financeiro não registrado.", error);
  }
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
    try {
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
    } catch (error) {
      console.warn("[accounts-payable] Conciliação bancária não registrada.", error);
    }
  }

  try {
    await createFinancialHistoryEntry({
      financeType: "pagar",
      financeId: params.id,
      action: "pago",
      title: "Conta marcada como paga",
      description: params.formaPagamento ?? "",
      bankAccountName: params.bankAccountName ?? "",
    });
  } catch (error) {
    console.warn("[accounts-payable] Histórico financeiro não registrado.", error);
  }
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

  try {
    await createFinancialHistoryEntry({
      financeType: "pagar",
      financeId: params.id,
      action: "pendente",
      title: "Conta retornou para pendente",
      description: params.observacoes ?? "",
    });
  } catch (error) {
    console.warn("[accounts-payable] Histórico financeiro não registrado.", error);
  }
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

  try {
    await createFinancialHistoryEntry({
      financeType: "pagar",
      financeId: params.id,
      action: "cancelado",
      title: "Conta a pagar cancelada",
      description: params.observacoes ?? "",
    });
  } catch (error) {
    console.warn("[accounts-payable] Histórico financeiro não registrado.", error);
  }
}
