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
    id: String(row.id ?? ""),
    razaoSocial: toText(row.razao_social) ?? "",
    nomeFantasia: toText(row.nome_fantasia) ?? undefined,
    cnpj: toText(row.cnpj) ?? undefined,
    contato: toText(row.contato) ?? undefined,
    telefone: toText(row.telefone) ?? undefined,
    telefone2: toText(row.telefone_2) ?? undefined,
    email: toText(row.email) ?? undefined,
    endereco: toText(row.endereco) ?? undefined,
    numero: toText(row.numero) ?? undefined,
    complemento: toText(row.complemento) ?? undefined,
    bairro: toText(row.bairro) ?? undefined,
    cep: toText(row.cep) ?? undefined,
    estado: toText(row.estado) ?? undefined,
    uf: toText(row.uf) ?? undefined,
    observacoes: toText(row.observacoes) ?? undefined,
    ativo: toBoolean(row.ativo, true),
    createdAt: toIsoString(toText(row.created_at)),
    updatedAt: toIsoString(toText(row.updated_at)),
  };
}

function buildCreatePayload(input: CreateSupplierInput) {
  const now = new Date().toISOString();

  return {
    id: createLegacyId(),
    razao_social: input.razaoSocial.trim(),
    nome_fantasia: input.nomeFantasia?.trim() || null,
    cnpj: input.cnpj?.trim() || null,
    contato: input.contato?.trim() || null,
    telefone: input.telefone?.trim() || null,
    telefone_2: input.telefone2?.trim() || null,
    email: input.email?.trim() || null,
    endereco: input.endereco?.trim() || null,
    numero: input.numero?.trim() || null,
    complemento: input.complemento?.trim() || null,
    bairro: input.bairro?.trim() || null,
    cep: input.cep?.trim() || null,
    estado: input.estado?.trim() || null,
    uf: input.uf?.trim() || null,
    observacoes: input.observacoes?.trim() || null,
    ativo: input.ativo ?? true,
    created_at: now,
    updated_at: now,
  };
}

function buildUpdatePayload(input: UpdateSupplierInput) {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.razaoSocial !== undefined) {
    payload.razao_social = input.razaoSocial.trim();
  }

  if (input.nomeFantasia !== undefined) {
    payload.nome_fantasia = input.nomeFantasia.trim() || null;
  }

  if (input.cnpj !== undefined) {
    payload.cnpj = input.cnpj.trim() || null;
  }

  if (input.contato !== undefined) {
    payload.contato = input.contato.trim() || null;
  }

  if (input.telefone !== undefined) {
    payload.telefone = input.telefone.trim() || null;
  }

  if (input.telefone2 !== undefined) {
    payload.telefone_2 = input.telefone2.trim() || null;
  }

  if (input.email !== undefined) {
    payload.email = input.email.trim() || null;
  }

  if (input.endereco !== undefined) {
    payload.endereco = input.endereco.trim() || null;
  }

  if (input.numero !== undefined) {
    payload.numero = input.numero.trim() || null;
  }

  if (input.complemento !== undefined) {
    payload.complemento = input.complemento.trim() || null;
  }

  if (input.bairro !== undefined) {
    payload.bairro = input.bairro.trim() || null;
  }

  if (input.cep !== undefined) {
    payload.cep = input.cep.trim() || null;
  }

  if (input.estado !== undefined) {
    payload.estado = input.estado.trim() || null;
  }

  if (input.uf !== undefined) {
    payload.uf = input.uf.trim() || null;
  }

  if (input.observacoes !== undefined) {
    payload.observacoes = input.observacoes.trim() || null;
  }

  if (input.ativo !== undefined) {
    payload.ativo = input.ativo;
  }

  return payload;
}

export async function createSupplier(input: CreateSupplierInput): Promise<string> {
  const supabase = getLegacySupabase();

  const payload = buildCreatePayload(input);

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert(payload)
    .select("id")
    .single();

  assertSupabaseSuccess(error, "Nao foi possivel salvar o fornecedor");

  return String(data?.id ?? payload.id);
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

  const payload = buildUpdatePayload(input);

  const { error } = await supabase
    .from(TABLE_NAME)
    .update(payload)
    .eq("id", id);

  assertSupabaseSuccess(error, "Nao foi possivel atualizar o fornecedor");
}

export async function toggleSupplierStatus(
  id: string,
  ativo: boolean
): Promise<void> {
  const supabase = getLegacySupabase();

  const { error } = await supabase
    .from(TABLE_NAME)
    .update({
      ativo,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  assertSupabaseSuccess(error, "Nao foi possivel atualizar o status do fornecedor");
}