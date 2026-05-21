import {
  assertSupabaseSuccess,
  createLegacyId,
  legacyInsert,
  legacySelect,
  legacyUpdate,
  toBoolean,
  toIsoString,
  toText,
} from "@/lib/legacy/supabase";
import type {
  CreateFinancialCategoryInput,
  FinancialCategory,
} from "@/types/compras";

const TABLE_NAME = "financial_categories";

function normalizeCategory(row: Record<string, unknown>): FinancialCategory {
  return {
    id: toText(row.id),
    codigo: toText(row.codigo),
    grupo: toText(row.grupo),
    categoria: toText(row.categoria),
    subcategoria: toText(row.subcategoria),
    tipo: (toText(row.tipo, "despesa") ?? "despesa") as FinancialCategory["tipo"],
    ativo: toBoolean(row.ativo, true),
    createdAt: toIsoString(row.created_at as string | null | undefined),
    updatedAt: toIsoString(row.updated_at as string | null | undefined),
  };
}

export async function listFinancialCategories(): Promise<FinancialCategory[]> {
  const { query } = await legacySelect(TABLE_NAME);
  const { data, error } = await query
    .order("grupo", { ascending: true })
    .order("categoria", { ascending: true });

  assertSupabaseSuccess(error, "Nao foi possivel listar as categorias financeiras");
  return ((data ?? []) as Record<string, unknown>[]).map((row) =>
    normalizeCategory(row as Record<string, unknown>)
  );
}

export async function getFinancialCategoryById(
  id: string
): Promise<FinancialCategory | null> {
  const { query } = await legacySelect(TABLE_NAME);
  const { data, error } = await query
    .eq("id", id)
    .maybeSingle();

  assertSupabaseSuccess(error, "Nao foi possivel buscar a categoria financeira");
  return data ? normalizeCategory(data as Record<string, unknown>) : null;
}

export async function createFinancialCategory(
  input: CreateFinancialCategoryInput
) {
  const id = createLegacyId();

  const { error } = await legacyInsert(TABLE_NAME, {
    id,
    codigo: input.codigo,
    grupo: input.grupo,
    categoria: input.categoria,
    subcategoria: input.subcategoria ?? "",
    tipo: input.tipo,
    ativo: input.ativo ?? true,
  });

  assertSupabaseSuccess(error, "Nao foi possivel criar a categoria financeira");
  return id;
}

export async function updateFinancialCategory(params: {
  id: string;
  codigo: string;
  grupo: string;
  categoria: string;
  subcategoria?: string;
  tipo: "receita" | "despesa" | "custo";
  ativo: boolean;
}) {
  const { error } = await (
    await legacyUpdate(TABLE_NAME, {
      codigo: params.codigo,
      grupo: params.grupo,
      categoria: params.categoria,
      subcategoria: params.subcategoria ?? "",
      tipo: params.tipo,
      ativo: params.ativo,
    })
  ).eq("id", params.id);

  assertSupabaseSuccess(error, "Nao foi possivel atualizar a categoria financeira");
}
