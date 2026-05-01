"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { listTechnicalSheets } from "@/app/(dashboard)/dashboard/fichas-tecnicas/actions";

type FichaTecnica = {
  id: string;
  nome: string;
  categoria: string;
  setor: string;
  rendimento: number;
  custoTotal: number;
  custoPorPorcao: number;
  cmvAlvo: number;
  precoVenda: number;
  ativo: boolean;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(value) ? value : 0);
}

function formatNumber(value: number, fractionDigits = 2) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  }).format(Number.isFinite(value) ? value : 0);
}

function normalizeSector(value: string) {
  const normalized = String(value ?? "").trim();
  return normalized || "Sem setor";
}

function getBarWidth(value: number, max: number) {
  if (!max || max <= 0) return "0%";
  return `${Math.max(8, Math.round((value / max) * 100))}%`;
}

function calcularCMV(custoPorPorcao: number, precoVenda: number) {
  if (!precoVenda || precoVenda <= 0) return 0;
  return (custoPorPorcao / precoVenda) * 100;
}

export default function EngenhariaDashboardPage() {
  const [fichas, setFichas] = useState<FichaTecnica[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const fichasRes = await listTechnicalSheets();

      setFichas(
        (fichasRes ?? []).map((item: any) => {
          const rendimento = Number(item.yield_portions ?? 0);
          const custoTotal = Number(item.total_cost ?? 0);
          const custoPorPorcao =
            Number(item.cost_per_portion ?? 0) > 0
              ? Number(item.cost_per_portion ?? 0)
              : rendimento > 0
                ? custoTotal / rendimento
                : custoTotal;

          return {
            id: String(item.id),
            nome: String(item.name ?? ""),
            categoria: String(item.category ?? "").trim(),
            setor: normalizeSector(String(item.sector ?? "")),
            rendimento,
            custoTotal,
            custoPorPorcao,
            cmvAlvo: Number(item.profit_margin_percent ?? 0),
            precoVenda: Number(item.sale_price ?? 0),
            ativo: item.active !== false,
          };
        })
      );
    } catch (err) {
      console.error("Erro ao carregar dashboard de engenharia:", err);
      setError("Não foi possível carregar o dashboard de engenharia.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const fichasAtivas = useMemo(
    () => fichas.filter((item) => item.ativo !== false),
    [fichas]
  );

  const metrics = useMemo(() => {
    const total = fichasAtivas.length;

    const custoTotalMedio =
      total > 0
        ? fichasAtivas.reduce((sum, item) => sum + item.custoTotal, 0) / total
        : 0;

    const fichasComRendimento = fichasAtivas.filter((item) => item.rendimento > 0);

    const custoPorPorcaoMedio =
      fichasComRendimento.length > 0
        ? fichasComRendimento.reduce(
            (sum, item) => sum + item.custoPorPorcao,
            0
          ) / fichasComRendimento.length
        : 0;

    const semRendimento = fichasAtivas.filter((item) => item.rendimento <= 0).length;

    const semCusto = fichasAtivas.filter((item) => item.custoTotal <= 0).length;

    const cmvMedio =
      total > 0
        ? fichasAtivas.reduce(
            (sum, item) => sum + calcularCMV(item.custoPorPorcao, item.precoVenda),
            0
          ) / total
        : 0;

    const cmvAlvoMedio =
      total > 0
        ? fichasAtivas.reduce((sum, item) => sum + item.cmvAlvo, 0) / total
        : 0;

    return {
      total,
      custoTotalMedio,
      custoPorPorcaoMedio,
      semRendimento,
      semCusto,
      cmvMedio,
      cmvAlvoMedio,
    };
  }, [fichasAtivas]);

  const topMaisCaras = useMemo(() => {
    return [...fichasAtivas]
      .sort((a, b) => b.custoTotal - a.custoTotal)
      .slice(0, 7);
  }, [fichasAtivas]);

  const topMaisVantajosas = useMemo(() => {
    return [...fichasAtivas]
      .filter((item) => item.rendimento > 0 && item.custoPorPorcao > 0)
      .sort((a, b) => a.custoPorPorcao - b.custoPorPorcao)
      .slice(0, 7);
  }, [fichasAtivas]);

  const fichasAtencao = useMemo(() => {
    return [...fichasAtivas]
      .filter(
        (item) =>
          item.rendimento <= 0 ||
          item.custoTotal <= 0 ||
          item.custoPorPorcao <= 0
      )
      .slice(0, 10);
  }, [fichasAtivas]);

  const porSetor = useMemo(() => {
    const grouped = fichasAtivas.reduce<Record<string, number>>((acc, item) => {
      const key = normalizeSector(item.setor);
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([setor, quantidade]) => ({ setor, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade);
  }, [fichasAtivas]);

  const custoPorSetor = useMemo(() => {
    const grouped = fichasAtivas.reduce<
      Record<string, { quantidade: number; custoTotal: number; custoPorPorcao: number }>
    >((acc, item) => {
      const key = normalizeSector(item.setor);

      if (!acc[key]) {
        acc[key] = { quantidade: 0, custoTotal: 0, custoPorPorcao: 0 };
      }

      acc[key].quantidade += 1;
      acc[key].custoTotal += item.custoTotal;
      acc[key].custoPorPorcao += item.custoPorPorcao;

      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([setor, data]) => ({
        setor,
        quantidade: data.quantidade,
        custoTotalMedio: data.quantidade > 0 ? data.custoTotal / data.quantidade : 0,
        custoPorPorcaoMedio:
          data.quantidade > 0 ? data.custoPorPorcao / data.quantidade : 0,
      }))
      .sort((a, b) => b.custoTotalMedio - a.custoTotalMedio);
  }, [fichasAtivas]);

  const maxSetorQuantidade = Math.max(...porSetor.map((item) => item.quantidade), 0);
  const maxCustoSetor = Math.max(
    ...custoPorSetor.map((item) => item.custoTotalMedio),
    0
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard de Engenharia</h1>
          <p className="text-sm text-gray-500">
            Visão executiva das fichas técnicas com foco em custo, rendimento e distribuição por setor.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard/fichas-tecnicas"
            className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Fichas técnicas
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Carregando dashboard...</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">Fichas técnicas cadastradas</div>
              <div className="mt-2 text-2xl font-bold">{metrics.total}</div>
              <p className="mt-1 text-xs text-gray-500">
                Total de receitas ativas registradas no sistema.
              </p>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">Custo total médio</div>
              <div className="mt-2 text-2xl font-bold">
                {formatMoney(metrics.custoTotalMedio)}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Média do custo total por ficha técnica.
              </p>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">Custo por porção médio</div>
              <div className="mt-2 text-2xl font-bold">
                {formatMoney(metrics.custoPorPorcaoMedio)}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Indicador mais útil para avaliar vantagem operacional.
              </p>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">Fichas com atenção</div>
              <div className="mt-2 text-2xl font-bold">
                {metrics.semRendimento + metrics.semCusto}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Soma de fichas sem rendimento ou sem custo calculado.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">Total de Receitas</div>
              <div className="mt-2 text-2xl font-bold">{metrics.total}</div>
              <p className="mt-1 text-xs text-gray-500">Receitas cadastradas</p>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">Custo Médio</div>
              <div className="mt-2 text-2xl font-bold">
                {formatMoney(metrics.custoPorPorcaoMedio)}
              </div>
              <p className="mt-1 text-xs text-gray-500">Por porção</p>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">CMV Médio</div>
              <div className="mt-2 text-2xl font-bold">
                {formatNumber(metrics.cmvMedio, 1)}%
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Custo da mercadoria vendida
              </p>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">CMV Alvo Médio</div>
              <div className="mt-2 text-2xl font-bold">
                {formatNumber(metrics.cmvAlvoMedio, 0)}%
              </div>
              <p className="mt-1 text-xs text-gray-500">CMV alvo</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">Receitas mais caras</h2>

              {topMaisCaras.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhuma ficha encontrada.</p>
              ) : (
                <div className="space-y-3">
                  {topMaisCaras.map((item, index) => (
                    <div key={item.id} className="rounded-xl border px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-medium">
                            {index + 1}. {item.nome || "-"}
                          </div>
                          <div className="mt-1 text-xs text-gray-500">
                            {item.setor || "Sem setor"} • {item.categoria || "Sem categoria"} • rendimento{" "}
                            {formatNumber(item.rendimento)}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-semibold">
                            {formatMoney(item.custoTotal)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatMoney(item.custoPorPorcao)}/porção
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">Receitas mais vantajosas</h2>

              {topMaisVantajosas.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhuma ficha encontrada.</p>
              ) : (
                <div className="space-y-3">
                  {topMaisVantajosas.map((item, index) => (
                    <div key={item.id} className="rounded-xl border px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-medium">
                            {index + 1}. {item.nome || "-"}
                          </div>
                          <div className="mt-1 text-xs text-gray-500">
                            {item.setor || "Sem setor"} • {item.categoria || "Sem categoria"} • rendimento{" "}
                            {formatNumber(item.rendimento)}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-semibold">
                            {formatMoney(item.custoPorPorcao)}
                          </div>
                          <div className="text-xs text-gray-500">
                            custo por porção
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">Quantidade de fichas por setor</h2>

              {porSetor.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhum setor encontrado.</p>
              ) : (
                <div className="space-y-4">
                  {porSetor.map((item) => (
                    <div key={item.setor}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-medium">{item.setor}</span>
                        <span className="text-gray-500">{item.quantidade}</span>
                      </div>
                      <div className="h-3 rounded-full bg-gray-100">
                        <div
                          className="h-3 rounded-full bg-gray-900"
                          style={{ width: getBarWidth(item.quantidade, maxSetorQuantidade) }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">Custo médio por setor</h2>

              {custoPorSetor.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhum setor encontrado.</p>
              ) : (
                <div className="space-y-4">
                  {custoPorSetor.map((item) => (
                    <div key={item.setor}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-medium">{item.setor}</span>
                        <span className="text-gray-500">
                          {formatMoney(item.custoTotalMedio)}
                        </span>
                      </div>
                      <div className="h-3 rounded-full bg-gray-100">
                        <div
                          className="h-3 rounded-full bg-gray-900"
                          style={{ width: getBarWidth(item.custoTotalMedio, maxCustoSetor) }}
                        />
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {item.quantidade} ficha(s) • {formatMoney(item.custoPorPorcaoMedio)}/porção em média
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">Fichas que precisam de atenção</h2>

              {fichasAtencao.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Nenhuma ficha com inconsistência encontrada.
                </p>
              ) : (
                <div className="space-y-3">
                  {fichasAtencao.map((item) => (
                    <div key={item.id} className="rounded-xl border px-4 py-3">
                      <div className="font-medium">{item.nome || "-"}</div>
                      <div className="mt-1 text-xs text-gray-500">
                        {item.setor || "Sem setor"} • {item.categoria || "Sem categoria"} • rendimento{" "}
                        {formatNumber(item.rendimento)} • custo total{" "}
                        {formatMoney(item.custoTotal)} • custo por porção{" "}
                        {formatMoney(item.custoPorPorcao)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">Resumo estratégico</h2>

              <div className="space-y-4 text-sm text-gray-700">
                <div className="rounded-xl border p-4">
                  <div className="font-medium text-gray-900">
                    Melhor uso deste dashboard
                  </div>
                  <p className="mt-1 text-gray-500">
                    Use o custo por porção para decidir preço, margem e prioridade
                    de revisão nas fichas mais sensíveis da operação.
                  </p>
                </div>

                <div className="rounded-xl border p-4">
                  <div className="font-medium text-gray-900">
                    O que ainda vale acrescentar depois
                  </div>
                  <p className="mt-1 text-gray-500">
                    CMV real por ficha, preço de venda, margem bruta, data da última
                    atualização, responsável pela ficha e status de validação técnica.
                  </p>
                </div>

                <div className="rounded-xl border p-4">
                  <div className="font-medium text-gray-900">
                    Setores sugeridos para análise
                  </div>
                  <p className="mt-1 text-gray-500">
                    Produção, Padaria, Massaria, Confeitaria, Burrataria, Bar,
                    Cozinha quente, Garde manger e Pré-preparo.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}