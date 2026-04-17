"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getPurchaseOrderById } from "@/lib/compras/orders";
import {
  finalizeGoodsReceipt,
  getGoodsReceiptById,
  listGoodsReceiptItems,
} from "@/lib/compras/receipts";
import type { GoodsReceipt, GoodsReceiptItem } from "@/types/compras";

type EditableReceiptItem = GoodsReceiptItem;

export default function RecebimentoDetalhePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const receiptId = params.id;

  const [receipt, setReceipt] = useState<GoodsReceipt | null>(null);
  const [items, setItems] = useState<EditableReceiptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [observacoes, setObservacoes] = useState("");
  const [vencimento, setVencimento] = useState("");

  const isLocked = Boolean(receipt?.inventoryApplied);

  const totalRecebido = useMemo(() => {
    return items.reduce((acc, item) => {
      return (
        acc +
        Number(item.quantidadeRecebida || 0) * Number(item.valorUnitarioReal || 0)
      );
    }, 0);
  }, [items]);

  const hasDivergencePreview = useMemo(() => {
    return items.some((item) => {
      const quantidadeDiff =
        Number(item.quantidadeRecebida) !== Number(item.quantidadePedido);

      const precoDiff =
        Number(item.valorUnitarioReal) !== Number(item.valorUnitarioPedido);

      return quantidadeDiff || precoDiff || Boolean(item.motivoDivergencia?.trim());
    });
  }, [items]);

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const receiptData = await getGoodsReceiptById(receiptId);

      if (!receiptData) {
        setError("Recebimento não encontrado.");
        setLoading(false);
        return;
      }

      const itemsData = await listGoodsReceiptItems(receiptId);

      setReceipt(receiptData);
      setItems(itemsData);
      setObservacoes(receiptData.observacoes ?? "");

      const order = await getPurchaseOrderById(receiptData.purchaseOrderId);
      setVencimento(order?.vencimento ?? "");
    } catch (err) {
      console.error(err);
      setError("Não foi possível carregar o recebimento.");
    } finally {
      setLoading(false);
    }
  }

  function updateItem(
    itemId: string,
    field: keyof EditableReceiptItem,
    value: string | number | boolean
  ) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              [field]: value,
            }
          : item
      )
    );
  }

  async function handleFinalize() {
  if (!receipt) return;

  try {
    setSaving(true);
    setError("");

    const result = await finalizeGoodsReceipt({
      receiptId: receipt.id,
      observacoes,
      vencimento,
      items: items.map((item) => ({
        id: item.id,
        quantidadeRecebida: Number(item.quantidadeRecebida),
        valorUnitarioReal: Number(item.valorUnitarioReal),
        lote: item.lote ?? "",
        validade: item.validade ?? "",
        motivoDivergencia: item.motivoDivergencia ?? "",
      })),
    });

    await loadData();

    if (result.alreadyApplied) {
      alert("Este recebimento já havia sido aplicado ao estoque.");
      return;
    }

    if (result.inventoryPendingLink) {
      alert(
        "Recebimento finalizado, mas há itens sem productId. O movimento foi registrado e ficou pendente de vínculo com produto."
      );
      return;
    }

    alert("Recebimento finalizado com sucesso e estoque atualizado.");
  } catch (err) {
    console.error(err);
    setError(
      err instanceof Error
        ? err.message
        : "Não foi possível finalizar o recebimento."
    );
  } finally {
    setSaving(false);
  }
}

  useEffect(() => {
    if (receiptId) {
      loadData();
    }
  }, [receiptId]);

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500">Carregando recebimento...</p>
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="space-y-4 p-6">
        <p className="text-sm text-red-600">
          {error || "Recebimento não encontrado."}
        </p>
        <button
          onClick={() => router.push("/compras/recebimentos")}
          className="rounded-xl border px-4 py-2 text-sm font-medium"
        >
          Voltar
        </button>
      </div>
    );
  }

