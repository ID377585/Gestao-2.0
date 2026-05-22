import {
  assertSupabaseSuccess,
  createLegacyId,
  legacyInsert,
  legacySelect,
  legacyUpdate,
  toBoolean,
  toIsoString,
  toNumber,
  toText,
} from "@/lib/legacy/supabase";
import type {
  BankAccount,
  CreateBankAccountInput,
} from "@/types/compras";

const TABLE_NAME = "bank_accounts";

function normalizeBankAccount(row: Record<string, unknown>): BankAccount {
  return {
    id: toText(row.id),
    banco: toText(row.banco),
    nomeConta: toText(row.nome_conta),
    agencia: toText(row.agencia),
    numeroConta: toText(row.numero_conta),
    tipo: (toText(row.tipo, "corrente") ?? "corrente") as BankAccount["tipo"],
    saldoInicial: toNumber(row.saldo_inicial),
    ativo: toBoolean(row.ativo, true),
    createdAt: toIsoString(row.created_at as string | null | undefined),
    updatedAt: toIsoString(row.updated_at as string | null | undefined),
  };
}

export async function listBankAccounts(): Promise<BankAccount[]> {
  const { query } = await legacySelect(TABLE_NAME);
  const { data, error } = await query
    .order("banco", { ascending: true })
    .order("nome_conta", { ascending: true });

  assertSupabaseSuccess(error, "Nao foi possivel listar as contas bancarias");
  return ((data ?? []) as Record<string, unknown>[]).map((row) =>
    normalizeBankAccount(row as Record<string, unknown>)
  );
}

export async function getBankAccountById(
  id: string
): Promise<BankAccount | null> {
  const { query } = await legacySelect(TABLE_NAME);
  const { data, error } = await query
    .eq("id", id)
    .maybeSingle();

  assertSupabaseSuccess(error, "Nao foi possivel buscar a conta bancaria");
  return data ? normalizeBankAccount(data as Record<string, unknown>) : null;
}

export async function createBankAccount(input: CreateBankAccountInput) {
  const id = createLegacyId();

  const { error } = await legacyInsert(TABLE_NAME, {
    id,
    banco: input.banco,
    nome_conta: input.nomeConta,
    agencia: input.agencia ?? "",
    numero_conta: input.numeroConta ?? "",
    tipo: input.tipo,
    saldo_inicial: Number(input.saldoInicial ?? 0),
    ativo: input.ativo ?? true,
  });

  assertSupabaseSuccess(error, "Nao foi possivel criar a conta bancaria");
  return id;
}

export async function updateBankAccount(params: {
  id: string;
  banco: string;
  nomeConta: string;
  agencia?: string;
  numeroConta?: string;
  tipo: "corrente" | "poupanca" | "caixa";
  saldoInicial: number;
  ativo: boolean;
}) {
  const { query } = await legacyUpdate(TABLE_NAME, {
    banco: params.banco,
    nome_conta: params.nomeConta,
    agencia: params.agencia ?? "",
    numero_conta: params.numeroConta ?? "",
    tipo: params.tipo,
    saldo_inicial: Number(params.saldoInicial ?? 0),
    ativo: params.ativo,
  });
  const { error } = await query.eq("id", params.id);

  assertSupabaseSuccess(error, "Nao foi possivel atualizar a conta bancaria");
}
