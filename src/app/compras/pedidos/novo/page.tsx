"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { listSuppliers } from "@/lib/compras/suppliers";
import {
  createOrderFromRequest,
  createPurchaseOrder,
} from "@/lib/compras/orders";
import {
  listPurchaseRequests,
  listPurchaseRequestItems,
} from "@/lib/compras/requests";
import type {
  CreatePurchaseOrderItemInput,
  PurchaseRequest,
  PurchaseRequestItem,
  Supplier,
} from "@/types/compras";

type FormItem = CreatePurchaseOrderItemInput & {
  localId: string;
};

function createEmptyItem(): FormItem {
  return {
    localId: crypto.randomUUID(),
    productId: "",
    produtoNome: "",
    unidade: "",
    quantidade: 1,
    valorUnitario: 0,
    desconto: 0,
    observacao: "",
  };
}

export default function NovoPedidoPage() {
  const router = useRouter();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [requestItems, setRequestItems] = useState<PurchaseRequestItem[]>([]);
  const [loadingRequestItems, setLoadingRequestItems] = useState(false);

  const [form, setForm] = useState({
    supplierId: "",
    requestId: "",
    previsaoEntrega: "",
    vencimento: "",
    observacoes: "",
    createdBy: "admin",
    createdByName: "Administrador",
  });

  const [items, setItems] = useState<FormItem[]>([createEmptyItem()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedSupplier = useMemo(
    () => suppliers.find((item) => item.id === form.supplierId),
    [suppliers, form.supplierId]
  );

  const selectedRequest = useMemo(
    () => requests.find((item) => item.id === form.requestId),
    [requests, form.requestId]
  );

  async function loadInitialData() {
    try {
      const [suppliersData, requestsData] = await Promise.all([
        listSuppliers(),
        listPurchaseRequests(),
      ]);

      setSuppliers(suppliersData.filter((item) => item.ativo));
      setRequests(
        requestsData.filter(
          (item) => item.status !== "convertida" && item.status !== "rejeitada"
        )
      );
    } catch (err) {
      console.error(err);
      setError("Não foi possível carregar os dados iniciais.");
    }
  }

  async function loadRequestItems(requestId: string) {
    try {
      setLoadingRequestItems(true);
      const data = await listPurchaseRequestItems(requestId);
      setRequestItems(data);

      setItems(
        data.map((item) => ({
          localId: crypto.randomUUID(),
          productId: item.productId ?? "",
          produtoNome: item.produtoNome,
          unidade: item.unidade,
          quantidade: item.quantidade,
          valorUnitario: 0,
          desconto: 0,
          observacao: item.observacao ?? "",
        }))
      );
    } catch (err) {
      console.error(err);
      setError("Não foi possível carregar os itens da solicitação.");
    } finally {
      setLoadingRequestItems(false);
    }
  }

  function updateField(field: string, value: string) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function addItem() {
    setItems((prev) => [...prev, createEmptyItem()]);
  }

  function removeItem(localId: string) {
    setItems((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((item) => item.localId !== localId);
    });
  }

  function updateItem(
    localId: string,
    field: keyof FormItem,
    value: string | number
  ) {
    setItems((prev) =>
      prev.map((item) =>
        item.localId === localId
          ? {
              ...item,
              [field]: value,
            }
          : item
      )
    );
  }

  async function handleRequestChange(requestId: string) {
    updateField("requestId", requestId);
    setError("");

    if (!requestId) {
      setRequestItems([]);
      setItems([createEmptyItem()]);
      return;
    }

    await loadRequestItems(requestId);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!form.supplierId) {
      setError("Selecione o fornecedor.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      if (form.requestId) {
        const itemPrices = items.map((item) => ({
          productId: item.productId,
          produtoNome: item.produtoNome,
          unidade: item.unidade,
          valorUnitario: Number(item.valorUnitario),
          desconto: Number(item.desconto ?? 0),
          observacao: item.observacao ?? "",
        }));

        if (itemPrices.some((item) => item.valorUnitario <= 0)) {
          setError("Informe o valor unitário de todos os itens da solicitação.");
          setSaving(false);
          return;
        }

        await createOrderFromRequest({
          requestId: form.requestId,
          supplierId: form.supplierId,
          supplierName: selectedSupplier?.razaoSocial ?? "",
          previsaoEntrega: form.previsaoEntrega,
          vencimento: form.vencimento,
          observacoes: form.observacoes,
          createdBy: form.createdBy,
          createdByName: form.createdByName,
          itemPrices,
        });
      } else {
        const sanitizedItems = items.map((item) => ({
          productId: item.productId?.trim() ?? "",
          produtoNome: item.produtoNome.trim(),
          unidade: item.unidade.trim(),
          quantidade: Number(item.quantidade),
          valorUnitario: Number(item.valorUnitario),
          desconto: Number(item.desconto ?? 0),
          observacao: item.observacao?.trim() ?? "",
        }));

        if (sanitizedItems.some((item) => !item.produtoNome)) {
          setError("Todos os itens precisam ter nome.");
          setSaving(false);
          return;
        }

        if (sanitizedItems.some((item) => !item.unidade)) {
          setError("Todos os itens precisam ter unidade.");
          setSaving(false);
          return;
        }

        if (sanitizedItems.some((item) => item.quantidade <= 0)) {
          setError("Todos os itens precisam ter quantidade maior que zero.");
          setSaving(false);
          return;
        }

        if (sanitizedItems.some((item) => item.valorUnitario <= 0)) {
          setError("Todos os itens precisam ter valor unitário maior que zero.");
          setSaving(false);
          return;
        }

        await createPurchaseOrder({
          supplierId: form.supplierId,
          supplierName: selectedSupplier?.razaoSocial ?? "",
          previsaoEntrega: form.previsaoEntrega,
          vencimento: form.vencimento,
          observacoes: form.observacoes,
          createdBy: form.createdBy,
          createdByName: form.createdByName,
          items: sanitizedItems,
        });
      }

      router.push("/compras/pedidos");
    } catch (err) {
      console.error(err);
      setError("Não foi possível salvar o pedido.");
      setSaving(false);
      return;
    }

    setSaving(false);
  }

  useEffect(() => {
    loadInitialData();
  }, []);

  return (
    <div className="max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Novo pedido de compra</h1>
        <p className="text-sm text-gray-500">
          Crie um pedido manual ou converta uma solicitação em pedido.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-2xl border bg-white p-6 shadow-sm"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Fornecedor *</label>
            <select
              value={form.supplierId}
              onChange={(e) => updateField("supplierId", e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none"
            >
              <option value="">Selecione</option>
              {suppliers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.razaoSocial}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Solicitação vinculada
            </label>
            <select
              value={form.requestId}
              onChange={(e) => handleRequestChange(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none"
            >
              <option value="">Sem solicitação</option>
              {requests.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.numero} - {item.setorSolicitante} - {item.solicitanteNome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Previsão de entrega
            </label>
            <input
              type="date"
              value={form.previsaoEntrega}
              onChange={(e) => updateField("previsaoEntrega", e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Vencimento</label>
            <input
              type="date"
              value={form.vencimento}
              onChange={(e) => updateField("vencimento", e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">Observações</label>
            <textarea
              value={form.observacoes}
              onChange={(e) => updateField("observacoes", e.target.value)}
              className="min-h-[100px] w-full rounded-xl border px-3 py-2 outline-none"
              placeholder="Informações adicionais do pedido"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Itens do pedido</h2>
              <p className="text-sm text-gray-500">
                {form.requestId
                  ? "Os itens vieram da solicitação. Agora informe os preços."
                  : "Adicione manualmente os itens do pedido."}
              </p>
            </div>

            {!form.requestId ? (
              <button
                type="button"
                onClick={addItem}
                className="rounded-xl border px-4 py-2 text-sm font-medium"
              >
                Adicionar item
              </button>
            ) : null}
          </div>

          {loadingRequestItems ? (
            <p className="text-sm text-gray-500">
              Carregando itens da solicitação...
            </p>
          ) : null}

          <div className="space-y-4">
            {items.map((item, index) => (
              <div
                key={item.localId}
                className="grid grid-cols-1 gap-4 rounded-2xl border p-4 md:grid-cols-12"
              >
                <div className="md:col-span-3">
                  <label className="mb-1 block text-sm font-medium">Produto *</label>
                  <input
                    value={item.produtoNome}
                    disabled={!!form.requestId}
                    onChange={(e) =>
                      updateItem(item.localId, "produtoNome", e.target.value)
                    }
                    className="w-full rounded-xl border px-3 py-2 outline-none disabled:bg-gray-50"
                    placeholder={`Item ${index + 1}`}
                  />
                </div>

                <div className="md:col-span-1">
                  <label className="mb-1 block text-sm font-medium">Unidade *</label>
                  <input
                    value={item.unidade}
                    disabled={!!form.requestId}
                    onChange={(e) =>
                      updateItem(item.localId, "unidade", e.target.value)
                    }
                    className="w-full rounded-xl border px-3 py-2 outline-none disabled:bg-gray-50"
                    placeholder="un"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium">Quantidade *</label>
                  <input
                    type="number"
                    min={1}
                    step="0.01"
                    value={item.quantidade}
                    disabled={!!form.requestId}
                    onChange={(e) =>
                      updateItem(
                        item.localId,
                        "quantidade",
                        Number(e.target.value)
                      )
                    }
                    className="w-full rounded-xl border px-3 py-2 outline-none disabled:bg-gray-50"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium">
                    Valor unitário *
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.valorUnitario}
                    onChange={(e) =>
                      updateItem(
                        item.localId,
                        "valorUnitario",
                        Number(e.target.value)
                      )
                    }
                    className="w-full rounded-xl border px-3 py-2 outline-none"
                  />
                </div>

                <div className="md:col-span-1">
                  <label className="mb-1 block text-sm font-medium">Desconto</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.desconto ?? 0}
                    onChange={(e) =>
                      updateItem(
                        item.localId,
                        "desconto",
                        Number(e.target.value)
                      )
                    }
                    className="w-full rounded-xl border px-3 py-2 outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium">Observação</label>
                  <input
                    value={item.observacao ?? ""}
                    onChange={(e) =>
                      updateItem(item.localId, "observacao", e.target.value)
                    }
                    className="w-full rounded-xl border px-3 py-2 outline-none"
                    placeholder="Marca, detalhe..."
                  />
                </div>

                <div className="md:col-span-1 flex items-end">
                  {!form.requestId ? (
                    <button
                      type="button"
                      onClick={() => removeItem(item.localId)}
                      className="w-full rounded-xl border px-3 py-2 text-sm font-medium text-red-600"
                    >
                      Remover
                    </button>
                  ) : (
                    <div className="w-full rounded-xl bg-gray-50 px-3 py-2 text-center text-xs text-gray-500">
                      Vinculado
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl bg-gray-50 p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">Total estimado</span>
              <span className="font-bold">
                {items
                  .reduce((acc, item) => {
                    const subtotal =
                      Number(item.quantidade) * Number(item.valorUnitario);
                    const desconto = Number(item.desconto ?? 0);
                    return acc + (subtotal - desconto);
                  }, 0)
                  .toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
              </span>
            </div>
          </div>
        </div>

        {selectedRequest ? (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
            Esta criação está vinculada à solicitação{" "}
            <strong>{selectedRequest.numero}</strong>. Após gerar o pedido, a
            solicitação será marcada como <strong>convertida</strong>.
          </div>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar pedido"}
          </button>

          <button
            type="button"
            onClick={() => router.push("/compras/pedidos")}
            className="rounded-xl border px-4 py-2 text-sm font-medium"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}