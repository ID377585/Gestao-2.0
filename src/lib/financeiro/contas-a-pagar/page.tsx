"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { listAccountsPayable } from "@/lib/financeiro/accounts-payable";
import type { AccountPayable, PayableStatus } from "@/types/compras";

function statusLabel(status: PayableStatus) {
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

function statusClass(status: PayableStatus) {
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

export default function ContasAPagarPage() {
  const [items, setItems] = useState<AccountPayable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [statusFilter, setStatusFilter] = useState<
    "todos" | "pendente" | "pago" | "vencido"
  >("todos");

  async function loadData() {
    try {
      setLoading(true);
      setError("");
      const data = await listAccountsPayable();
      setItems(data);
    } catch (err) {
      console.error(err);
      setError("Não foi possível carregar as contas a pagar.");
    } finally {
      setLoading(false);
    }
  }

  const filteredItems = useMemo(() => {
    if (statusFilter === "todos") return items;
    return items.filter((item) => item.statusPagamento === statusFilter);
  }, [items, statusFilter]);

  const totalPendente = useMemo(() => {
    return filteredItems
      .filter((item) => item.statusPagamento !== "pago")
      .reduce((acc, item) => acc + Number(item.valor), 0);
  }, [filteredItems]);

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contas a pagar</h1>
          <p className="text-sm text-gray-500">
            Títulos financeiros gerados pelos recebimentos de compras.
          </p>
        </div>

        <div className="rounded-2xl border bg-white px-4 py-3 text-right shadow-sm">
          <div className="text-xs text-gray-500">Total em aberto</div>
          <div className="text-lg font-bold">
            {totalPendente.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <div>
            <label className="mb-1 block text-sm font-medium">Status</label>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value as "todos" | "pendente" | "pago" | "vencido"
                )
              }
              className="rounded-xl border px-3 py-2 outline-none"
            >
              <option value="todos">Todos</option>
              <option value="pendente">Pendentes</option>
              <option value="pago">Pagos</option>
              <option value="vencido">Vencidos</option>
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
                  <th className="px-4 py-3 font-medium">Fornecedor</th>
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
                    <td className="px-4 py-3 font-medium">
                      {item.supplierName}
                    </td>
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
                          item.statusPagamento
                        )}`}
                      >
                        {statusLabel(item.statusPagamento)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/financeiro/contas-a-pagar/${item.id}`}
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