"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { listSuppliers } from "@/lib/compras/suppliers";
import { listPurchaseOrders } from "@/lib/compras/orders";
import { listGoodsReceipts } from "@/lib/compras/receipts";
import { calculateSupplierScore } from "@/lib/compras/supplier-score";
import type {
  Supplier,
  PurchaseOrder,
  GoodsReceipt,
} from "@/types/compras";

function formatCurrency(value: number) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function diffDays(from?: string, to?: string) {
  if (!from || !to) return null;

  const start = new Date(from);
  const end = new Date(to);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }

  const diffMs = end.getTime() - start.getTime();
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
}

type SupplierDashboardRow = {
  supplierId: string;
  supplierName: string;
  ativo: boolean;
  totalPedidos: number;
  valorTotalComprado: number;
  totalRecebimentos: number;
  valorTotalRecebido: number;
  recebimentosComDivergencia: number;
  leadTimeMedio: number;
  ultimoPedidoEm: string;
  score: number;
  selo: "excelente" | "bom" | "atencao" | "critico";
  scorePrazo: number;
  scoreDivergencia: number;
  scoreVolume: number;
  scoreRecorrencia: number;
};

function seloLabel(selo: SupplierDashboardRow["selo"]) {
  switch (selo) {
    case "excelente":
      return "Excelente";
    case "bom":
      return "Bom";
    case "atencao":
      return "Atenção";
    case "critico":
      return "Crítico";
    default:
      return selo;
  }
}

