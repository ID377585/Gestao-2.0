"use client";

import { usePurchaseHistory } from "@/hooks/use-purchase-history";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createPurchaseRequest } from "@/lib/compras/requests";
import { buildCreatedByLabel, getCurrentUserInfo } from "@/lib/auth/current-user";
import type { CreatePurchaseRequestItemInput, PriorityLevel } from "@/types/compras";

type FormItem = CreatePurchaseRequestItemInput & {
  localId: string;
};

const { createPurchaseHistoryEntryWithUser } = usePurchaseHistory();

function createEmptyItem(): FormItem {
  return {
    localId: crypto.randomUUID(),
    productId: "",
    produtoNome: "",
    unidade: "",
    quantidade: 1,
    observacao: "",
  };
}

export default function NovaSolicitacaoPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    setorSolicitante: "",
    solicitanteId: "",
    solicitanteNome: "",
    prioridade: "media" as PriorityLevel,
    observacoes: "",
  });

  const [items, setItems] = useState<FormItem[]>([createEmptyItem()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadUser() {
      const currentUser = await getCurrentUserInfo();

      setForm((prev) => ({
        ...prev,
        solicitanteId: currentUser?.id ?? "",
        solicitanteNome:
          buildCreatedByLabel(currentUser) || prev.solicitanteNome,
      }));
    }

    loadUser();
  }, []);

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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!form.setorSolicitante.trim()) {
      setError("Informe o setor solicitante.");
      return;
    }

    if (!form.solicitanteNome.trim()) {
      setError("Informe o nome do solicitante.");
      return;
    }

    const sanitizedItems = items.map((item) => ({
      productId: item.productId?.trim() ?? "",
      produtoNome: item.produtoNome.trim(),
      unidade: item.unidade.trim(),
      quantidade: Number(item.quantidade),
      observacao: item.observacao?.trim() ?? "",
    }));

    if (sanitizedItems.some((item) => !item.produtoNome)) {
      setError("Todos os itens precisam ter nome do produto.");
      return;
    }

    if (sanitizedItems.some((item) => !item.unidade)) {
      setError("Todos os itens precisam ter unidade.");
      return;
    }

    if (sanitizedItems.some((item) => item.quantidade <= 0)) {
      setError("A quantidade de todos os itens deve ser maior que zero.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const requestId = await createPurchaseRequest({
  setorSolicitante: form.setorSolicitante,
  solicitanteId: form.solicitanteId || "unknown",
  solicitanteNome: form.solicitanteNome,
  prioridade: form.prioridade,
  observacoes: form.observacoes,
  items: sanitizedItems,
});

await createPurchaseHistoryEntryWithUser({
  entityType: "solicitacao",
  entityId: requestId,
  action: "solicitacao_criada",
  title: "Solicitação de compra criada",
  description: `${form.setorSolicitante} • ${form.solicitanteNome}`,
});

router.push("/compras/solicitacoes");
    } catch (err) {
      console.error(err);
      setError("Não foi possível salvar a solicitação.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Nova solicitação de compra</h1>
        <p className="text-sm text-gray-500">
          Registre a necessidade interna antes da geração do pedido.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-2xl border bg-white p-6 shadow-sm"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Setor solicitante *
            </label>
            <input
              value={form.setorSolicitante}
              onChange={(e) => updateField("setorSolicitante", e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none"
              placeholder="Ex.: Produção"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Solicitante *
            </label>
            <input
              value={form.solicitanteNome}
              onChange={(e) => updateField("solicitanteNome", e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none"
              placeholder="Nome do responsável"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Prioridade</label>
            <select
              value={form.prioridade}
              onChange={(e) => updateField("prioridade", e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none"
            >
              <option value="baixa">Baixa</option>
              <option value="media">Média</option>
              <option value="alta">Alta</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">
              Observações
            </label>
            <textarea
              value={form.observacoes}
              onChange={(e) => updateField("observacoes", e.target.value)}
              className="min-h-[100px] w-full rounded-xl border px-3 py-2 outline-none"
              placeholder="Informações adicionais da solicitação"
            />
          </div>
        </div>

        <div className="rounded-xl border bg-gray-50 p-4 text-sm text-gray-600">
          O solicitante já vem preenchido com o usuário logado, mas continua editável.
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Itens da solicitação</h2>
              <p className="text-sm text-gray-500">
                Informe os produtos ou insumos que precisam ser comprados.
              </p>
            </div>

            <button
              type="button"
              onClick={addItem}
              className="rounded-xl border px-4 py-2 text-sm font-medium"
            >
              Adicionar item
            </button>
          </div>

          <div className="space-y-4">
            {items.map((item, index) => (
              <div
                key={item.localId}
                className="grid grid-cols-1 gap-4 rounded-2xl border p-4 md:grid-cols-12"
              >
                <div className="md:col-span-4">
                  <label className="mb-1 block text-sm font-medium">
                    Produto *
                  </label>
                  <input
                    value={item.produtoNome}
                    onChange={(e) =>
                      updateItem(item.localId, "produtoNome", e.target.value)
                    }
                    className="w-full rounded-xl border px-3 py-2 outline-none"
                    placeholder={`Item ${index + 1}`}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium">
                    Unidade *
                  </label>
                  <input
                    value={item.unidade}
                    onChange={(e) =>
                      updateItem(item.localId, "unidade", e.target.value)
                    }
                    className="w-full rounded-xl border px-3 py-2 outline-none"
                    placeholder="kg, un, cx"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium">
                    Quantidade *
                  </label>
                  <input
                    type="number"
                    min={1}
                    step="0.01"
                    value={item.quantidade}
                    onChange={(e) =>
                      updateItem(
                        item.localId,
                        "quantidade",
                        Number(e.target.value)
                      )
                    }
                    className="w-full rounded-xl border px-3 py-2 outline-none"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="mb-1 block text-sm font-medium">
                    Observação
                  </label>
                  <input
                    value={item.observacao}
                    onChange={(e) =>
                      updateItem(item.localId, "observacao", e.target.value)
                    }
                    className="w-full rounded-xl border px-3 py-2 outline-none"
                    placeholder="Marca, especificação..."
                  />
                </div>

                <div className="md:col-span-1 flex items-end">
                  <button
                    type="button"
                    onClick={() => removeItem(item.localId)}
                    className="w-full rounded-xl border px-3 py-2 text-sm font-medium text-red-600"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar solicitação"}
          </button>

          <button
            type="button"
            onClick={() => router.push("/compras/solicitacoes")}
            className="rounded-xl border px-4 py-2 text-sm font-medium"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}