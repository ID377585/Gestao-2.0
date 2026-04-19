"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { usePurchaseHistory } from "@/hooks/use-purchase-history";
import PurchaseHistoryCard from "@/components/compras/purchase-history-card";
import {
  getPurchaseOrderById,
  listPurchaseOrderItems,
} from "@/lib/compras/orders";
import {
  createReceiptFromOrder,
  listGoodsReceiptsByOrderId,
} from "@/lib/compras/receipts";
import {
  getPurchaseRequestById,
  listPurchaseRequestItems,
} from "@/lib/compras/requests";
import type {
  GoodsReceipt,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseRequest,
  PurchaseRequestItem,
} from "@/types/compras";

const { createPurchaseHistoryEntryWithUser } = usePurchaseHistory();

function orderStatusLabel(status: PurchaseOrder["status"]) {
  switch (status) {
    case "aberto":
      return "Aberto";
    case "enviado":
      return "Enviado";
    case "parcial":
      return "Parcial";
    case "recebido":
      return "Recebido";
    case "cancelado":
      return "Cancelado";
    default:
      return status;
  }
}

function orderStatusClass(status: PurchaseOrder["status"]) {
  switch (status) {
    case "aberto":
      return "bg-yellow-100 text-yellow-800";
    case "enviado":
      return "bg-blue-100 text-blue-800";
    case "parcial":
      return "bg-orange-100 text-orange-800";
    case "recebido":
      return "bg-green-100 text-green-800";
    case "cancelado":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function requestStatusLabel(status: PurchaseRequest["status"]) {
  switch (status) {
    case "pendente":
      return "Pendente";
    case "em_cotacao":
      return "Em cotação";
    case "aprovada":
      return "Aprovada";
    case "rejeitada":
      return "Rejeitada";
    case "convertida":
      return "Convertida";
    default:
      return status;
  }
}

function requestStatusClass(status: PurchaseRequest["status"]) {
  switch (status) {
    case "pendente":
      return "bg-yellow-100 text-yellow-800";
    case "em_cotacao":
      return "bg-blue-100 text-blue-800";
    case "aprovada":
      return "bg-green-100 text-green-800";
    case "rejeitada":
      return "bg-red-100 text-red-800";
    case "convertida":
      return "bg-purple-100 text-purple-800";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function receiptStatusLabel(status: GoodsReceipt["status"]) {
  switch (status) {
    case "pendente":
      return "Pendente";
    case "conferido":
      return "Conferido";
    case "divergencia":
      return "Com divergência";
    case "finalizado":
      return "Finalizado";
    default:
      return status;
  }
}

function receiptStatusClass(status: GoodsReceipt["status"]) {
  switch (status) {
    case "pendente":
      return "bg-yellow-100 text-yellow-800";
    case "conferido":
      return "bg-blue-100 text-blue-800";
    case "divergencia":
      return "bg-red-100 text-red-800";
    case "finalizado":
      return "bg-green-100 text-green-800";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

export default function PedidoDetalhePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const orderId = params.id;

  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [orderItems, setOrderItems] = useState<PurchaseOrderItem[]>([]);
  const [request, setRequest] = useState<PurchaseRequest | null>(null);
  const [requestItems, setRequestItems] = useState<PurchaseRequestItem[]>([]);
  const [receipts, setReceipts] = useState<GoodsReceipt[]>([]);

  const [loading, setLoading] = useState(true);
  const [startingReceipt, setStartingReceipt] = useState(false);
  const [error, setError] = useState("");

  const canStartReceipt = useMemo(() => {
    if (!order) return false;
    return ["aberto", "enviado", "parcial"].includes(order.status);
  }, [order]);

  const totalItems = useMemo(() => {
    return orderItems.reduce((acc, item) => acc + Number(item.quantidade), 0);
  }, [orderItems]);

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const orderData = await getPurchaseOrderById(orderId);

      if (!orderData) {
        setError("Pedido não encontrado.");
        setLoading(false);
        return;
      }

      setOrder(orderData);

      const [itemsData, receiptsData] = await Promise.all([
        listPurchaseOrderItems(orderData.id),
        listGoodsReceiptsByOrderId(orderData.id),
      ]);

      setOrderItems(itemsData);
      setReceipts(receiptsData);

      if (orderData.requestId) {
        const [requestData, requestItemsData] = await Promise.all([
          getPurchaseRequestById(orderData.requestId),
          listPurchaseRequestItems(orderData.requestId),
        ]);

        setRequest(requestData);
        setRequestItems(requestItemsData);
      } else {
        setRequest(null);
        setRequestItems([]);
      }
    } catch (err) {
      console.error(err);
      setError("Não foi possível carregar o pedido.");
    } finally {
      setLoading(false);
    }
  }

  async function handleStartReceipt() {
    if (!order) return;

    try {
      setStartingReceipt(true);
      setError("");

      const receiptId = await createReceiptFromOrder({
        purchaseOrderId: order.id,
        responsavelId: "admin",
        responsavelNome: "Administrador",
        observacoes: `Recebimento iniciado a partir do pedido ${order.numero}`,
      });

      await createPurchaseHistoryEntryWithUser({
  entityType: "pedido",
  entityId: order.id,
  action: "recebimento_iniciado",
  title: "Recebimento iniciado a partir do pedido",
  description: `Recebimento ${receiptId}`,
  relatedEntityType: "recebimento",
  relatedEntityId: receiptId,
});

      router.push(`/compras/recebimentos/${receiptId}`);
    } catch (err) {
      console.error(err);
      setError("Não foi possível iniciar o recebimento.");
    } finally {
      setStartingReceipt(false);
    }
  }

  useEffect(() => {
    if (orderId) {
      loadData();
    }
  }, [orderId]);

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500">Carregando pedido...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="space-y-4 p-6">
        <p className="text-sm text-red-600">
          {error || "Pedido não encontrado."}
        </p>
        <button
          onClick={() => router.push("/compras/pedidos")}
          className="rounded-xl border px-4 py-2 text-sm font-medium"
        >
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pedido {order.numero}</h1>
          <p className="text-sm text-gray-500">
            Fornecedor {order.supplierName}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {canStartReceipt ? (
            <button
              type="button"
              disabled={startingReceipt}
              onClick={handleStartReceipt}
              className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {startingReceipt ? "Abrindo..." : "Iniciar recebimento"}
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => router.push("/compras/pedidos")}
            className="rounded-xl border px-4 py-2 text-sm font-medium"
          >
            Voltar
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Status do pedido</div>
          <div className="mt-2">
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${orderStatusClass(
                order.status
              )}`}
            >
              {orderStatusLabel(order.status)}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Valor total</div>
          <div className="mt-2 text-xl font-bold">
            {Number(order.valorTotal).toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Itens</div>
          <div className="mt-2 text-xl font-bold">{orderItems.length}</div>
          <div className="text-xs text-gray-500">
            Quantidade total: {totalItems}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Recebimentos</div>
          <div className="mt-2 text-xl font-bold">{receipts.length}</div>
          <div className="text-xs text-gray-500">
            Abertos ou finalizados para este pedido
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Dados do pedido</h2>

        <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2 xl:grid-cols-3">
          <div>
            <span className="font-medium">Fornecedor:</span> {order.supplierName}
          </div>
          <div>
            <span className="font-medium">Data de emissão:</span>{" "}
            {order.dataEmissao
              ? new Date(order.dataEmissao).toLocaleDateString("pt-BR")
              : "-"}
          </div>
          <div>
            <span className="font-medium">Previsão de entrega:</span>{" "}
            {order.previsaoEntrega
              ? new Date(order.previsaoEntrega).toLocaleDateString("pt-BR")
              : "-"}
          </div>
          <div>
            <span className="font-medium">Vencimento:</span>{" "}
            {order.vencimento
              ? new Date(order.vencimento).toLocaleDateString("pt-BR")
              : "-"}
          </div>
          <div>
            <span className="font-medium">Criado por:</span> {order.createdByName}
          </div>
          <div>
            <span className="font-medium">Solicitação vinculada:</span>{" "}
            {order.requestNumber || "-"}
          </div>
        </div>

        {order.observacoes ? (
          <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm">
            <span className="font-medium">Observações:</span> {order.observacoes}
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Itens do pedido</h2>
        </div>

        {orderItems.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum item neste pedido.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left">
                  <th className="px-4 py-3 font-medium">Produto</th>
                  <th className="px-4 py-3 font-medium">Unidade</th>
                  <th className="px-4 py-3 font-medium">Quantidade</th>
                  <th className="px-4 py-3 font-medium">Valor unitário</th>
                  <th className="px-4 py-3 font-medium">Desconto</th>
                  <th className="px-4 py-3 font-medium">Valor total</th>
                </tr>
              </thead>
              <tbody>
                {orderItems.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="px-4 py-3">
                      <div className="font-medium">{item.produtoNome}</div>
                      {item.observacao ? (
                        <div className="text-xs text-gray-500">
                          {item.observacao}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{item.unidade}</td>
                    <td className="px-4 py-3">{item.quantidade}</td>
                    <td className="px-4 py-3">
                      {Number(item.valorUnitario).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      {Number(item.desconto ?? 0).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {Number(item.valorTotal).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {request ? (
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Solicitação vinculada</h2>
              <p className="text-sm text-gray-500">{request.numero}</p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${requestStatusClass(
                request.status
              )}`}
            >
              {requestStatusLabel(request.status)}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2 xl:grid-cols-4">
            <div>
              <span className="font-medium">Setor:</span>{" "}
              {request.setorSolicitante}
            </div>
            <div>
              <span className="font-medium">Solicitante:</span>{" "}
              {request.solicitanteNome}
            </div>
            <div>
              <span className="font-medium">Data:</span>{" "}
              {request.dataSolicitacao
                ? new Date(request.dataSolicitacao).toLocaleDateString("pt-BR")
                : "-"}
            </div>
            <div>
              <span className="font-medium">Itens:</span> {request.totalItens}
            </div>
          </div>

          {request.observacoes ? (
            <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm">
              <span className="font-medium">Observações:</span>{" "}
              {request.observacoes}
            </div>
          ) : null}

          <div className="mt-6">
            <h3 className="mb-3 text-base font-semibold">
              Itens da solicitação
            </h3>

            {requestItems.length === 0 ? (
              <p className="text-sm text-gray-500">
                Nenhum item encontrado na solicitação.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-left">
                      <th className="px-4 py-3 font-medium">Produto</th>
                      <th className="px-4 py-3 font-medium">Unidade</th>
                      <th className="px-4 py-3 font-medium">Quantidade</th>
                      <th className="px-4 py-3 font-medium">Observação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requestItems.map((item) => (
                      <tr key={item.id} className="border-b">
                        <td className="px-4 py-3 font-medium">
                          {item.produtoNome}
                        </td>
                        <td className="px-4 py-3">{item.unidade}</td>
                        <td className="px-4 py-3">{item.quantidade}</td>
                        <td className="px-4 py-3">{item.observacao || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Recebimentos vinculados</h2>
            <p className="text-sm text-gray-500">
              Conferências abertas ou finalizadas para este pedido
            </p>
          </div>

          {canStartReceipt ? (
            <button
              type="button"
              disabled={startingReceipt}
              onClick={handleStartReceipt}
              className="rounded-xl border px-4 py-2 text-sm font-medium"
            >
              {startingReceipt ? "Abrindo..." : "Novo recebimento"}
            </button>
          ) : null}
        </div>

        {receipts.length === 0 ? (
          <p className="text-sm text-gray-500">
            Nenhum recebimento vinculado ainda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left">
                  <th className="px-4 py-3 font-medium">Número</th>
                  <th className="px-4 py-3 font-medium">Responsável</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Valor recebido</th>
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="px-4 py-3 font-medium">{item.numero}</td>
                    <td className="px-4 py-3">{item.responsavelNome}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${receiptStatusClass(
                          item.status
                        )}`}
                      >
                        {receiptStatusLabel(item.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {Number(item.valorTotalRecebido ?? 0).toLocaleString(
                        "pt-BR",
                        {
                          style: "currency",
                          currency: "BRL",
                        }
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {item.dataRecebimento
                        ? new Date(item.dataRecebimento).toLocaleDateString(
                            "pt-BR"
                          )
                        : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/compras/recebimentos/${item.id}`}
                        className="rounded-lg border px-3 py-1 text-xs font-medium hover:bg-gray-50"
                      >
                        Abrir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <PurchaseHistoryCard entityType="pedido" entityId={order.id} />
      </div>
    </div>
  );
}