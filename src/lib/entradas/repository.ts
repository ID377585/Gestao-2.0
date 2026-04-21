import { supabase } from "@/lib/supabase/client";
import {
  EntradaDocumento,
  HistoricoCustoProduto,
  MovimentoEstoque,
  Produto,
} from "./types";

function normalizeRows<T>(rows: any[] | null | undefined): T[] {
  return Array.isArray(rows) ? (rows as T[]) : [];
}

export async function listarProdutos(): Promise<Produto[]> {
  const { data, error } = await supabase.from("produtos").select("*");

  if (error) {
    console.error("Erro ao listar produtos:", error);
    throw new Error("Não foi possível listar os produtos.");
  }

  return normalizeRows<Produto>(data);
}

export async function criarProduto(produto: Produto): Promise<string> {
  const { data, error } = await supabase
    .from("produtos")
    .insert([produto])
    .select("id")
    .single();

  if (error || !data) {
    console.error("Erro ao criar produto:", error);
    throw new Error("Não foi possível criar o produto.");
  }

  return String(data.id);
}

export async function salvarEntrada(
  entrada: EntradaDocumento
): Promise<string> {
  const { data, error } = await supabase
    .from("entradas")
    .insert([entrada])
    .select("id")
    .single();

  if (error || !data) {
    console.error("Erro ao salvar entrada:", error);
    throw new Error("Não foi possível salvar a entrada.");
  }

  return String(data.id);
}

export async function atualizarEntrada(
  entradaId: string,
  payload: Partial<EntradaDocumento>
): Promise<void> {
  const { error } = await supabase
    .from("entradas")
    .update(payload)
    .eq("id", entradaId);

  if (error) {
    console.error("Erro ao atualizar entrada:", error);
    throw new Error("Não foi possível atualizar a entrada.");
  }
}

export async function registrarMovimentoEstoque(
  movimento: MovimentoEstoque
): Promise<string> {
  const { data, error } = await supabase
    .from("movimentos_estoque")
    .insert([movimento])
    .select("id")
    .single();

  if (error || !data) {
    console.error("Erro ao registrar movimento de estoque:", error);
    throw new Error("Não foi possível registrar o movimento de estoque.");
  }

  return String(data.id);
}

export async function registrarHistoricoCusto(
  historico: HistoricoCustoProduto
): Promise<string> {
  const { data, error } = await supabase
    .from("historico_custo_produto")
    .insert([historico])
    .select("id")
    .single();

  if (error || !data) {
    console.error("Erro ao registrar histórico de custo:", error);
    throw new Error("Não foi possível registrar o histórico de custo.");
  }

  return String(data.id);
}

export async function atualizarProduto(
  produtoId: string,
  payload: Partial<Produto>
): Promise<void> {
  const { error } = await supabase
    .from("produtos")
    .update(payload)
    .eq("id", produtoId);

  if (error) {
    console.error("Erro ao atualizar produto:", error);
    throw new Error("Não foi possível atualizar o produto.");
  }
}

export async function listarHistoricoCustoPorProduto(
  produtoId: string
): Promise<HistoricoCustoProduto[]> {
  const { data, error } = await supabase
    .from("historico_custo_produto")
    .select("*")
    .eq("produtoId", produtoId)
    .order("data", { ascending: true });

  if (error) {
    console.error("Erro ao listar histórico de custo do produto:", error);
    throw new Error("Não foi possível listar o histórico de custo.");
  }

  return normalizeRows<HistoricoCustoProduto>(data);
}

export async function listarEntradas(): Promise<EntradaDocumento[]> {
  const { data, error } = await supabase.from("entradas").select("*");

  if (error) {
    console.error("Erro ao listar entradas:", error);
    throw new Error("Não foi possível listar as entradas.");
  }

  return normalizeRows<EntradaDocumento>(data);
}