function seloClass(selo: SupplierDashboardRow["selo"]) {
  switch (selo) {
    case "excelente":
      return "bg-green-100 text-green-800";
    case "bom":
      return "bg-blue-100 text-blue-800";
    case "atencao":
      return "bg-yellow-100 text-yellow-800";
    case "critico":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

export default function DashboardFornecedoresPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [receipts, setReceipts] = useState<GoodsReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | "ativos" | "inativos">("todos");
  const [sealFilter, setSealFilter] = useState<
    "todos" | "excelente" | "bom" | "atencao" | "critico"
  >("todos");

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [suppliersData, ordersData, receiptsData] = await Promise.all([
        listSuppliers(),
        listPurchaseOrders(),
        listGoodsReceipts(),
      ]);

      setSuppliers(suppliersData);
      setOrders(ordersData);
      setReceipts(receiptsData);
    } catch (err) {
      console.error(err);
      setError("Não foi possível carregar o dashboard de fornecedores.");
    } finally {
      setLoading(false);
    }
  }

  const dashboardRows = useMemo(() => {
    return suppliers.map((supplier) => {
      const supplierOrders = orders.filter(
        (order) => order.supplierId === supplier.id
      );

      const orderIds = supplierOrders.map((order) => order.id);

      const supplierReceipts = receipts.filter((receipt) =>
        orderIds.includes(receipt.purchaseOrderId)
      );

      const leadTimes: number[] = [];

      for (const order of supplierOrders) {
        const relatedReceipts = supplierReceipts
          .filter((receipt) => receipt.purchaseOrderId === order.id)
          .sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));

        const firstReceipt = relatedReceipts[0];
        const diff = diffDays(order.createdAt, firstReceipt?.createdAt);

        if (diff !== null) {
          leadTimes.push(diff);
        }
      }

      const leadTimeMedio =
        leadTimes.length > 0
          ? Math.round(
              leadTimes.reduce((acc, item) => acc + item, 0) / leadTimes.length
            )
          : 0;

      const ultimoPedido =
        supplierOrders
          .map((item) => item.createdAt || "")
          .sort((a, b) => b.localeCompare(a))[0] || "";

      const scoreResult = calculateSupplierScore({
        totalPedidos: supplierOrders.length,
        valorTotalComprado: supplierOrders.reduce(
          (acc, item) => acc + Number(item.valorTotal || 0),
          0
        ),
        recebimentosComDivergencia: supplierReceipts.filter(
          (item) => item.status === "divergencia"
        ).length,
        totalRecebimentos: supplierReceipts.length,
        leadTimeMedio,
      });

      return {
        supplierId: supplier.id,
        supplierName: supplier.razaoSocial,
        ativo: Boolean(supplier.ativo),
        totalPedidos: supplierOrders.length,
        valorTotalComprado: supplierOrders.reduce(
          (acc, item) => acc + Number(item.valorTotal || 0),
          0
        ),
        totalRecebimentos: supplierReceipts.length,
        valorTotalRecebido: supplierReceipts.reduce(
          (acc, item) => acc + Number(item.valorTotalRecebido || 0),
          0
        ),
        recebimentosComDivergencia: supplierReceipts.filter(
          (item) => item.status === "divergencia"
        ).length,
        leadTimeMedio,
        ultimoPedidoEm: ultimoPedido,
        score: scoreResult.score,
        selo: scoreResult.selo,
        scorePrazo: scoreResult.scorePrazo,
        scoreDivergencia: scoreResult.scoreDivergencia,
        scoreVolume: scoreResult.scoreVolume,
        scoreRecorrencia: scoreResult.scoreRecorrencia,
      } as SupplierDashboardRow;
    });
  }, [suppliers, orders, receipts]);

  const filteredRows = useMemo(() => {
    return dashboardRows
      .filter((item) => {
        const searchOk =
          !search ||
          item.supplierName.toLowerCase().includes(search.toLowerCase());

        const statusOk =
          statusFilter === "todos" ||
          (statusFilter === "ativos" && item.ativo) ||
          (statusFilter === "inativos" && !item.ativo);

        const sealOk =
          sealFilter === "todos" || item.selo === sealFilter;

        return searchOk && statusOk && sealOk;
      })
      .sort((a, b) => b.score - a.score);
  }, [dashboardRows, search, statusFilter, sealFilter]);

  const metrics = useMemo(() => {
    return {
      totalFornecedores: filteredRows.length,
      ativos: filteredRows.filter((item) => item.ativo).length,
      excelentes: filteredRows.filter((item) => item.selo === "excelente").length,
      criticos: filteredRows.filter((item) => item.selo === "critico").length,
    };
  }, [filteredRows]);

  const topByScore = useMemo(() => filteredRows.slice(0, 10), [filteredRows]);

  const criticalSuppliers = useMemo(() => {
    return filteredRows
      .filter((item) => item.selo === "critico" || item.selo === "atencao")
      .sort((a, b) => a.score - b.score)
      .slice(0, 10);
  }, [filteredRows]);

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard de Fornecedores</h1>
          <p className="text-sm text-gray-500">
            Score e desempenho executivo dos fornecedores.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/compras/fornecedores"
            className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Ver fornecedores
          </Link>

          <Link
            href="/compras/pedidos"
            className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Ver pedidos
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
              <div className="text-sm text-gray-500">Fornecedores</div>
              <div className="mt-2 text-2xl font-bold">{metrics.totalFornecedores}</div>
              <div className="mt-1 text-xs text-gray-500">
                {metrics.ativos} ativos
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">Excelentes</div>
              <div className="mt-2 text-2xl font-bold">{metrics.excelentes}</div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">Críticos</div>
              <div className="mt-2 text-2xl font-bold">{metrics.criticos}</div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">Melhor score</div>
              <div className="mt-2 text-2xl font-bold">
                {topByScore[0]?.score ?? 0}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Buscar fornecedor</label>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border px-3 py-2 outline-none"
                  placeholder="Nome do fornecedor"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(
                      e.target.value as "todos" | "ativos" | "inativos"
                    )
                  }
                  className="w-full rounded-xl border px-3 py-2 outline-none"
                >
                  <option value="todos">Todos</option>
                  <option value="ativos">Ativos</option>
                  <option value="inativos">Inativos</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Selo</label>
                <select
                  value={sealFilter}
                  onChange={(e) =>
                    setSealFilter(
                      e.target.value as
                        | "todos"
                        | "excelente"
                        | "bom"
                        | "atencao"
                        | "critico"
                    )
                  }
                  className="w-full rounded-xl border px-3 py-2 outline-none"
                >
                  <option value="todos">Todos</option>
                  <option value="excelente">Excelente</option>
                  <option value="bom">Bom</option>
                  <option value="atencao">Atenção</option>
                  <option value="critico">Crítico</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">Top fornecedores por score</h2>

              {topByScore.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhum dado encontrado.</p>
              ) : (
                <div className="space-y-3">
                  {topByScore.map((item) => (
                    <div key={item.supplierId} className="rounded-xl border px-4 py-3">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="font-medium">{item.supplierName}</div>
                          <div className="mt-1">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-medium ${seloClass(
                                item.selo
                              )}`}
                            >
                              {seloLabel(item.selo)}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-xl font-bold">{item.score}</div>
                          <div className="text-xs text-gray-500">score final</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">
                Fornecedores que exigem atenção
              </h2>

              {criticalSuppliers.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Nenhum fornecedor crítico ou em atenção.
                </p>
              ) : (
                <div className="space-y-3">
                  {criticalSuppliers.map((item) => (
                    <div key={item.supplierId} className="rounded-xl border px-4 py-3">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="font-medium">{item.supplierName}</div>
                          <div className="text-xs text-gray-500">
                            Divergências: {item.recebimentosComDivergencia} • Lead time: {item.leadTimeMedio} dias
                          </div>
                        </div>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${seloClass(
                            item.selo
                          )}`}
                        >
                          {seloLabel(item.selo)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Resumo geral por fornecedor</h2>

            {filteredRows.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhum fornecedor encontrado.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-left">
                      <th className="px-4 py-3 font-medium">Fornecedor</th>
                      <th className="px-4 py-3 font-medium">Score</th>
                      <th className="px-4 py-3 font-medium">Selo</th>
                      <th className="px-4 py-3 font-medium">Prazo</th>
                      <th className="px-4 py-3 font-medium">Divergência</th>
                      <th className="px-4 py-3 font-medium">Volume</th>
                      <th className="px-4 py-3 font-medium">Recorrência</th>
                      <th className="px-4 py-3 font-medium">Pedidos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((item) => (
                      <tr key={item.supplierId} className="border-b">
                        <td className="px-4 py-3 font-medium">
                          <Link
                            href={`/compras/fornecedores/${item.supplierId}`}
                            className="underline"
                          >
                            {item.supplierName}
                          </Link>
                        </td>
                        <td className="px-4 py-3 font-bold">{item.score}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium ${seloClass(
                              item.selo
                            )}`}
                          >
                            {seloLabel(item.selo)}
                          </span>
                        </td>
                        <td className="px-4 py-3">{item.scorePrazo}</td>
                        <td className="px-4 py-3">{item.scoreDivergencia}</td>
                        <td className="px-4 py-3">{item.scoreVolume}</td>
                        <td className="px-4 py-3">{item.scoreRecorrencia}</td>
                        <td className="px-4 py-3">{item.totalPedidos}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}