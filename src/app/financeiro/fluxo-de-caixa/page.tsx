"use client";

import { useEffect, useMemo, useState } from "react";
import { listBankAccounts } from "@/lib/financeiro/bank-accounts";
import { listAccountsPayable } from "@/lib/financeiro/accounts-payable";
import { listAccountsReceivable } from "@/lib/financeiro/accounts-receivable";

type CashFlowItem = {
  id: string;
  tipo: "entrada" | "saida";
  origem: string;
  descricao: string;
  vencimento: string;
  valor: number;
  status: string;
  bankAccountId?: string;
  bankAccountName?: string;
};

export default function FluxoDeCaixaPage() {
  const [items, setItems] = useState<CashFlowItem[]>([]);
  const [bankAccounts, setBankAccounts] = useState<
    { id: string; nome: string }[]
  >([]);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [payables, receivables, accounts] = await Promise.all([
        listAccountsPayable(),
        listAccountsReceivable(),
        listBankAccounts(),
      ]);

      const saidas: CashFlowItem[] = payables.map((item) => ({
        id: item.id,
        tipo: "saida",
        origem: item.origem,
        descricao: item.descricao,
        vencimento: item.vencimento,
        valor: Number(item.valor),
        status: item.statusPagamento,
        bankAccountId: item.bankAccountId ?? "",
        bankAccountName: item.bankAccountName ?? "",
      }));

      const entradas: CashFlowItem[] = receivables.map((item) => ({
        id: item.id,
        tipo: "entrada",
        origem: item.origem,
        descricao: item.descricao,
        vencimento: item.vencimento,
        valor: Number(item.valor),
        status: item.statusRecebimento,
        bankAccountId: item.bankAccountId ?? "",
        bankAccountName: item.bankAccountName ?? "",
      }));

      const merged = [...entradas, ...saidas].sort((a, b) =>
        (b.vencimento || "").localeCompare(a.vencimento || "")
      );

      setItems(merged);
      setBankAccounts(
        accounts
          .filter((item) => item.ativo)
          .map((item) => ({
            id: item.id,
            nome: `${item.banco} - ${item.nomeConta}`,
          }))
      );
    } catch (err) {
      console.error(err);
      setError("Não foi possível carregar o fluxo de caixa.");
    } finally {
      setLoading(false);
    }
  }

  const filteredItems = useMemo(() => {
    if (!selectedBankAccountId) return items;
    return items.filter((item) => item.bankAccountId === selectedBankAccountId);
  }, [items, selectedBankAccountId]);

  const saldoPrevisto = useMemo(() => {
    return filteredItems.reduce((acc, item) => {
      if (item.status === "cancelado") return acc;
      return item.tipo === "entrada" ? acc + item.valor : acc - item.valor;
    }, 0);
  }, [filteredItems]);

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Fluxo de caixa</h1>
          <p className="text-sm text-gray-500">
            Visão consolidada de entradas e saídas financeiras.
          </p>
        </div>

        <div className="rounded-2xl border bg-white px-4 py-3 text-right shadow-sm">
          <div className="text-xs text-gray-500">Saldo previsto</div>
          <div className="text-lg font-bold">
            {saldoPrevisto.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div>
          <label className="mb-1 block text-sm font-medium">Conta bancária</label>
          <select
            value={selectedBankAccountId}
            onChange={(e) => setSelectedBankAccountId(e.target.value)}
            className="w-full rounded-xl border px-3 py-2 outline-none md:max-w-md"
          >
            <option value="">Todas</option>
            {bankAccounts.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        {loading ? (
          <p className="text-sm text-gray-500">Carregando fluxo...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : filteredItems.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum lançamento encontrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left">
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium">Descrição</th>
                  <th className="px-4 py-3 font-medium">Origem</th>
                  <th className="px-4 py-3 font-medium">Conta bancária</th>
                  <th className="px-4 py-3 font-medium">Vencimento</th>
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={`${item.tipo}-${item.id}`} className="border-b">
                    <td className="px-4 py-3 font-medium">
                      {item.tipo === "entrada" ? "Entrada" : "Saída"}
                    </td>
                    <td className="px-4 py-3">{item.descricao}</td>
                    <td className="px-4 py-3">{item.origem}</td>
                    <td className="px-4 py-3">{item.bankAccountName || "-"}</td>
                    <td className="px-4 py-3">
                      {item.vencimento
                        ? new Date(item.vencimento).toLocaleDateString("pt-BR")
                        : "-"}
                    </td>
                    <td className="px-4 py-3">
                      {item.valor.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </td>
                    <td className="px-4 py-3">{item.status}</td>
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