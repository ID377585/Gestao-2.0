"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  createAccountReceivable,
  listAccountsReceivable,
} from "@/lib/financeiro/accounts-receivable";
import type { AccountReceivable, ReceivableStatus } from "@/types/compras";

function statusLabel(status: ReceivableStatus) {
  switch (status) {
    case "pendente":
      return "Pendente";
    case "recebido":
      return "Recebido";
    case "vencido":
      return "Vencido";
    case "cancelado":
      return "Cancelado";
    default:
      return status;
  }
}

function statusClass(status: ReceivableStatus) {
  switch (status) {
    case "pendente":
      return "bg-yellow-100 text-yellow-800";
    case "recebido":
      return "bg-green-100 text-green-800";
    case "vencido":
      return "bg-red-100 text-red-800";
    case "cancelado":
      return "bg-gray-200 text-gray-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

export default function ContasAReceberPage() {
  const [items, setItems] = useState<AccountReceivable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [statusFilter, setStatusFilter] = useState<
    "todos" | "pendente" | "recebido" | "vencido" | "cancelado"
  >("todos");

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [categoria, setCategoria] = useState("");
  const [observacoes, setObservacoes] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      setError("");
      const data = await listAccountsReceivable();
      setItems(data);
    } catch (err) {
      console.error(err);
      setError("Não foi possível carregar as contas a receber.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!customerName || !descricao || !valor || !vencimento) {
      alert("Preencha cliente, descrição, valor e vencimento.");
      return;
    }

    try {
      setSaving(true);
      await createAccountReceivable({
        customerName,
        descricao,
        valor: Number(valor),
        vencimento,
        categoria,
        observacoes,
      });

      setCustomerName("");
      setDescricao("");
      setValor("");
      setVencimento("");
      setCategoria("");
      setObservacoes("");
      setShowForm(false);

      await loadData();
      alert("Conta a receber criada com sucesso.");
    } catch (err) {
      console.error(err);
      setError("Não foi possível criar a conta a receber.");
    } finally {
      setSaving(false);
    }
  }

  const filteredItems = useMemo(() => {
    if (statusFilter === "todos") return items;
    return items.filter((item) => item.statusRecebimento === statusFilter);
  }, [items, statusFilter]);

  const totalAberto = useMemo(() => {
    return filteredItems
      .filter(
        (item) =>
          item.statusRecebimento !== "recebido" &&
          item.statusRecebimento !== "cancelado"
      )
      .reduce((acc, item) => acc + Number(item.valor), 0);
  }, [filteredItems]);

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contas a receber</h1>
          <p className="text-sm text-gray-500">
            Títulos financeiros de entrada da empresa.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setShowForm((prev) => !prev)}
            className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
          >
            {showForm ? "Fechar cadastro" : "Nova conta a receber"}
          </button>

          <div className="rounded-2xl border bg-white px-4 py-3 text-right shadow-sm">
            <div className="text-xs text-gray-500">Total em aberto</div>
            <div className="text-lg font-bold">
              {totalAberto.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </div>
          </div>
        </div>
      </div>

      {showForm ? (
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Cliente</label>
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Descrição</label>
              <input
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Valor</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Vencimento</label>
              <input
                type="date"
                value={vencimento}
                onChange={(e) => setVencimento(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Categoria</label>
              <input
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Observações</label>
              <input
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 outline-none"
              />
            </div>
          </div>

          <div className="mt-4">
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving}
              className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar conta a receber"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <div>
            <label className="mb-1 block text-sm font-medium">Status</label>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value as
                    | "todos"
                    | "pendente"
                    | "recebido"
                    | "vencido"
                    | "cancelado"
                )
              }
              className="rounded-xl border px-3 py-2 outline-none"
            >
              <option value="todos">Todos</option>
              <option value="pendente">Pendentes</option>
              <option value="recebido">Recebidos</option>
              <option value="vencido">Vencidos</option>
              <option value="cancelado">Cancelados</option>
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        {loading ? (
          <p className="text-sm text-gray-500">Carregando contas...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : filteredItems.length === 0 ? (
          <p className="text-sm text-gray-500">
            Nenhuma conta encontrada para o filtro selecionado.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left">
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Descrição</th>
                  <th className="px-4 py-3 font-medium">Vencimento</th>
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="px-4 py-3 font-medium">{item.customerName}</td>
                    <td className="px-4 py-3">{item.descricao}</td>
                    <td className="px-4 py-3">
                      {item.vencimento
                        ? new Date(item.vencimento).toLocaleDateString("pt-BR")
                        : "-"}
                    </td>
                    <td className="px-4 py-3">
                      {Number(item.valor).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${statusClass(
                          item.statusRecebimento
                        )}`}
                      >
                        {statusLabel(item.statusRecebimento)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/financeiro/contas-a-receber/${item.id}`}
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