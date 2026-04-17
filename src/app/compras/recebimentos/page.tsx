"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { listPurchaseOrders } from "@/lib/compras/orders";
import {
  createReceiptFromOrder,
  listGoodsReceipts,
} from "@/lib/compras/receipts";
import type { GoodsReceipt, PurchaseOrder } from "@/types/compras";

function statusLabel(status: GoodsReceipt["status"]) {
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

function statusClass(status: GoodsReceipt["status"]) {
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

export default function RecebimentosPage() {
  const router = useRouter();

  const [receipts, setReceipts] = useState<GoodsReceipt[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    purchaseOrderId: "",
    responsavelId: "admin",
    responsavelNome: "",
    observacoes: "",
  });

  const availableOrders = useMemo(() => {
    return orders.filter((item) =>
      ["aberto", "enviado", "parcial"].includes(item.status)
    );
  }, [orders]);

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [receiptsData, ordersData] = await Promise.all([
        listGoodsReceipts(),
        listPurchaseOrders(),
      ]);

      setReceipts(receiptsData);
      setOrders(ordersData);
    } catch (err) {
      console.error(err);
      setError("Não foi possível carregar os recebimentos.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateReceipt(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!form.purchaseOrderId) {
      setError("Selecione um pedido para iniciar o recebimento.");
      return;
    }

    if (!form.responsavelNome.trim()) {
      setError("Informe o nome do responsável pelo recebimento.");
      return;
    }

    try {
      setCreating(true);
      setError("");

      const receiptId = await createReceiptFromOrder({
        purchaseOrderId: form.purchaseOrderId,
        responsavelId: form.responsavelId,
        responsavelNome: form.responsavelNome,
        observacoes: form.observacoes,
      });

      router.push(`/compras/recebimentos/${receiptId}`);
    } catch (err) {
      console.error(err);
      setError("Não foi possível iniciar o recebimento.");
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Recebimentos</h1>
        <p className="text-sm text-gray-500">
          Inicie, confira e finalize o recebimento das mercadorias.
        </p>
      </div>

      <form
        onSubmit={handleCreateReceipt}
        className="space-y-4 rounded-2xl border bg-white p-6 shadow-sm"
      >
        <div>
          <h2 className="text-lg font-semibold">Novo recebimento</h2>
          <p className="text-sm text-gray-500">
            Selecione um pedido para abrir a conferência de entrada.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Pedido *</label>
            <select
              value={form.purchaseOrderId}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  purchaseOrderId: e.target.value,
                }))
              }
              className="w-full rounded-xl border px-3 py-2 outline-none"
            >
              <option value="">Selecione</option>
              {availableOrders.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.numero} - {item.supplierName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Responsável *
            </label>
            <input
              value={form.responsavelNome}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  responsavelNome: e.target.value,
                }))
              }
              className="w-full rounded-xl border px-3 py-2 outline-none"
              placeholder="Nome do conferente"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Observações iniciais
            </label>
            <input
              value={form.observacoes}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  observacoes: e.target.value,
                }))
              }
              className="w-full rounded-xl border px-3 py-2 outline-none"
              placeholder="Opcional"
            />
          </div>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div>
          <button
            type="submit"
            disabled={creating}
            className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {creating ? "Abrindo..." : "Iniciar recebimento"}
          </button>
        </div>
      </form>

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        {loading ? (
          <p className="text-sm text-gray-500">Carregando recebimentos...</p>
        ) : receipts.length === 0 ? (
          <p className="text-sm text-gray-500">
            Nenhum recebimento iniciado ainda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left">
                  <th className="px-4 py-3 font-medium">Número</th>
                  <th className="px-4 py-3 font-medium">Pedido</th>
                  <th className="px-4 py-3 font-medium">Fornecedor</th>
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
                    <td className="px-4 py-3">{item.purchaseOrderNumber}</td>
                    <td className="px-4 py-3">{item.supplierName}</td>
                    <td className="px-4 py-3">{item.responsavelNome}</td>
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
      </div>
    </div>
  );
}