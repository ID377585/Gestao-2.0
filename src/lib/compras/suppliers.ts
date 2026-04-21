import {
  assertSupabaseSuccess,
  createLegacyId,
  getLegacySupabase,
  toBoolean,
  toIsoString,
  toText,
} from "@/lib/legacy/supabase";
import type {
  CreateSupplierInput,
  Supplier,
  UpdateSupplierInput,
} from "@/types/compras";

const TABLE_NAME = "suppliers";

function normalizeSupplier(row: Record<string, unknown>): Supplier {
  return {
    id: toText(row.id),
    razaoSocial: toText(row.razao_social),
    nomeFantasia: toText(row.nome_fantasia),
    cnpj: toText(row.cnpj),
    contato: toText(row.contato),
    telefone: toText(row.telefone),
    email: toText(row.email),
    endereco: toText(row.endereco),
    observacoes: toText(row.observacoes),
    ativo: toBoolean(row.ativo, true),
    createdAt: toIsoString(row.created_at as string | null | undefined),
    updatedAt: toIsoString(row.updated_at as string | null | undefined),
  };
}

export async function createSupplier(
  input: CreateSupplierInput
): Promise<string> {
  const supabase = getLegacySupabase();
  const id = createLegacyId();

  const { error } = await supabase.from(TABLE_NAME).insert({
    id,
    razao_social: input.razaoSocial.trim(),
    nome_fantasia: input.nomeFantasia?.trim() ?? "",
    cnpj: input.cnpj?.trim() ?? "",
    contato: input.contato?.trim() ?? "",
    telefone: input.telefone?.trim() ?? "",
    email: input.email?.trim() ?? "",
    endereco: input.endereco?.trim() ?? "",
    observacoes: input.observacoes?.trim() ?? "",
    ativo: input.ativo ?? true,
  });

  assertSupabaseSuccess(error, "Nao foi possivel criar o fornecedor");
  return id;
}

export async function listSuppliers(): Promise<Supplier[]> {
  const supabase = getLegacySupabase();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*")
    .order("razao_social", { ascending: true });

  assertSupabaseSuccess(error, "Nao foi possivel listar os fornecedores");
  return (data ?? []).map((row) =>
    normalizeSupplier(row as Record<string, unknown>)
  );
}

export async function getSupplierById(id: string): Promise<Supplier | null> {
  const supabase = getLegacySupabase();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  assertSupabaseSuccess(error, "Nao foi possivel buscar o fornecedor");
  return data ? normalizeSupplier(data as Record<string, unknown>) : null;
}

export async function updateSupplier(
  id: string,
  input: UpdateSupplierInput
): Promise<void> {
  const supabase = getLegacySupabase();
  const payload: Record<string, unknown> = {};

  if (input.razaoSocial !== undefined) payload.razao_social = input.razaoSocial.trim();
  if (input.nomeFantasia !== undefined) payload.nome_fantasia = input.nomeFantasia.trim();
  if (input.cnpj !== undefined) payload.cnpj = input.cnpj.trim();
  if (input.contato !== undefined) payload.contato = input.contato.trim();
  if (input.telefone !== undefined) payload.telefone = input.telefone.trim();
  if (input.email !== undefined) payload.email = input.email.trim();
  if (input.endereco !== undefined) payload.endereco = input.endereco.trim();
  if (input.observacoes !== undefined) payload.observacoes = input.observacoes.trim();
  if (input.ativo !== undefined) payload.ativo = input.ativo;

  const { error } = await supabase.from(TABLE_NAME).update(payload).eq("id", id);
  assertSupabaseSuccess(error, "Nao foi possivel atualizar o fornecedor");
}

export async function toggleSupplierStatus(
  id: string,
  ativo: boolean
): Promise<void> {
  const supabase = getLegacySupabase();
  const { error } = await supabase.from(TABLE_NAME).update({ ativo }).eq("id", id);
  assertSupabaseSuccess(error, "Nao foi possivel atualizar o status do fornecedor");
}
