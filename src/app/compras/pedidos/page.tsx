"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  listPurchaseOrders,
  updatePurchaseOrderStatus,
} from "@/lib/compras/orders";
import type { PurchaseOrder, PurchaseOrderStatus } from "@/types/compras";

function statusLabel(status: PurchaseOrderStatus) {
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

function statusClass(status: PurchaseOrderStatus) {
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

export default function PedidosPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      setError("");
      const data = await listPurchaseOrders();
      setOrders(data);
    } catch (err) {
      console.error(err);
      setError("Não foi possível carregar os pedidos.");
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(
    id: string,
    status: PurchaseOrderStatus
  ) {
    try {
      await updatePurchaseOrderStatus(id, status);
      await loadData();
    } catch (err) {
      console.error(err);
      alert("Não foi possível atualizar o status do pedido.");
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pedidos de compra</h1>
          <p className="text-sm text-gray-500">
            Gerencie os pedidos emitidos para os fornecedores.
          </p>
        </div>

        <Link
          href="/compras/pedidos/novo"
          className="inline-flex items-center justify-center rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
        >
          Novo pedido
        </Link>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        {loading ? (
          <p className="text-sm text-gray-500">Carregando pedidos...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-gray-500">
            Nenhum pedido cadastrado ainda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left">
                  <th className="px-4 py-3 font-medium">Número</th>
                  <th className="px-4 py-3 font-medium">Fornecedor</th>
                  <th className="px-4 py-3 font-medium">Solicitação</th>
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Previsão</th>
                  <th className="px-4 py-3 font-medium">Valor total</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="px-4 py-3 font-medium">{item.numero}</td>
                    <td className="px-4 py-3">{item.supplierName}</td>
                    <td className="px-4 py-3">{item.requestNumber || "-"}</td>
                    <td className="px-4 py-3">
                      {item.dataEmissao
                        ? new Date(item.dataEmissao).toLocaleDateString("pt-BR")
                        : "-"}
                    </td>
                    <td className="px-4 py-3">
                      {item.previsaoEntrega
                        ? new Date(item.previsaoEntrega).toLocaleDateString("pt-BR")
                        : "-"}
                    </td>
                    <td className="px-4 py-3">
                      {item.valorTotal.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${statusClass(
                          item.status
                        )}`}
                      >
                        {statusLabel(item.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
  <Link
    href={`/compras/pedidos/${item.id}`}
    className="rounded-lg border px-3 py-1 text-xs font-medium hover:bg-gray-50"
  >
    Abrir
  </Link>

  <select
    value={item.status}
    onChange={(e) =>
      handleStatusChange(
        item.id,
        e.target.value as PurchaseOrderStatus
      )
    }
    className="rounded-lg border px-2 py-1 text-xs"
  >
    <option value="aberto">Aberto</option>
    <option value="enviado">Enviado</option>
    <option value="parcial">Parcial</option>
    <option value="recebido">Recebido</option>
    <option value="cancelado">Cancelado</option>
  </select>
</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}