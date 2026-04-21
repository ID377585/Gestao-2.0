import {
  assertSupabaseSuccess,
  createLegacyId,
  getLegacySupabase,
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
  const supabase = getLegacySupabase();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*")
    .order("banco", { ascending: true })
    .order("nome_conta", { ascending: true });

  assertSupabaseSuccess(error, "Nao foi possivel listar as contas bancarias");
  return (data ?? []).map((row) =>
    normalizeBankAccount(row as Record<string, unknown>)
  );
}

export async function getBankAccountById(
  id: string
): Promise<BankAccount | null> {
  const supabase = getLegacySupabase();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  assertSupabaseSuccess(error, "Nao foi possivel buscar a conta bancaria");
  return data ? normalizeBankAccount(data as Record<string, unknown>) : null;
}

export async function createBankAccount(input: CreateBankAccountInput) {
  const supabase = getLegacySupabase();
  const id = createLegacyId();

  const { error } = await supabase.from(TABLE_NAME).insert({
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
  const supabase = getLegacySupabase();
  const { error } = await supabase
    .from(TABLE_NAME)
    .update({
      banco: params.banco,
      nome_conta: params.nomeConta,
      agencia: params.agencia ?? "",
      numero_conta: params.numeroConta ?? "",
      tipo: params.tipo,
      saldo_inicial: Number(params.saldoInicial ?? 0),
      ativo: params.ativo,
    })
    .eq("id", params.id);

  assertSupabaseSuccess(error, "Nao foi possivel atualizar a conta bancaria");
}