{receipt.inventoryApplied ? (
  <div
    className={`rounded-2xl border p-4 text-sm ${
      receipt.inventoryPendingLink
        ? "border-orange-200 bg-orange-50 text-orange-800"
        : "border-green-200 bg-green-50 text-green-800"
    }`}
  >
    {receipt.inventoryPendingLink
      ? "Este recebimento já gerou movimentações, mas existem itens sem vínculo com productId. O saldo consolidado desses itens não foi atualizado."
      : "Este recebimento já foi aplicado ao estoque e ao financeiro."}
  </div>
) : null}

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Recebimento {receipt.numero}</h1>
          <p className="text-sm text-gray-500">
            Pedido {receipt.purchaseOrderNumber} • Fornecedor {receipt.supplierName}
          </p>
        </div>

        <div className="rounded-2xl border bg-white px-4 py-3 text-sm shadow-sm">
          <div>
            <span className="font-medium">Responsável:</span>{" "}
            {receipt.responsavelNome}
          </div>
          <div>
            <span className="font-medium">Status:</span> {receipt.status}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Observações do recebimento
            </label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              disabled={isLocked}
              className="min-h-[100px] w-full rounded-xl border px-3 py-2 outline-none disabled:bg-gray-50"
              placeholder="Observações gerais do recebimento"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Vencimento financeiro
            </label>
            <input
              type="date"
              value={vencimento}
              onChange={(e) => setVencimento(e.target.value)}
              disabled={isLocked}
              className="w-full rounded-xl border px-3 py-2 outline-none disabled:bg-gray-50"
            />
            <p className="mt-2 text-xs text-gray-500">
              Esse vencimento será usado para gerar a conta a pagar, se ainda
              não existir.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {items.map((item, index) => {
          const previewDivergence =
            Number(item.quantidadeRecebida) !== Number(item.quantidadePedido) ||
            Number(item.valorUnitarioReal) !== Number(item.valorUnitarioPedido) ||
            Boolean(item.motivoDivergencia?.trim());

          return (
            <div
              key={item.id}
              className="grid grid-cols-1 gap-4 rounded-2xl border bg-white p-4 shadow-sm md:grid-cols-12"
            >
              <div className="md:col-span-3">
                <label className="mb-1 block text-sm font-medium">
                  Produto
                </label>
                <input
                  value={item.produtoNome}
                  disabled
                  className="w-full rounded-xl border bg-gray-50 px-3 py-2 outline-none"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Item {index + 1}
                </p>
              </div>

              <div className="md:col-span-1">
                <label className="mb-1 block text-sm font-medium">
                  Unidade
                </label>
                <input
                  value={item.unidade}
                  disabled
                  className="w-full rounded-xl border bg-gray-50 px-3 py-2 outline-none"
                />
              </div>

              <div className="md:col-span-1">
                <label className="mb-1 block text-sm font-medium">
                  Qtd. pedido
                </label>
                <input
                  value={item.quantidadePedido}
                  disabled
                  className="w-full rounded-xl border bg-gray-50 px-3 py-2 outline-none"
                />
              </div>

              <div className="md:col-span-1">
                <label className="mb-1 block text-sm font-medium">
                  Qtd. recebida
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={item.quantidadeRecebida}
                  disabled={isLocked}
                  onChange={(e) =>
                    updateItem(
                      item.id,
                      "quantidadeRecebida",
                      Number(e.target.value)
                    )
                  }
                  className="w-full rounded-xl border px-3 py-2 outline-none disabled:bg-gray-50"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium">
                  Valor pedido
                </label>
                <input
                  value={item.valorUnitarioPedido}
                  disabled
                  className="w-full rounded-xl border bg-gray-50 px-3 py-2 outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium">
                  Valor real
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={item.valorUnitarioReal}
                  disabled={isLocked}
                  onChange={(e) =>
                    updateItem(
                      item.id,
                      "valorUnitarioReal",
                      Number(e.target.value)
                    )
                  }
                  className="w-full rounded-xl border px-3 py-2 outline-none disabled:bg-gray-50"
                />
              </div>

              <div className="md:col-span-1">
                <label className="mb-1 block text-sm font-medium">Lote</label>
                <input
                  value={item.lote ?? ""}
                  disabled={isLocked}
                  onChange={(e) => updateItem(item.id, "lote", e.target.value)}
                  className="w-full rounded-xl border px-3 py-2 outline-none disabled:bg-gray-50"
                  placeholder="Lote"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium">
                  Validade
                </label>
                <input
                  type="date"
                  value={item.validade ?? ""}
                  disabled={isLocked}
                  onChange={(e) =>
                    updateItem(item.id, "validade", e.target.value)
                  }
                  className="w-full rounded-xl border px-3 py-2 outline-none disabled:bg-gray-50"
                />
              </div>

              <div className="md:col-span-8">
                <label className="mb-1 block text-sm font-medium">
                  Motivo da divergência
                </label>
                <input
                  value={item.motivoDivergencia ?? ""}
                  disabled={isLocked}
                  onChange={(e) =>
                    updateItem(item.id, "motivoDivergencia", e.target.value)
                  }
                  className="w-full rounded-xl border px-3 py-2 outline-none disabled:bg-gray-50"
                  placeholder="Ex.: fornecedor entregou 18 de 20 unidades"
                />
              </div>

              <div className="md:col-span-4 flex items-end">
                <div
                  className={`w-full rounded-xl px-3 py-2 text-center text-sm font-medium ${
                    previewDivergence
                      ? "bg-red-100 text-red-700"
                      : "bg-green-100 text-green-700"
                  }`}
                >
                  {previewDivergence ? "Com divergência" : "Sem divergência"}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Resumo do recebimento</h2>
            <p className="text-sm text-gray-500">
              O sistema vai gerar movimentações de estoque e conta a pagar ao
              finalizar.
            </p>
          </div>

          <div className="text-right">
            <div className="text-sm text-gray-500">Total recebido</div>
            <div className="text-2xl font-bold">
              {totalRecebido.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm">
          <div>
            <span className="font-medium">Prévia de status:</span>{" "}
            {hasDivergencePreview ? "Com divergência" : "Finalizável sem divergência"}
          </div>
        </div>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            disabled={saving || isLocked}
            onClick={handleFinalize}
            className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? "Finalizando..." : "Finalizar recebimento"}
          </button>

          <button
            type="button"
            onClick={() => router.push("/compras/recebimentos")}
            className="rounded-xl border px-4 py-2 text-sm font-medium"
          >
            Voltar
          </button>
        </div>
      </div>
    </div>
  );
}