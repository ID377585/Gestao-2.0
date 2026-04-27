"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { getSupplierVarianceSummary } from "@/lib/financeiro/supplier-variance";

type SupplierRow = Awaited<
  ReturnType<typeof getSupplierVarianceSummary>
>["suppliers"][number];

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function varianceClass(value: number) {
  if (value > 0) return "text-rose-600";
  if (value < 0) return "text-emerald-600";
  return "text-slate-500";
}

export default function DreSuppliersPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<SupplierRow[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        setError("");

        const result = await getSupplierVarianceSummary();
        if (cancelled) return;

        setRows(result.suppliers);
      } catch (err) {
        console.error(err);
        if (cancelled) return;
        setError("Não foi possível carregar o drill-down por fornecedor.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredRows = useMemo(() => {
    return rows.filter((row) =>
      row.supplierName.toLowerCase().includes(search.toLowerCase())
    );
  }, [rows, search]);

  const chartData = filteredRows.slice(0, 10).map((row) => ({
    name: row.supplierName,
    value: row.totalPositiveVarianceValue,
  }));

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Drill-down por fornecedor"
        description="Comparação entre custo real de recebimento e custo teórico das fichas, agrupada por fornecedor."
        actions={
          <>
            <Link
              href="/financeiro/dre"
              className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-900"
            >
              Voltar para DRE
            </Link>
            <Link
              href="/financeiro/dre/drilldown"
              className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-900"
            >
              Ver fichas e ingredientes
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 rounded-2xl border bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 lg:grid-cols-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar fornecedor"
          className="rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
        />

        <div className="rounded-xl border px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
          {filteredRows.length} fornecedores filtrados
        </div>

        <div className="rounded-xl border px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
          Desvio positivo = custo real acima do teórico
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          Carregando fornecedores...
        </div>
      ) : error ? (
        <div className="rounded-2xl border bg-white p-6 shadow-sm text-red-600 dark:border-slate-800 dark:bg-slate-950">
          {error}
        </div>
      ) : (
        <>
          <Panel title="Fornecedores com maior pressão de custo">
            <ResponsiveContainer width="100%" height={340}>
              <BarChart
                layout="vertical"
                data={chartData}
                margin={{ top: 8, right: 20, left: 20, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(value) => formatCurrency(Number(value))} />
                <YAxis type="category" dataKey="name" width={220} />
                <Tooltip formatter={(value) => formatCurrency(Number(value || 0))} />
                <Bar dataKey="value" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Detalhe por fornecedor">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="px-3 py-2">Fornecedor</th>
                    <th className="px-3 py-2">Itens</th>
                    <th className="px-3 py-2">Quantidade</th>
                    <th className="px-3 py-2">Variação média</th>
                    <th className="px-3 py-2">Desvio positivo</th>
                    <th className="px-3 py-2">Desvio negativo</th>
                    <th className="px-3 py-2">Produtos críticos</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.supplierId} className="border-b align-top">
                      <td className="px-3 py-2 font-medium">{row.supplierName}</td>
                      <td className="px-3 py-2">{row.totalItems}</td>
                      <td className="px-3 py-2">{row.totalQuantity}</td>
                      <td
                        className={`px-3 py-2 font-semibold ${varianceClass(
                          row.averageVariancePercent
                        )}`}
                      >
                        {formatPercent(row.averageVariancePercent)}
                      </td>
                      <td className="px-3 py-2 text-rose-600 font-semibold">
                        {formatCurrency(row.totalPositiveVarianceValue)}
                      </td>
                      <td className="px-3 py-2 text-emerald-600 font-semibold">
                        {formatCurrency(row.totalNegativeVarianceValue)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="space-y-1">
                          {row.topProducts.length === 0 ? (
                            <span className="text-slate-400">Sem produtos críticos</span>
                          ) : (
                            row.topProducts.map((product) => (
                              <div key={product.name} className="text-xs">
                                <span className="font-medium">{product.name}</span>
                                {" - "}
                                <span>{formatCurrency(product.value)}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </h2>
      {children}
    </div>
  );
}