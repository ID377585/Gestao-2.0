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

function formatDate(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("pt-BR");
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

export default function RelatoriosFinanceirosPage() {
  const [payables, setPayables] = useState<AccountPayable[]>([]);
  const [receivables, setReceivables] = useState<AccountReceivable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [reportType, setReportType] = useState<
    "resumo" | "pagar" | "receber" | "vencidos" | "gerencial"
  >("resumo");

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
      setError("Não foi possível carregar os relatórios financeiros.");
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

  const metrics = useMemo(() => {
    const totalPagar = filteredPayables.reduce(
      (acc, item) => acc + Number(item.valor),
      0
    );

    const totalReceber = filteredReceivables.reduce(
      (acc, item) => acc + Number(item.valor),
      0
    );

    const totalPago = filteredPayables
      .filter((item) => item.statusPagamento === "pago")
      .reduce((acc, item) => acc + Number(item.valor), 0);

    const totalRecebido = filteredReceivables
      .filter((item) => item.statusRecebimento === "recebido")
      .reduce((acc, item) => acc + Number(item.valor), 0);

    const totalVencidoPagar = filteredPayables
      .filter((item) => item.statusPagamento === "vencido")
      .reduce((acc, item) => acc + Number(item.valor), 0);

    const totalVencidoReceber = filteredReceivables
      .filter((item) => item.statusRecebimento === "vencido")
      .reduce((acc, item) => acc + Number(item.valor), 0);

    return {
      totalPagar,
      totalReceber,
      totalPago,
      totalRecebido,
      totalVencidoPagar,
      totalVencidoReceber,
      saldoPrevisto: totalReceber - totalPagar,
      resultadoRealizado: totalRecebido - totalPago,
    };
  }, [filteredPayables, filteredReceivables]);

  const vencidos = useMemo(() => {
    const payablesVencidos = filteredPayables.map((item) => ({
      tipo: "Saída",
      nome: item.supplierName,
      descricao: item.descricao,
      vencimento: item.vencimento,
      valor: item.valor,
      status: item.statusPagamento,
    }));

    const receivablesVencidos = filteredReceivables.map((item) => ({
      tipo: "Entrada",
      nome: item.customerName,
      descricao: item.descricao,
      vencimento: item.vencimento,
      valor: item.valor,
      status: item.statusRecebimento,
    }));

    return [...payablesVencidos, ...receivablesVencidos].filter(
      (item) => item.status === "vencido"
    );
  }, [filteredPayables, filteredReceivables]);

  const payablesByCategory = useMemo(() => {
    return groupByLabel(filteredPayables, (item) => item.categoria || "");
  }, [filteredPayables]);

  const receivablesByCategory = useMemo(() => {
    return groupByLabel(filteredReceivables, (item) => item.categoria || "");
  }, [filteredReceivables]);

  const payablesByCostCenter = useMemo(() => {
    return groupByLabel(filteredPayables, (item) => item.centroCusto || "");
  }, [filteredPayables]);

  function handlePrint() {
    window.print();
  }

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6 p-6 print:p-0">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold">Relatórios Financeiros</h1>
          <p className="text-sm text-gray-500">
            Visão resumida, operacional e gerencial do financeiro.
          </p>
        </div>

        <button
          type="button"
          onClick={handlePrint}
          className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
        >
          Imprimir / Salvar em PDF
        </button>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm print:hidden">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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

          <div>
            <label className="mb-1 block text-sm font-medium">Tipo de relatório</label>
            <select
              value={reportType}
              onChange={(e) =>
                setReportType(
                  e.target.value as
                    | "resumo"
                    | "pagar"
                    | "receber"
                    | "vencidos"
                    | "gerencial"
                )
              }
              className="w-full rounded-xl border px-3 py-2 outline-none"
            >
              <option value="resumo">Resumo</option>
              <option value="pagar">Contas a pagar</option>
              <option value="receber">Contas a receber</option>
              <option value="vencidos">Vencidos</option>
              <option value="gerencial">Gerencial</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Carregando relatório...</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      ) : (
        <>
          {(reportType === "resumo" || reportType === "gerencial") && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border bg-white p-5 shadow-sm">
                <div className="text-sm text-gray-500">Total a pagar</div>
                <div className="mt-2 text-2xl font-bold">
                  {formatCurrency(metrics.totalPagar)}
                </div>
              </div>

              <div className="rounded-2xl border bg-white p-5 shadow-sm">
                <div className="text-sm text-gray-500">Total a receber</div>
                <div className="mt-2 text-2xl font-bold">
                  {formatCurrency(metrics.totalReceber)}
                </div>
              </div>

              <div className="rounded-2xl border bg-white p-5 shadow-sm">
                <div className="text-sm text-gray-500">Saldo previsto</div>
                <div className="mt-2 text-2xl font-bold">
                  {formatCurrency(metrics.saldoPrevisto)}
                </div>
              </div>

              <div className="rounded-2xl border bg-white p-5 shadow-sm">
                <div className="text-sm text-gray-500">Resultado realizado</div>
                <div className="mt-2 text-2xl font-bold">
                  {formatCurrency(metrics.resultadoRealizado)}
                </div>
              </div>
            </div>
          )}

          {reportType === "resumo" && (
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">Resumo financeiro</h2>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-xl border p-4">
                  <div className="text-sm text-gray-500">Total pago</div>
                  <div className="mt-2 text-xl font-bold">
                    {formatCurrency(metrics.totalPago)}
                  </div>
                </div>

                <div className="rounded-xl border p-4">
                  <div className="text-sm text-gray-500">Total recebido</div>
                  <div className="mt-2 text-xl font-bold">
                    {formatCurrency(metrics.totalRecebido)}
                  </div>
                </div>

                <div className="rounded-xl border p-4">
                  <div className="text-sm text-gray-500">Vencidos totais</div>
                  <div className="mt-2 text-xl font-bold">
                    {formatCurrency(
                      metrics.totalVencidoPagar + metrics.totalVencidoReceber
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {reportType === "pagar" && (
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">Relatório de contas a pagar</h2>

              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-left">
                      <th className="px-4 py-3 font-medium">Fornecedor</th>
                      <th className="px-4 py-3 font-medium">Descrição</th>
                      <th className="px-4 py-3 font-medium">Categoria</th>
                      <th className="px-4 py-3 font-medium">Centro de custo</th>
                      <th className="px-4 py-3 font-medium">Vencimento</th>
                      <th className="px-4 py-3 font-medium">Valor</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayables.map((item) => (
                      <tr key={item.id} className="border-b">
                        <td className="px-4 py-3">{item.supplierName}</td>
                        <td className="px-4 py-3">{item.descricao}</td>
                        <td className="px-4 py-3">{item.categoria || "-"}</td>
                        <td className="px-4 py-3">{item.centroCusto || "-"}</td>
                        <td className="px-4 py-3">{formatDate(item.vencimento)}</td>
                        <td className="px-4 py-3">{formatCurrency(Number(item.valor))}</td>
                        <td className="px-4 py-3">{item.statusPagamento}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {reportType === "receber" && (
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">Relatório de contas a receber</h2>

              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-left">
                      <th className="px-4 py-3 font-medium">Cliente</th>
                      <th className="px-4 py-3 font-medium">Descrição</th>
                      <th className="px-4 py-3 font-medium">Categoria</th>
                      <th className="px-4 py-3 font-medium">Vencimento</th>
                      <th className="px-4 py-3 font-medium">Valor</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReceivables.map((item) => (
                      <tr key={item.id} className="border-b">
                        <td className="px-4 py-3">{item.customerName}</td>
                        <td className="px-4 py-3">{item.descricao}</td>
                        <td className="px-4 py-3">{item.categoria || "-"}</td>
                        <td className="px-4 py-3">{formatDate(item.vencimento)}</td>
                        <td className="px-4 py-3">{formatCurrency(Number(item.valor))}</td>
                        <td className="px-4 py-3">{item.statusRecebimento}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {reportType === "vencidos" && (
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">Relatório de vencidos</h2>

              {vencidos.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Nenhum título vencido no período selecionado.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50 text-left">
                        <th className="px-4 py-3 font-medium">Tipo</th>
                        <th className="px-4 py-3 font-medium">Nome</th>
                        <th className="px-4 py-3 font-medium">Descrição</th>
                        <th className="px-4 py-3 font-medium">Vencimento</th>
                        <th className="px-4 py-3 font-medium">Valor</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vencidos.map((item, index) => (
                        <tr key={`${item.tipo}-${index}`} className="border-b">
                          <td className="px-4 py-3">{item.tipo}</td>
                          <td className="px-4 py-3">{item.nome}</td>
                          <td className="px-4 py-3">{item.descricao}</td>
                          <td className="px-4 py-3">{formatDate(item.vencimento)}</td>
                          <td className="px-4 py-3">{formatCurrency(Number(item.valor))}</td>
                          <td className="px-4 py-3">{item.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {reportType === "gerencial" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <div className="rounded-2xl border bg-white p-5 shadow-sm">
                  <h2 className="mb-4 text-lg font-semibold">
                    Despesas por categoria
                  </h2>

                  {payablesByCategory.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      Sem dados no período selecionado.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {payablesByCategory.map((item) => (
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

                  {receivablesByCategory.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      Sem dados no período selecionado.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {receivablesByCategory.map((item) => (
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

                {payablesByCostCenter.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Sem dados no período selecionado.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {payablesByCostCenter.map((item) => (
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
                <h2 className="mb-4 text-lg font-semibold">Resumo gerencial</h2>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  <div className="rounded-xl border p-4">
                    <div className="text-sm text-gray-500">Receita total</div>
                    <div className="mt-2 text-xl font-bold">
                      {formatCurrency(metrics.totalReceber)}
                    </div>
                  </div>

                  <div className="rounded-xl border p-4">
                    <div className="text-sm text-gray-500">Despesa total</div>
                    <div className="mt-2 text-xl font-bold">
                      {formatCurrency(metrics.totalPagar)}
                    </div>
                  </div>

                  <div className="rounded-xl border p-4">
                    <div className="text-sm text-gray-500">Saldo previsto</div>
                    <div className="mt-2 text-xl font-bold">
                      {formatCurrency(metrics.saldoPrevisto)}
                    </div>
                  </div>

                  <div className="rounded-xl border p-4">
                    <div className="text-sm text-gray-500">Resultado realizado</div>
                    <div className="mt-2 text-xl font-bold">
                      {formatCurrency(metrics.resultadoRealizado)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}