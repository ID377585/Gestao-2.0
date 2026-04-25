"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { listPurchaseRequests } from "@/lib/compras/requests";
import { listPurchaseOrders } from "@/lib/compras/orders";
import { listGoodsReceipts } from "@/lib/compras/receipts";
import { isLegacyTableMissingError } from "@/lib/legacy/supabase";
import type {
  PurchaseRequest,
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

export default function ComprasDashboardPage() {
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [receipts, setReceipts] = useState<GoodsReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [safeMode, setSafeMode] = useState(false);

  async function loadListWithFallback<T>(
    loader: () => Promise<T[]>,
    label: string
  ) {
    try {
      return {
        data: await loader(),
        usedFallback: false,
      };
    } catch (error) {
      if (!isLegacyTableMissingError(error)) {
        throw error;
      }

      console.warn(`[compras] tabela legada ausente para ${label}; usando fallback vazio.`, error);

      return {
        data: [] as T[],
        usedFallback: true,
      };
    }
  }

  async function loadData() {
    try {
      setLoading(true);
      setError("");
      setSafeMode(false);

      const [requestsResult, ordersResult, receiptsResult] = await Promise.all([
        loadListWithFallback(listPurchaseRequests, "solicitações"),
        loadListWithFallback(listPurchaseOrders, "pedidos"),
        loadListWithFallback(listGoodsReceipts, "recebimentos"),
      ]);

      setRequests(requestsResult.data);
      setOrders(ordersResult.data);
      setReceipts(receiptsResult.data);
      setSafeMode(
        requestsResult.usedFallback ||
          ordersResult.usedFallback ||
          receiptsResult.usedFallback
      );
    } catch (err) {
      console.error(err);
      setError("Não foi possível carregar o dashboard de compras.");
    } finally {
      setLoading(false);
    }
  }

  const requestMetrics = useMemo(() => {
    return {
      total: requests.length,
      pendentes: requests.filter((item) => item.status === "pendente").length,
      emCotacao: requests.filter((item) => item.status === "em_cotacao").length,
      aprovadas: requests.filter((item) => item.status === "aprovada").length,
      rejeitadas: requests.filter((item) => item.status === "rejeitada").length,
      convertidas: requests.filter((item) => item.status === "convertida").length,
    };
  }, [requests]);

  const orderMetrics = useMemo(() => {
    return {
      total: orders.length,
      aberto: orders.filter((item) => item.status === "aberto").length,
      enviado: orders.filter((item) => item.status === "enviado").length,
      parcial: orders.filter((item) => item.status === "parcial").length,
      recebido: orders.filter((item) => item.status === "recebido").length,
      cancelado: orders.filter((item) => item.status === "cancelado").length,
      valorTotal: orders.reduce((acc, item) => acc + Number(item.valorTotal || 0), 0),
    };
  }, [orders]);

  const receiptMetrics = useMemo(() => {
    return {
      total: receipts.length,
      pendentes: receipts.filter((item) => item.status === "pendente").length,
      conferidos: receipts.filter((item) => item.status === "conferido").length,
      divergencia: receipts.filter((item) => item.status === "divergencia").length,
      finalizados: receipts.filter((item) => item.status === "finalizado").length,
      valorRecebido: receipts.reduce(
        (acc, item) => acc + Number(item.valorTotalRecebido || 0),
        0
      ),
    };
  }, [receipts]);

  const ordersBySupplier = useMemo(() => {
    const map = new Map<
      string,
      { supplierName: string; totalPedidos: number; valorTotal: number }
    >();

    for (const order of orders) {
      const key = order.supplierName || "Fornecedor não informado";
      const current = map.get(key) ?? {
        supplierName: key,
        totalPedidos: 0,
        valorTotal: 0,
      };

      current.totalPedidos += 1;
      current.valorTotal += Number(order.valorTotal || 0);

      map.set(key, current);
    }

    return Array.from(map.values()).sort((a, b) => b.valorTotal - a.valorTotal);
  }, [orders]);

  const divergentReceipts = useMemo(() => {
    return receipts
      .filter((item) => item.status === "divergencia")
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
      .slice(0, 10);
  }, [receipts]);

  const leadTimes = useMemo(() => {
    const requestToOrderDays: number[] = [];
    const orderToReceiptDays: number[] = [];
    const requestToReceiptDays: number[] = [];

    for (const order of orders) {
      const linkedRequest = requests.find((req) => req.id === order.requestId);
      const linkedReceipts = receipts
        .filter((receipt) => receipt.purchaseOrderId === order.id)
        .sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));

      const firstReceipt = linkedReceipts[0];

      const a = diffDays(linkedRequest?.createdAt, order.createdAt);
      const b = diffDays(order.createdAt, firstReceipt?.createdAt);
      const c = diffDays(linkedRequest?.createdAt, firstReceipt?.createdAt);

      if (a !== null) requestToOrderDays.push(a);
      if (b !== null) orderToReceiptDays.push(b);
      if (c !== null) requestToReceiptDays.push(c);
    }

    function average(values: number[]) {
      if (!values.length) return 0;
      return Math.round(values.reduce((acc, item) => acc + item, 0) / values.length);
    }

    return {
      requestToOrder: average(requestToOrderDays),
      orderToReceipt: average(orderToReceiptDays),
      requestToReceipt: average(requestToReceiptDays),
    };
  }, [requests, orders, receipts]);

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard de Compras</h1>
          <p className="text-sm text-gray-500">
            Visão executiva de solicitações, pedidos, recebimentos e fornecedores.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/compras/solicitacoes/nova"
            className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Nova solicitação
          </Link>

          <Link
            href="/compras/pedidos/novo"
            className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Novo pedido
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
          {safeMode ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
              <p className="text-sm text-amber-900">
                O dashboard foi carregado em modo seguro porque as tabelas legadas do
                módulo de compras ainda não estão provisionadas neste banco. Os
                indicadores ficam zerados até essa estrutura existir.
              </p>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">Solicitações</div>
              <div className="mt-2 text-2xl font-bold">{requestMetrics.total}</div>
              <div className="mt-1 text-xs text-gray-500">
                {requestMetrics.pendentes} pendentes • {requestMetrics.convertidas} convertidas
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">Pedidos</div>
              <div className="mt-2 text-2xl font-bold">{orderMetrics.total}</div>
              <div className="mt-1 text-xs text-gray-500">
                {orderMetrics.aberto} abertos • {orderMetrics.recebido} recebidos
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">Recebimentos</div>
              <div className="mt-2 text-2xl font-bold">{receiptMetrics.total}</div>
              <div className="mt-1 text-xs text-gray-500">
                {receiptMetrics.divergencia} com divergência • {receiptMetrics.finalizados} finalizados
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">Valor total pedido</div>
              <div className="mt-2 text-2xl font-bold">
                {formatCurrency(orderMetrics.valorTotal)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">Solicitação → Pedido</div>
              <div className="mt-2 text-2xl font-bold">
                {leadTimes.requestToOrder} dias
              </div>
              <div className="mt-1 text-xs text-gray-500">Tempo médio</div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">Pedido → Recebimento</div>
              <div className="mt-2 text-2xl font-bold">
                {leadTimes.orderToReceipt} dias
              </div>
              <div className="mt-1 text-xs text-gray-500">Tempo médio</div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">Solicitação → Recebimento</div>
              <div className="mt-2 text-2xl font-bold">
                {leadTimes.requestToReceipt} dias
              </div>
              <div className="mt-1 text-xs text-gray-500">Tempo médio</div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">Solicitações por status</h2>

              <div className="space-y-3">
                {[
                  ["Pendentes", requestMetrics.pendentes],
                  ["Em cotação", requestMetrics.emCotacao],
                  ["Aprovadas", requestMetrics.aprovadas],
                  ["Rejeitadas", requestMetrics.rejeitadas],
                  ["Convertidas", requestMetrics.convertidas],
                ].map(([label, total]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between rounded-xl border px-4 py-3"
                  >
                    <div className="font-medium">{label}</div>
                    <div className="font-semibold">{total}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">Recebimentos por status</h2>

              <div className="space-y-3">
                {[
                  ["Pendentes", receiptMetrics.pendentes],
                  ["Conferidos", receiptMetrics.conferidos],
                  ["Com divergência", receiptMetrics.divergencia],
                  ["Finalizados", receiptMetrics.finalizados],
                ].map(([label, total]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between rounded-xl border px-4 py-3"
                  >
                    <div className="font-medium">{label}</div>
                    <div className="font-semibold">{total}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">Pedidos por fornecedor</h2>

              {ordersBySupplier.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhum pedido encontrado.</p>
              ) : (
                <div className="space-y-3">
                  {ordersBySupplier.slice(0, 10).map((item) => (
                    <div
                      key={item.supplierName}
                      className="rounded-xl border px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="font-medium">{item.supplierName}</div>
                        <div className="font-semibold">
                          {formatCurrency(item.valorTotal)}
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {item.totalPedidos} pedido(s)
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">
                Recebimentos com divergência
              </h2>

              {divergentReceipts.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Nenhum recebimento com divergência.
                </p>
              ) : (
                <div className="space-y-3">
                  {divergentReceipts.map((item) => (
                    <div key={item.id} className="rounded-xl border px-4 py-3">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="font-medium">{item.numero}</div>
                          <div className="text-xs text-gray-500">
                            {item.supplierName}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-semibold">
                            {formatCurrency(item.valorTotalRecebido)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {item.dataRecebimento
                              ? new Date(item.dataRecebimento).toLocaleDateString("pt-BR")
                              : "-"}
                          </div>
                        </div>
                      </div>

                      <div className="mt-2">
                        <Link
                          href={`/compras/recebimentos/${item.id}`}
                          className="text-sm font-medium underline"
                        >
                          Abrir recebimento
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Ações rápidas</h2>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Link
                href="/compras/solicitacoes"
                className="rounded-xl border px-4 py-4 text-sm font-medium hover:bg-gray-50"
              >
                Ver solicitações
              </Link>

              <Link
                href="/compras/pedidos"
                className="rounded-xl border px-4 py-4 text-sm font-medium hover:bg-gray-50"
              >
                Ver pedidos
              </Link>

              <Link
                href="/compras/recebimentos"
                className="rounded-xl border px-4 py-4 text-sm font-medium hover:bg-gray-50"
              >
                Ver recebimentos
              </Link>

              <Link
                href="/compras/auditoria"
                className="rounded-xl border px-4 py-4 text-sm font-medium hover:bg-gray-50"
              >
                Abrir auditoria
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
