"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { listAccountsPayable } from "@/lib/financeiro/accounts-payable";
import { listAccountsReceivable } from "@/lib/financeiro/accounts-receivable";
import type { AccountPayable, AccountReceivable } from "@/types/compras";

type DashboardState = {
  payables: AccountPayable[];
  receivables: AccountReceivable[];
};

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

export default function FinanceiroDashboardPage() {
  const [data, setData] = useState<DashboardState>({
    payables: [],
    receivables: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [payables, receivables] = await Promise.all([
        listAccountsPayable(),
        listAccountsReceivable(),
      ]);

      setData({ payables, receivables });
    } catch (err) {
      console.error(err);
      setError("Não foi possível carregar o dashboard financeiro.");
    } finally {
      setLoading(false);
    }
  }

  const metrics = useMemo(() => {
    const today = todayYmd();

    const totalPagarAberto = data.payables
      .filter(
        (item) =>
          item.statusPagamento !== "pago" &&
          item.statusPagamento !== "cancelado"
      )
      .reduce((acc, item) => acc + Number(item.valor), 0);

    const totalReceberAberto = data.receivables
      .filter(
        (item) =>
          item.statusRecebimento !== "recebido" &&
          item.statusRecebimento !== "cancelado"
      )
      .reduce((acc, item) => acc + Number(item.valor), 0);

    const vencidosPagar = data.payables
      .filter((item) => item.statusPagamento === "vencido")
      .reduce((acc, item) => acc + Number(item.valor), 0);

    const vencidosReceber = data.receivables
      .filter((item) => item.statusRecebimento === "vencido")
      .reduce((acc, item) => acc + Number(item.valor), 0);

    const pagarHoje = data.payables
      .filter(
        (item) =>
          item.vencimento === today &&
          item.statusPagamento !== "pago" &&
          item.statusPagamento !== "cancelado"
      )
      .reduce((acc, item) => acc + Number(item.valor), 0);

    const receberHoje = data.receivables
      .filter(
        (item) =>
          item.vencimento === today &&
          item.statusRecebimento !== "recebido" &&
          item.statusRecebimento !== "cancelado"
      )
      .reduce((acc, item) => acc + Number(item.valor), 0);

    const saldoPrevisto = totalReceberAberto - totalPagarAberto;

    return {
      totalPagarAberto,
      totalReceberAberto,
      vencidosPagar,
      vencidosReceber,
      pagarHoje,
      receberHoje,
      saldoPrevisto,
    };
  }, [data]);

  const ultimasSaidas = useMemo(() => {
    return [...data.payables]
      .sort((a, b) => (b.vencimento || "").localeCompare(a.vencimento || ""))
      .slice(0, 5);
  }, [data.payables]);

  const ultimasEntradas = useMemo(() => {
    return [...data.receivables]
      .sort((a, b) => (b.vencimento || "").localeCompare(a.vencimento || ""))
      .slice(0, 5);
  }, [data.receivables]);

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard Financeiro</h1>
          <p className="text-sm text-gray-500">
            Visão consolidada de contas a pagar, receber e saldo previsto.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/financeiro/contas-a-pagar"
            className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Abrir contas a pagar
          </Link>
          <Link
            href="/financeiro/contas-a-receber"
            className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Abrir contas a receber
          </Link>
          <Link
            href="/financeiro/fluxo-de-caixa"
            className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Abrir fluxo de caixa
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Carregando dashboard...</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">Total a pagar em aberto</div>
              <div className="mt-2 text-2xl font-bold">
                {formatCurrency(metrics.totalPagarAberto)}
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">Total a receber em aberto</div>
              <div className="mt-2 text-2xl font-bold">
                {formatCurrency(metrics.totalReceberAberto)}
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">Saldo previsto</div>
              <div className="mt-2 text-2xl font-bold">
                {formatCurrency(metrics.saldoPrevisto)}
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">Vencidos totais</div>
              <div className="mt-2 text-2xl font-bold">
                {formatCurrency(
                  metrics.vencidosPagar + metrics.vencidosReceber
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">A pagar hoje</div>
              <div className="mt-2 text-xl font-bold">
                {formatCurrency(metrics.pagarHoje)}
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">A receber hoje</div>
              <div className="mt-2 text-xl font-bold">
                {formatCurrency(metrics.receberHoje)}
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">Vencido a pagar</div>
              <div className="mt-2 text-xl font-bold">
                {formatCurrency(metrics.vencidosPagar)}
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">Vencido a receber</div>
              <div className="mt-2 text-xl font-bold">
                {formatCurrency(metrics.vencidosReceber)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Últimas saídas</h2>
                <Link
                  href="/financeiro/contas-a-pagar"
                  className="text-sm font-medium text-gray-600 hover:text-black"
                >
                  Ver tudo
                </Link>
              </div>

              {ultimasSaidas.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Nenhuma conta a pagar cadastrada.
                </p>
              ) : (
                <div className="space-y-3">
                  {ultimasSaidas.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-xl border px-4 py-3"
                    >
                      <div>
                        <div className="font-medium">{item.descricao}</div>
                        <div className="text-sm text-gray-500">
                          {item.supplierName} •{" "}
                          {item.vencimento
                            ? new Date(item.vencimento).toLocaleDateString("pt-BR")
                            : "-"}
                        </div>
                      </div>
                      <div className="text-right font-semibold">
                        {formatCurrency(Number(item.valor))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Últimas entradas</h2>
                <Link
                  href="/financeiro/contas-a-receber"
                  className="text-sm font-medium text-gray-600 hover:text-black"
                >
                  Ver tudo
                </Link>
              </div>

              {ultimasEntradas.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Nenhuma conta a receber cadastrada.
                </p>
              ) : (
                <div className="space-y-3">
                  {ultimasEntradas.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-xl border px-4 py-3"
                    >
                      <div>
                        <div className="font-medium">{item.descricao}</div>
                        <div className="text-sm text-gray-500">
                          {item.customerName} •{" "}
                          {item.vencimento
                            ? new Date(item.vencimento).toLocaleDateString("pt-BR")
                            : "-"}
                        </div>
                      </div>
                      <div className="text-right font-semibold">
                        {formatCurrency(Number(item.valor))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Ações rápidas</h2>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Link
                href="/financeiro/dashboard-bancario"
                className="rounded-xl border px-4 py-4 text-sm font-medium hover:bg-gray-50"
                >
                Abrir dashboard bancário
                </Link>
              <Link
                href="/financeiro/contas-a-pagar"
                className="rounded-xl border px-4 py-4 text-sm font-medium hover:bg-gray-50"
              >
                Gerenciar contas a pagar
              </Link>

              <Link
                href="/financeiro/contas-a-receber"
                className="rounded-xl border px-4 py-4 text-sm font-medium hover:bg-gray-50"
              >
                Gerenciar contas a receber
              </Link>

              <Link
                href="/financeiro/fluxo-de-caixa"
                className="rounded-xl border px-4 py-4 text-sm font-medium hover:bg-gray-50"
              >
                Ver fluxo de caixa
              </Link>

                <Link
                href="/financeiro/auditoria"
                className="rounded-xl border px-4 py-4 text-sm font-medium hover:bg-gray-50"
                >
                Abrir auditoria financeira
                </Link>
                
              <Link
                href="/dashboard/controladoria"
                className="rounded-xl border px-4 py-4 text-sm font-medium hover:bg-gray-50"
              >
                Abrir controladoria
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}