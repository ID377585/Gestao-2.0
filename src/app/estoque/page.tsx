"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type ProdutoEstoque = {
  id: string;
  nome: string;
  estoqueAtual?: number;
  estoqueMinimo?: number;
  unidade?: string;
  ativo?: boolean;
};

type PerdaEstoque = {
  id: string;
  produtoNome?: string;
  quantidade?: number;
  createdAt?: string;
};

type EntradaEstoque = {
  id: string;
  produtoNome?: string;
  quantidade?: number;
  createdAt?: string;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function EstoqueDashboardPage() {
  const [produtos, setProdutos] = useState<ProdutoEstoque[]>([]);
  const [perdas, setPerdas] = useState<PerdaEstoque[]>([]);
  const [entradas, setEntradas] = useState<EntradaEstoque[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [produtosRes, perdasRes, entradasRes] = await Promise.all([
        supabase.from("products").select("*"),
        supabase.from("stock_losses").select("*"),
        supabase.from("stock_entries").select("*"),
      ]);

      if (produtosRes.error) throw produtosRes.error;
      if (perdasRes.error) throw perdasRes.error;
      if (entradasRes.error) throw entradasRes.error;

      setProdutos(produtosRes.data || []);
      setPerdas(perdasRes.data || []);
      setEntradas(entradasRes.data || []);
    } catch (err) {
      console.error(err);
      setError("Erro ao carregar dados do estoque.");
    } finally {
      setLoading(false);
    }
  }

  const metrics = useMemo(() => {
    const ativos = produtos.filter((item) => item.ativo !== false);
    const semSaldo = ativos.filter((item) => Number(item.estoqueAtual ?? 0) <= 0);
    const saldoBaixo = ativos.filter((item) => {
      const atual = Number(item.estoqueAtual ?? 0);
      const minimo = Number(item.estoqueMinimo ?? 0);
      return minimo > 0 && atual > 0 && atual <= minimo;
    });

    const totalPerdas = perdas.reduce(
      (acc, item) => acc + Number(item.quantidade ?? 0),
      0
    );

    const totalEntradas = entradas.reduce(
      (acc, item) => acc + Number(item.quantidade ?? 0),
      0
    );

    return {
      produtos: ativos.length,
      semSaldo: semSaldo.length,
      saldoBaixo: saldoBaixo.length,
      totalPerdas,
      totalEntradas,
    };
  }, [produtos, perdas, entradas]);

  const produtosCriticos = useMemo(() => {
    return produtos
      .filter((item) => item.ativo !== false)
      .filter((item) => {
        const atual = Number(item.estoqueAtual ?? 0);
        const minimo = Number(item.estoqueMinimo ?? 0);
        return atual <= 0 || (minimo > 0 && atual <= minimo);
      })
      .sort((a, b) => Number(a.estoqueAtual ?? 0) - Number(b.estoqueAtual ?? 0))
      .slice(0, 10);
  }, [produtos]);

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Dashboard de Estoque</h1>

      {loading ? (
        <p>Carregando...</p>
      ) : error ? (
        <p className="text-red-600">{error}</p>
      ) : (
        <>
          <p>Total produtos: {metrics.produtos}</p>
          <p>Sem saldo: {metrics.semSaldo}</p>
          <p>Saldo baixo: {metrics.saldoBaixo}</p>
        </>
      )}
    </div>
  );
}