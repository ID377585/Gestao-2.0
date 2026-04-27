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
import { getProductVarianceSummary } from "@/lib/financeiro/product-variance";

type ProductRow = Awaited<
  ReturnType<typeof getProductVarianceSummary>
>["products"][number];

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

export default function DreProductsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [search, setSearch] = useState("");
  const [showOnlyPositive, setShowOnlyPositive] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        setError("");

        const result = await getProductVarianceSummary();
        if (cancelled) return;

        setRows(result.products);
      } catch (err) {
        console.error(err);
        if (cancelled) return;
        setError("Não foi possível carregar o drill-down por produto.");
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
    return rows.filter((row) => {
      const matchesSearch =
        !search || row.productName.toLowerCase().includes(search.toLowerCase());

      const matchesPositive = !showOnlyPositive || row.varianceValue > 0;

      return matchesSearch && matchesPositive;
    });
  }, [rows, search, showOnlyPositive]);

  const selectedProduct = useMemo(() => {
    if (!selectedProductId) return filteredRows[0] ?? null;
    return filteredRows.find((row) => row.productId === selectedProductId) ?? null;
  }, [filteredRows, selectedProductId]);

  const chartData = filteredRows.slice(0, 10).map((row) => ({
    name: row.productName,
    value: Number((row.varianceValue * row.totalQuantity).toFixed(2)),
  }));

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Drill-down por produto"
        description="Comparação entre custo real médio de recebimento e custo teórico das fichas, agrupada por produto."
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
            <Link
              href="/financeiro/dre/fornecedores"
              className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-900"
            >
              Ver fornecedores
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 rounded-2xl border bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 lg:grid-cols-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar produto"
          className="rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
        />

        <select
          value={selectedProductId}
          onChange={(e) => setSelectedProductId(e.target.value)}
          className="rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
        >
          <option value="">Selecionar produto em destaque</option>
          {filteredRows.map((row) => (
            <option key={row.productId} value={row.productId}>
              {row.productName}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-200">
          <input
            type="checkbox"
            checked={showOnlyPositive}
            onChange={(e) => setShowOnlyPositive(e.target.checked)}
          />
          Mostrar apenas desvio positivo
        </label>

        <div className="rounded-xl border px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
          {filteredRows.length} produtos filtrados
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          Carregando produtos...
        </div>
      ) : error ? (
        <div className="rounded-2xl border bg-white p-6 shadow-sm text-red-600 dark:border-slate-800 dark:bg-slate-950">
          {error}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Panel title="Produtos com maior impacto no custo">
              <ResponsiveContainer width="100%" height={340}>
                <BarChart
                  layout="vertical"
                  data={chartData}
                  margin={{ top: 8, right: 20, left: 20, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    tickFormatter={(value) => formatCurrency(Number(value))}
                  />
                  <YAxis type="category" dataKey="name" width={220} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value || 0))} />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Panel>

            <Panel title="Produto em destaque">
              {!selectedProduct ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Nenhum produto encontrado com o filtro atual.
                </p>
              ) : (
                <div className="space-y-3 text-sm">
                  <InfoRow label="Produto" value={selectedProduct.productName} />
                  <InfoRow
                    label="Quantidade total recebida"
                    value={selectedProduct.totalQuantity.toLocaleString("pt-BR")}
                  />
                  <InfoRow
                    label="Custo real médio"
                    value={formatCurrency(selectedProduct.averageRealUnitCost)}
                  />
                  <InfoRow
                    label="Custo teórico"
                    value={
                      selectedProduct.theoreticalUnitCost != null
                        ? formatCurrency(selectedProduct.theoreticalUnitCost)
                        : "Sem custo teórico"
                    }
                  />
                  <InfoRow
                    label="Desvio unitário"
                    value={formatCurrency(selectedProduct.varianceValue)}
                    className={varianceClass(selectedProduct.varianceValue)}
                  />
                  <InfoRow
                    label="Desvio percentual"
                    value={formatPercent(selectedProduct.variancePercent)}
                    className={varianceClass(selectedProduct.variancePercent)}
                  />
                  <InfoRow
                    label="Recebimentos"
                    value={String(selectedProduct.receiptsCount)}
                  />
                  <InfoRow
                    label="Fornecedores"
                    value={String(selectedProduct.suppliersCount)}
                  />
                </div>
              )}
            </Panel>
          </div>

          <Panel title="Detalhe por produto">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="px-3 py-2">Produto</th>
                    <th className="px-3 py-2">Quantidade</th>
                    <th className="px-3 py-2">Custo real médio</th>
                    <th className="px-3 py-2">Custo teórico</th>
                    <th className="px-3 py-2">Desvio unitário</th>
                    <th className="px-3 py-2">Desvio %</th>
                    <th className="px-3 py-2">Recebimentos</th>
                    <th className="px-3 py-2">Fornecedores</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr
                      key={row.productId}
                      className={`border-b ${selectedProduct?.productId === row.productId ? "bg-slate-50 dark:bg-slate-900/50" : ""}`}
                    >
                      <td className="px-3 py-2 font-medium">{row.productName}</td>
                      <td className="px-3 py-2">
                        {row.totalQuantity.toLocaleString("pt-BR")}
                      </td>
                      <td className="px-3 py-2">
                        {formatCurrency(row.averageRealUnitCost)}
                      </td>
                      <td className="px-3 py-2">
                        {row.theoreticalUnitCost != null
                          ? formatCurrency(row.theoreticalUnitCost)
                          : "Sem custo teórico"}
                      </td>
                      <td className={`px-3 py-2 font-semibold ${varianceClass(row.varianceValue)}`}>
                        {formatCurrency(row.varianceValue)}
                      </td>
                      <td className={`px-3 py-2 font-semibold ${varianceClass(row.variancePercent)}`}>
                        {formatPercent(row.variancePercent)}
                      </td>
                      <td className="px-3 py-2">{row.receiptsCount}</td>
                      <td className="px-3 py-2">{row.suppliersCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Fornecedores que impactam o produto em destaque">
            {!selectedProduct ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Selecione um produto para visualizar os fornecedores relacionados.
              </p>
            ) : selectedProduct.supplierContributions.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Nenhum fornecedor encontrado para este produto.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="px-3 py-2">Fornecedor</th>
                      <th className="px-3 py-2">Quantidade</th>
                      <th className="px-3 py-2">Custo real médio</th>
                      <th className="px-3 py-2">Desvio unitário</th>
                      <th className="px-3 py-2">Desvio %</th>
                      <th className="px-3 py-2">Recebimentos</th>
                      <th className="px-3 py-2">Último recebimento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedProduct.supplierContributions.map((supplier) => (
                      <tr key={`${selectedProduct.productId}-${supplier.supplierId}`} className="border-b">
                        <td className="px-3 py-2 font-medium">{supplier.supplierName}</td>
                        <td className="px-3 py-2">
                          {supplier.quantity.toLocaleString("pt-BR")}
                        </td>
                        <td className="px-3 py-2">
                          {formatCurrency(supplier.averageRealUnitCost)}
                        </td>
                        <td className={`px-3 py-2 font-semibold ${varianceClass(supplier.varianceValue)}`}>
                          {formatCurrency(supplier.varianceValue)}
                        </td>
                        <td className={`px-3 py-2 font-semibold ${varianceClass(supplier.variancePercent)}`}>
                          {formatPercent(supplier.variancePercent)}
                        </td>
                        <td className="px-3 py-2">{supplier.receiptsCount}</td>
                        <td className="px-3 py-2">
                          {supplier.lastReceiptDate
                            ? new Date(supplier.lastReceiptDate).toLocaleDateString("pt-BR")
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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

function InfoRow({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b pb-2 last:border-b-0">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className={`font-medium ${className}`}>{value}</span>
    </div>
  );
}