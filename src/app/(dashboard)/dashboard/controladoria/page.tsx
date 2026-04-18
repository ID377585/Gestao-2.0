"use client";

import { useEffect, useMemo, useState } from "react";
import { listAccountsPayable } from "@/lib/financeiro/accounts-payable";
import { listAccountsReceivable } from "@/lib/financeiro/accounts-receivable";
import type { AccountPayable, AccountReceivable } from "@/types/compras";

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function groupByLabel<T extends { valor: number }>(
  items: T[],
  getLabel: (item: T) => string
) {
  const map = new Map<string, number>();

  for (const item of items) {
    const label = getLabel(item) || "Não classificado";
    const current = map.get(label) ?? 0;
    map.set(label, current + Number(item.valor));
  }

  return Array.from(map.entries())
    .map(([label, total]) => ({ label, total }))
    .sort((a, b) => b.total - a.total);
}

export default function ControladoriaPage() {
  const [payables, setPayables] = useState<AccountPayable[]>([]);
  const [receivables, setReceivables] = useState<AccountReceivable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [payablesData, receivablesData] = await Promise.all([
        listAccountsPayable(),
        listAccountsReceivable(),
      ]);

      setPayables(payablesData);
      setReceivables(receivablesData);
    } catch (err) {
      console.error(err);
      setError("Não foi possível carregar a controladoria.");
    } finally {
      setLoading(false);
    }
  }

  function inRange(date?: string) {
    if (!date) return false;
    if (dateFrom && date < dateFrom) return false;
    if (dateTo && date > dateTo) return false;
    return true;
  }

  const filteredPayables = useMemo(() => {
    return payables.filter((item) => inRange(item.vencimento));
  }, [payables, dateFrom, dateTo]);

  const filteredReceivables = useMemo(() => {
    return receivables.filter((item) => inRange(item.vencimento));
  }, [receivables, dateFrom, dateTo]);

  const resumo = useMemo(() => {
    const receitaPrevista = filteredReceivables
      .filter((item) => item.statusRecebimento !== "cancelado")
      .reduce((acc, item) => acc + Number(item.valor), 0);

    const receitaRealizada = filteredReceivables
      .filter((item) => item.statusRecebimento === "recebido")
      .reduce((acc, item) => acc + Number(item.valor), 0);

    const despesaPrevista = filteredPayables
      .filter((item) => item.statusPagamento !== "cancelado")
      .reduce((acc, item) => acc + Number(item.valor), 0);

    const despesaRealizada = filteredPayables
      .filter((item) => item.statusPagamento === "pago")
      .reduce((acc, item) => acc + Number(item.valor), 0);

    const vencidoReceber = filteredReceivables
      .filter((item) => item.statusRecebimento === "vencido")
      .reduce((acc, item) => acc + Number(item.valor), 0);

    const vencidoPagar = filteredPayables
      .filter((item) => item.statusPagamento === "vencido")
      .reduce((acc, item) => acc + Number(item.valor), 0);

    return {
      receitaPrevista,
      receitaRealizada,
      despesaPrevista,
      despesaRealizada,
      resultadoPrevisto: receitaPrevista - despesaPrevista,
      resultadoRealizado: receitaRealizada - despesaRealizada,
      vencidoReceber,
      vencidoPagar,
    };
  }, [filteredPayables, filteredReceivables]);

  const despesasPorCategoria = useMemo(() => {
    return groupByLabel(filteredPayables, (item) => item.categoria || "");
  }, [filteredPayables]);

  const receitasPorCategoria = useMemo(() => {
    return groupByLabel(filteredReceivables, (item) => item.categoria || "");
  }, [filteredReceivables]);

  const despesasPorCentroCusto = useMemo(() => {
    return groupByLabel(filteredPayables, (item) => item.centroCusto || "");
  }, [filteredPayables]);

  const dreSimplificada = useMemo(() => {
    return [
      {
        label: "Receita Prevista",
        valor: resumo.receitaPrevista,
      },
      {
        label: "(-) Despesa Prevista",
        valor: -resumo.despesaPrevista,
      },
      {
        label: "(=) Resultado Previsto",
        valor: resumo.resultadoPrevisto,
      },
      {
        label: "Receita Realizada",
        valor: resumo.receitaRealizada,
      },
      {
        label: "(-) Despesa Realizada",
        valor: -resumo.despesaRealizada,
      },
      {
        label: "(=) Resultado Realizado",
        valor: resumo.resultadoRealizado,
      },
    ];
  }, [resumo]);

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Controladoria</h1>
          <p className="text-sm text-gray-500">
            Análise financeira, custos, resultado e indicadores gerenciais.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Data inicial</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Data final</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Carregando controladoria...</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">Receita prevista</div>
              <div className="mt-2 text-2xl font-bold">
                {formatCurrency(resumo.receitaPrevista)}
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">Despesa prevista</div>
              <div className="mt-2 text-2xl font-bold">
                {formatCurrency(resumo.despesaPrevista)}
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">Resultado previsto</div>
              <div className="mt-2 text-2xl font-bold">
                {formatCurrency(resumo.resultadoPrevisto)}
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">Resultado realizado</div>
              <div className="mt-2 text-2xl font-bold">
                {formatCurrency(resumo.resultadoRealizado)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">Receita realizada</div>
              <div className="mt-2 text-xl font-bold">
                {formatCurrency(resumo.receitaRealizada)}
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">Despesa realizada</div>
              <div className="mt-2 text-xl font-bold">
                {formatCurrency(resumo.despesaRealizada)}
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">Vencido a receber</div>
              <div className="mt-2 text-xl font-bold">
                {formatCurrency(resumo.vencidoReceber)}
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">Vencido a pagar</div>
              <div className="mt-2 text-xl font-bold">
                {formatCurrency(resumo.vencidoPagar)}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">DRE simplificada</h2>

            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left">
                    <th className="px-4 py-3 font-medium">Linha</th>
                    <th className="px-4 py-3 font-medium">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {dreSimplificada.map((item) => (
                    <tr key={item.label} className="border-b">
                      <td className="px-4 py-3 font-medium">{item.label}</td>
                      <td className="px-4 py-3">
                        {formatCurrency(item.valor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">
                Despesas por categoria
              </h2>

              {despesasPorCategoria.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Sem despesas classificadas no período.
                </p>
              ) : (
                <div className="space-y-3">
                  {despesasPorCategoria.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between rounded-xl border px-4 py-3"
                    >
                      <div className="font-medium">{item.label}</div>
                      <div className="font-semibold">
                        {formatCurrency(item.total)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">
                Receitas por categoria
              </h2>

              {receitasPorCategoria.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Sem receitas classificadas no período.
                </p>
              ) : (
                <div className="space-y-3">
                  {receitasPorCategoria.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between rounded-xl border px-4 py-3"
                    >
                      <div className="font-medium">{item.label}</div>
                      <div className="font-semibold">
                        {formatCurrency(item.total)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">
              Despesas por centro de custo
            </h2>

            {despesasPorCentroCusto.length === 0 ? (
              <p className="text-sm text-gray-500">
                Sem centros de custo classificados no período.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {despesasPorCentroCusto.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between rounded-xl border px-4 py-3"
                  >
                    <div className="font-medium">{item.label}</div>
                    <div className="font-semibold">
                      {formatCurrency(item.total)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}