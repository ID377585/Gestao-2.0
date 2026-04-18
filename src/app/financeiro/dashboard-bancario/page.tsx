"use client";

import { useEffect, useMemo, useState } from "react";
import { listBankAccounts } from "@/lib/financeiro/bank-accounts";
import { listBankReconciliationEntries } from "@/lib/financeiro/bank-reconciliation";
import type { BankAccount, BankReconciliationEntry } from "@/types/compras";

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("pt-BR");
}

export default function DashboardBancarioPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [entries, setEntries] = useState<BankReconciliationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [accountsData, entriesData] = await Promise.all([
        listBankAccounts(),
        listBankReconciliationEntries(),
      ]);

      setAccounts(accountsData.filter((item) => item.ativo));
      setEntries(entriesData);
    } catch (err) {
      console.error(err);
      setError("Não foi possível carregar o dashboard bancário.");
    } finally {
      setLoading(false);
    }
  }

  function inRange(date?: string) {
    if (!date) return false;
    if (dateFrom && date < dateFrom) return false;
    if (dateTo && date > dateTo) return false;
    return true;
  }

  const filteredEntries = useMemo(() => {
    return entries.filter((item) => {
      const accountOk = !bankAccountId || item.bankAccountId === bankAccountId;
      const dateOk = inRange(item.data);
      return accountOk && dateOk;
    });
  }, [entries, bankAccountId, dateFrom, dateTo]);

  const resumo = useMemo(() => {
    const entradas = filteredEntries
      .filter((item) => item.tipo === "entrada")
      .reduce((acc, item) => acc + Number(item.valor), 0);

    const saidas = filteredEntries
      .filter((item) => item.tipo === "saida")
      .reduce((acc, item) => acc + Number(item.valor), 0);

    const conciliado = filteredEntries
      .filter((item) => item.conciliado)
      .reduce((acc, item) => acc + Number(item.valor), 0);

    const pendente = filteredEntries
      .filter((item) => !item.conciliado)
      .reduce((acc, item) => acc + Number(item.valor), 0);

    return {
      entradas,
      saidas,
      conciliado,
      pendente,
      saldoMovimentado: entradas - saidas,
    };
  }, [filteredEntries]);

  const resumoPorConta = useMemo(() => {
    return accounts.map((account) => {
      const accountEntries = filteredEntries.filter(
        (entry) => entry.bankAccountId === account.id
      );

      const entradas = accountEntries
        .filter((item) => item.tipo === "entrada")
        .reduce((acc, item) => acc + Number(item.valor), 0);

      const saidas = accountEntries
        .filter((item) => item.tipo === "saida")
        .reduce((acc, item) => acc + Number(item.valor), 0);

      const conciliado = accountEntries
        .filter((item) => item.conciliado)
        .reduce((acc, item) => acc + Number(item.valor), 0);

      const pendente = accountEntries
        .filter((item) => !item.conciliado)
        .reduce((acc, item) => acc + Number(item.valor), 0);

      return {
        id: account.id,
        banco: account.banco,
        nomeConta: account.nomeConta,
        saldoInicial: Number(account.saldoInicial ?? 0),
        entradas,
        saidas,
        saldoAtualEstimado:
          Number(account.saldoInicial ?? 0) + entradas - saidas,
        conciliado,
        pendente,
      };
    });
  }, [accounts, filteredEntries]);

  const ultimosLancamentos = useMemo(() => {
    return [...filteredEntries]
      .sort((a, b) => (b.data || "").localeCompare(a.data || ""))
      .slice(0, 10);
  }, [filteredEntries]);

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard Bancário</h1>
        <p className="text-sm text-gray-500">
          Visão consolidada de contas bancárias, lançamentos e conciliação.
        </p>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Conta bancária
            </label>
            <select
              value={bankAccountId}
              onChange={(e) => setBankAccountId(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none"
            >
              <option value="">Todas</option>
              {accounts.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.banco} - {item.nomeConta}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Data inicial
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Data final</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">
            Carregando dashboard bancário...
          </p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">Entradas</div>
              <div className="mt-2 text-xl font-bold">
                {formatCurrency(resumo.entradas)}
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">Saídas</div>
              <div className="mt-2 text-xl font-bold">
                {formatCurrency(resumo.saidas)}
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">Saldo movimentado</div>
              <div className="mt-2 text-xl font-bold">
                {formatCurrency(resumo.saldoMovimentado)}
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">Conciliado</div>
              <div className="mt-2 text-xl font-bold">
                {formatCurrency(resumo.conciliado)}
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">Pendente</div>
              <div className="mt-2 text-xl font-bold">
                {formatCurrency(resumo.pendente)}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Resumo por conta</h2>

            {resumoPorConta.length === 0 ? (
              <p className="text-sm text-gray-500">
                Nenhuma conta bancária cadastrada.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {resumoPorConta.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border p-4 shadow-sm"
                  >
                    <div className="mb-3">
                      <div className="font-semibold">
                        {item.banco} - {item.nomeConta}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-xl border p-3">
                        <div className="text-gray-500">Saldo inicial</div>
                        <div className="mt-1 font-semibold">
                          {formatCurrency(item.saldoInicial)}
                        </div>
                      </div>

                      <div className="rounded-xl border p-3">
                        <div className="text-gray-500">Saldo estimado</div>
                        <div className="mt-1 font-semibold">
                          {formatCurrency(item.saldoAtualEstimado)}
                        </div>
                      </div>

                      <div className="rounded-xl border p-3">
                        <div className="text-gray-500">Entradas</div>
                        <div className="mt-1 font-semibold">
                          {formatCurrency(item.entradas)}
                        </div>
                      </div>

                      <div className="rounded-xl border p-3">
                        <div className="text-gray-500">Saídas</div>
                        <div className="mt-1 font-semibold">
                          {formatCurrency(item.saidas)}
                        </div>
                      </div>

                      <div className="rounded-xl border p-3">
                        <div className="text-gray-500">Conciliado</div>
                        <div className="mt-1 font-semibold">
                          {formatCurrency(item.conciliado)}
                        </div>
                      </div>

                      <div className="rounded-xl border p-3">
                        <div className="text-gray-500">Pendente</div>
                        <div className="mt-1 font-semibold">
                          {formatCurrency(item.pendente)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Últimos lançamentos</h2>

            {ultimosLancamentos.length === 0 ? (
              <p className="text-sm text-gray-500">
                Nenhum lançamento encontrado.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-left">
                      <th className="px-4 py-3 font-medium">Data</th>
                      <th className="px-4 py-3 font-medium">Conta</th>
                      <th className="px-4 py-3 font-medium">Descrição</th>
                      <th className="px-4 py-3 font-medium">Tipo</th>
                      <th className="px-4 py-3 font-medium">Valor</th>
                      <th className="px-4 py-3 font-medium">Origem</th>
                      <th className="px-4 py-3 font-medium">Conciliado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ultimosLancamentos.map((item) => (
                      <tr key={item.id} className="border-b">
                        <td className="px-4 py-3">{formatDate(item.data)}</td>
                        <td className="px-4 py-3">{item.bankAccountName}</td>
                        <td className="px-4 py-3">{item.descricao}</td>
                        <td className="px-4 py-3">{item.tipo}</td>
                        <td className="px-4 py-3">
                          {formatCurrency(Number(item.valor))}
                        </td>
                        <td className="px-4 py-3">{item.origem}</td>
                        <td className="px-4 py-3">
                          {item.conciliado ? "Sim" : "Não"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}