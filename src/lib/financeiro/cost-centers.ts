import {
  assertSupabaseSuccess,
  createLegacyId,
  getLegacySupabase,
  toBoolean,
  toIsoString,
  toText,
} from "@/lib/legacy/supabase";
import type {
  CostCenter,
  CreateCostCenterInput,
} from "@/types/compras";

const TABLE_NAME = "cost_centers";

function normalizeCostCenter(row: Record<string, unknown>): CostCenter {
  return {
    id: toText(row.id),
    codigo: toText(row.codigo),
    nome: toText(row.nome),
    descricao: toText(row.descricao),
    ativo: toBoolean(row.ativo, true),
    createdAt: toIsoString(row.created_at as string | null | undefined),
    updatedAt: toIsoString(row.updated_at as string | null | undefined),
  };
}

export async function listCostCenters(): Promise<CostCenter[]> {
  const supabase = getLegacySupabase();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*")
    .order("nome", { ascending: true });

  assertSupabaseSuccess(error, "Nao foi possivel listar os centros de custo");
  return (data ?? []).map((row) =>
    normalizeCostCenter(row as Record<string, unknown>)
  );
}

export async function getCostCenterById(
  id: string
): Promise<CostCenter | null> {
  const supabase = getLegacySupabase();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  assertSupabaseSuccess(error, "Nao foi possivel buscar o centro de custo");
  return data ? normalizeCostCenter(data as Record<string, unknown>) : null;
}

export async function createCostCenter(input: CreateCostCenterInput) {
  const supabase = getLegacySupabase();
  const id = createLegacyId();

  const { error } = await supabase.from(TABLE_NAME).insert({
    id,
    codigo: input.codigo,
    nome: input.nome,
    descricao: input.descricao ?? "",
    ativo: input.ativo ?? true,
  });

  assertSupabaseSuccess(error, "Nao foi possivel criar o centro de custo");
  return id;
}

export async function updateCostCenter(params: {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string;
  ativo: boolean;
}) {
  const supabase = getLegacySupabase();
  const { error } = await supabase
    .from(TABLE_NAME)
    .update({
      codigo: params.codigo,
      nome: params.nome,
      descricao: params.descricao ?? "",
      ativo: params.ativo,
    })
    .eq("id", params.id);

  assertSupabaseSuccess(error, "Nao foi possivel atualizar o centro de custo");
}
