"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getAccountPayableById,
  markAccountPayableAsPaid,
  markAccountPayableAsPending,
} from "@/lib/financeiro/accounts-payable";
import type { AccountPayable } from "@/types/compras";

function statusClass(status: AccountPayable["statusPagamento"]) {
  switch (status) {
    case "pendente":
      return "bg-yellow-100 text-yellow-800";
    case "pago":
      return "bg-green-100 text-green-800";
    case "vencido":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function statusLabel(status: AccountPayable["statusPagamento"]) {
  switch (status) {
    case "pendente":
      return "Pendente";
    case "pago":
      return "Pago";
    case "vencido":
      return "Vencido";
    default:
      return status;
  }
}

export default function ContaAPagarDetalhePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const payableId = params.id;

  const [item, setItem] = useState<AccountPayable | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [dataPagamento, setDataPagamento] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [observacoes, setObservacoes] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const data = await getAccountPayableById(payableId);

      if (!data) {
        setError("Conta a pagar não encontrada.");
        setLoading(false);
        return;
      }

      setItem(data);
      setObservacoes(data.observacoes ?? "");
      setDataPagamento(
        data.dataPagamento || new Date().toISOString().slice(0, 10)
      );
    } catch (err) {
      console.error(err);
      setError("Não foi possível carregar a conta.");
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkAsPaid() {
    if (!item) return;

    try {
      setSaving(true);
      setError("");

      await markAccountPayableAsPaid({
        id: item.id,
        dataPagamento,
        observacoes,
      });

      await loadData();
      alert("Conta marcada como paga.");
    } catch (err) {
      console.error(err);
      setError("Não foi possível marcar a conta como paga.");
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkAsPending() {
    if (!item) return;

    try {
      setSaving(true);
      setError("");

      await markAccountPayableAsPending({
        id: item.id,
        observacoes,
      });

      await loadData();
      alert("Conta retornou para pendente.");
    } catch (err) {
      console.error(err);
      setError("Não foi possível atualizar a conta.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (payableId) {
      loadData();
    }
  }, [payableId]);

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500">Carregando conta...</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="space-y-4 p-6">
        <p className="text-sm text-red-600">
          {error || "Conta a pagar não encontrada."}
        </p>
        <button
          onClick={() => router.push("/financeiro/contas-a-pagar")}
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
          <h1 className="text-2xl font-bold">Conta a pagar</h1>
          <p className="text-sm text-gray-500">{item.descricao}</p>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-sm font-medium ${statusClass(
            item.statusPagamento
          )}`}
        >
          {statusLabel(item.statusPagamento)}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Dados do título</h2>

          <div className="space-y-3 text-sm">
            <div>
              <span className="font-medium">Fornecedor:</span>{" "}
              {item.supplierName}
            </div>
            <div>
              <span className="font-medium">Origem:</span> {item.origem}
            </div>
            <div>
              <span className="font-medium">Origem ID:</span> {item.origemId}
            </div>
            <div>
              <span className="font-medium">Valor:</span>{" "}
              {Number(item.valor).toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </div>
            <div>
              <span className="font-medium">Vencimento:</span>{" "}
              {item.vencimento
                ? new Date(item.vencimento).toLocaleDateString("pt-BR")
                : "-"}
            </div>
            <div>
              <span className="font-medium">Data pagamento:</span>{" "}
              {item.dataPagamento
                ? new Date(item.dataPagamento).toLocaleDateString("pt-BR")
                : "-"}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Ações financeiras</h2>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Data de pagamento
              </label>
              <input
                type="date"
                value={dataPagamento}
                onChange={(e) => setDataPagamento(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Observações
              </label>
              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                className="min-h-[120px] w-full rounded-xl border px-3 py-2 outline-none"
                placeholder="Observações financeiras"
              />
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={handleMarkAsPaid}
                className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {saving ? "Salvando..." : "Marcar como pago"}
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={handleMarkAsPending}
                className="rounded-xl border px-4 py-2 text-sm font-medium"
              >
                Voltar para pendente
              </button>

              <button
                type="button"
                onClick={() => router.push("/financeiro/contas-a-pagar")}
                className="rounded-xl border px-4 py-2 text-sm font-medium"
              >
                Voltar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}