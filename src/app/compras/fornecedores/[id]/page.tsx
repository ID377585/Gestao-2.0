"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getSupplierById } from "@/lib/compras/suppliers";
import { listPurchaseOrders } from "@/lib/compras/orders";
import { listGoodsReceipts } from "@/lib/compras/receipts";
import { calculateSupplierScore } from "@/lib/compras/supplier-score";
import { isLegacyTableMissingError } from "@/lib/legacy/supabase";
import type { GoodsReceipt, PurchaseOrder, Supplier } from "@/types/compras";

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

function seloLabel(selo: "excelente" | "bom" | "atencao" | "critico") {
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

function seloClass(selo: "excelente" | "bom" | "atencao" | "critico") {
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

export default function FornecedorDetalhePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const supplierId = params.id;

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [receipts, setReceipts] = useState<GoodsReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [safeMode, setSafeMode] = useState(false);

  const loadListWithFallback = useCallback(
    async <T,>(loader: () => Promise<T[]>, label: string) => {
      try {
        return {
          data: await loader(),
          usedFallback: false,
        };
      } catch (err) {
        if (!isLegacyTableMissingError(err)) {
          throw err;
        }

        console.warn(
          `[fornecedor.detalhe] tabela legada ausente para ${label}; usando fallback vazio.`,
          err
        );

        return {
          data: [] as T[],
          usedFallback: true,
        };
      }
    },
    []
  );

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setSafeMode(false);

      const supplierData = await getSupplierById(supplierId);

      if (!supplierData) {
        setSupplier(null);
        setOrders([]);
        setReceipts([]);
        setError("Fornecedor não encontrado.");
        return;
      }

      const [ordersResult, receiptsResult] = await Promise.all([
        loadListWithFallback(listPurchaseOrders, "pedidos"),
        loadListWithFallback(listGoodsReceipts, "recebimentos"),
      ]);

      const supplierOrders = ordersResult.data.filter(
        (item) => item.supplierId === supplierData.id
      );

      const orderIds = supplierOrders.map((item) => item.id);

      const supplierReceipts = receiptsResult.data.filter((item) =>
        orderIds.includes(item.purchaseOrderId)
      );

      setSupplier(supplierData);
      setOrders(supplierOrders);
      setReceipts(supplierReceipts);
      setSafeMode(
        ordersResult.usedFallback || receiptsResult.usedFallback
      );
    } catch (err) {
      console.error(err);
      setSupplier(null);
      setOrders([]);
      setReceipts([]);
      setError("Não foi possível carregar o fornecedor.");
    } finally {
      setLoading(false);
    }
  }, [supplierId, loadListWithFallback]);

  const metrics = useMemo(() => {
    const leadTimes: number[] = [];

    for (const order of orders) {
      const firstReceipt = receipts
        .filter((item) => item.purchaseOrderId === order.id)
        .sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""))[0];

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

    const recebimentosComDivergencia = receipts.filter(
      (item) => item.status === "divergencia"
    ).length;

    const score = calculateSupplierScore({
      totalPedidos: orders.length,
      valorTotalComprado: orders.reduce(
        (acc, item) => acc + Number(item.valorTotal || 0),
        0
      ),
      recebimentosComDivergencia,
      totalRecebimentos: receipts.length,
      leadTimeMedio,
    });

    return {
      totalPedidos: orders.length,
      valorTotalComprado: orders.reduce(
        (acc, item) => acc + Number(item.valorTotal || 0),
        0
      ),
      totalRecebimentos: receipts.length,
      valorTotalRecebido: receipts.reduce(
        (acc, item) => acc + Number(item.valorTotalRecebido || 0),
        0
      ),
      recebimentosComDivergencia,
      leadTimeMedio,
      ...score,
    };
  }, [orders, receipts]);

  const latestOrders = useMemo(() => {
    return [...orders]
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
      .slice(0, 10);
  }, [orders]);

  const divergentReceipts = useMemo(() => {
    return receipts
      .filter((item) => item.status === "divergencia")
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
      .slice(0, 10);
  }, [receipts]);

  const scoreHistory = useMemo(() => {
    const sortedOrders = [...orders].sort((a, b) =>
      (a.createdAt || "").localeCompare(b.createdAt || "")
    );

    return sortedOrders.map((order, index) => {
      const partialOrders = sortedOrders.slice(0, index + 1);
      const partialOrderIds = partialOrders.map((item) => item.id);
      const partialReceipts = receipts.filter((item) =>
        partialOrderIds.includes(item.purchaseOrderId)
      );

      const leadTimes: number[] = [];

      for (const partialOrder of partialOrders) {
        const firstReceipt = partialReceipts
          .filter((item) => item.purchaseOrderId === partialOrder.id)
          .sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""))[0];

        const diff = diffDays(partialOrder.createdAt, firstReceipt?.createdAt);

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

      const partialScore = calculateSupplierScore({
        totalPedidos: partialOrders.length,
        valorTotalComprado: partialOrders.reduce(
          (acc, item) => acc + Number(item.valorTotal || 0),
          0
        ),
        recebimentosComDivergencia: partialReceipts.filter(
          (item) => item.status === "divergencia"
        ).length,
        totalRecebimentos: partialReceipts.length,
        leadTimeMedio,
      });

      return {
        label: order.numero,
        score: partialScore.score,
      };
    });
  }, [orders, receipts]);

  useEffect(() => {
    if (supplierId) {
      void loadData();
    }
  }, [supplierId, loadData]);

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500">Carregando fornecedor...</p>
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="space-y-4 p-6">
        <p className="text-sm text-red-600">
          {error || "Fornecedor não encontrado."}
        </p>
        <button
          onClick={() => router.push("/compras/fornecedores")}
          className="rounded-xl border px-4 py-2 text-sm font-medium"
        >
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {safeMode ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          O fornecedor foi carregado em modo seguro. Pedidos e/ou recebimentos
          do módulo de compras ainda não estão totalmente provisionados neste banco,
          então os indicadores podem aparecer zerados.
        </div>
      ) : null}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{supplier.razaoSocial}</h1>
          <p className="text-sm text-gray-500">
            {supplier.nomeFantasia || "Sem nome fantasia"}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <span
            className={`rounded-full px-3 py-2 text-sm font-medium ${seloClass(
              metrics.selo
            )}`}
          >
            {seloLabel(metrics.selo)} • Score {metrics.score}
          </span>

          <Link
            href="/compras/fornecedores/dashboard"
            className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Voltar ao dashboard
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Pedidos</div>
          <div className="mt-2 text-2xl font-bold">{metrics.totalPedidos}</div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Valor comprado</div>
          <div className="mt-2 text-2xl font-bold">
            {formatCurrency(metrics.valorTotalComprado)}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Divergências</div>
          <div className="mt-2 text-2xl font-bold">
            {metrics.recebimentosComDivergencia}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Lead time médio</div>
          <div className="mt-2 text-2xl font-bold">
            {metrics.leadTimeMedio} dias
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Dados cadastrais</h2>

        <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2 xl:grid-cols-4">
          <div>
            <span className="font-medium">Razão social:</span>{" "}
            {supplier.razaoSocial}
          </div>
          <div>
            <span className="font-medium">Nome fantasia:</span>{" "}
            {supplier.nomeFantasia || "-"}
          </div>
          <div>
            <span className="font-medium">Contato:</span>{" "}
            {supplier.contato || "-"}
          </div>
          <div>
            <span className="font-medium">Telefone:</span>{" "}
            {supplier.telefone || "-"}
          </div>
          <div>
            <span className="font-medium">E-mail:</span>{" "}
            {supplier.email || "-"}
          </div>
          <div>
            <span className="font-medium">CNPJ:</span>{" "}
            {supplier.cnpj || "-"}
          </div>
          <div>
            <span className="font-medium">Status:</span>{" "}
            {supplier.ativo ? "Ativo" : "Inativo"}
          </div>
          <div>
            <span className="font-medium">Endereço:</span>{" "}
            {supplier.endereco || "-"}
          </div>
        </div>

        {supplier.observacoes ? (
          <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm">
            <span className="font-medium">Observações:</span>{" "}
            {supplier.observacoes}
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Composição do score</h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border p-4">
            <div className="text-sm text-gray-500">Prazo</div>
            <div className="mt-1 text-xl font-bold">{metrics.scorePrazo}</div>
          </div>

          <div className="rounded-xl border p-4">
            <div className="text-sm text-gray-500">Divergência</div>
            <div className="mt-1 text-xl font-bold">
              {metrics.scoreDivergencia}
            </div>
          </div>

          <div className="rounded-xl border p-4">
            <div className="text-sm text-gray-500">Volume</div>
            <div className="mt-1 text-xl font-bold">{metrics.scoreVolume}</div>
          </div>

          <div className="rounded-xl border p-4">
            <div className="text-sm text-gray-500">Recorrência</div>
            <div className="mt-1 text-xl font-bold">
              {metrics.scoreRecorrencia}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Últimos pedidos</h2>

          {latestOrders.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum pedido encontrado.</p>
          ) : (
            <div className="space-y-3">
              {latestOrders.map((item) => (
                <div key={item.id} className="rounded-xl border px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="font-medium">{item.numero}</div>
                      <div className="text-xs text-gray-500">{item.status}</div>
                    </div>

                    <div className="text-right">
                      <div className="font-semibold">
                        {formatCurrency(item.valorTotal)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {item.createdAt
                          ? new Date(item.createdAt).toLocaleDateString("pt-BR")
                          : "-"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-3">
                    <Link
                      href={`/compras/pedidos/${item.id}`}
                      className="text-sm font-medium underline"
                    >
                      Abrir pedido
                    </Link>

                    <Link
                      href={`/compras/fornecedores/${supplier.id}/plano-de-acao`}
                      className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
                    >
                      Plano de ação
                    </Link>

                    <Link
                      href="/compras/follow-up"
                      className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
                    >
                      Central de follow-up
                    </Link>

                    <Link
                      href="/compras/dashboard-diario"
                      className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
                    >
                      Dashboard diário
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">
            Histórico de divergências
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
                        Status: {item.status}
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

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Evolução do score</h2>

        {scoreHistory.length === 0 ? (
          <p className="text-sm text-gray-500">
            Ainda não há histórico suficiente para evolução.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {scoreHistory.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-xl border px-4 py-3"
              >
                <div className="font-medium">{item.label}</div>
                <div className="font-semibold">{item.score}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}