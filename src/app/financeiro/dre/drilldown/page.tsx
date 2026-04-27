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
import { getTechnicalSheetVarianceDetails } from "@/lib/financeiro/technical-sheet-variance-details";
import type {
  TechnicalSheetVarianceBySheet,
  TechnicalSheetVarianceDetailRow,
} from "@/lib/financeiro/technical-sheet-variance-details";

type ViewMode = "ingredientes" | "fichas";

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatChartCurrency(value: unknown) {
  return formatCurrency(Number(value || 0));
}

function varianceTextClass(value: number) {
  if (value > 0) return "text-rose-600";
  if (value < 0) return "text-emerald-600";
  return "text-slate-500";
}

export default function DreDrilldownPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("ingredientes");
  const [search, setSearch] = useState("");
  const [sheetFilter, setSheetFilter] = useState("");
  const [rows, setRows] = useState<TechnicalSheetVarianceDetailRow[]>([]);
  const [bySheet, setBySheet] = useState<TechnicalSheetVarianceBySheet[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        setError("");

        const result = await getTechnicalSheetVarianceDetails();
        if (cancelled) return;

        setRows(result.rows);
        setBySheet(result.bySheet);
      } catch (err) {
        console.error(err);
        if (cancelled) return;
        setError("Não foi possível carregar o drill-down da DRE.");
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

  const sheetOptions = useMemo(() => {
    return Array.from(new Set(rows.map((row) => row.technicalSheetName))).sort((a, b) =>
      a.localeCompare(b, "pt-BR")
    );
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const matchesSearch =
        !search ||
        row.ingredientName.toLowerCase().includes(search.toLowerCase()) ||
        row.technicalSheetName.toLowerCase().includes(search.toLowerCase());

      const matchesSheet =
        !sheetFilter || row.technicalSheetName === sheetFilter;

      return matchesSearch && matchesSheet;
    });
  }, [rows, search, sheetFilter]);

  const filteredSheets = useMemo(() => {
    return bySheet.filter((row) => {
      return (
        !search ||
        row.technicalSheetName.toLowerCase().includes(search.toLowerCase()) ||
        row.category.toLowerCase().includes(search.toLowerCase())
      );
    });
  }, [bySheet, search]);

  const topIngredientChart = filteredRows.slice(0, 10).map((row) => ({
    name: row.ingredientName,
    value: row.varianceValue,
  }));

  const topSheetChart = filteredSheets.slice(0, 10).map((row) => ({
    name: row.technicalSheetName,
    value: row.totalVarianceValue,
  }));

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Drill-down da DRE"
        description="Detalhamento do desvio entre custo teórico das fichas e custo real de compras."
        actions={
          <>
            <Link
              href="/financeiro/dre"
              className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-900"
            >
              Voltar para DRE
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 rounded-2xl border bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 lg:grid-cols-4">
        <select
          value={viewMode}
          onChange={(e) => setViewMode(e.target.value as ViewMode)}
          className="rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
        >
          <option value="ingredientes">Visão por ingredientes</option>
          <option value="fichas">Visão por fichas</option>
        </select>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar ficha ou ingrediente"
          className="rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
        />

        <select
          value={sheetFilter}
          onChange={(e) => setSheetFilter(e.target.value)}
          disabled={viewMode !== "ingredientes"}
          className="rounded-xl border px-3 py-2 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950"
        >
          <option value="">Todas as fichas</option>
          {sheetOptions.map((sheet) => (
            <option key={sheet} value={sheet}>
              {sheet}
            </option>
          ))}
        </select>

        <div className="rounded-xl border px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
          {viewMode === "ingredientes"
            ? `${filteredRows.length} linhas filtradas`
            : `${filteredSheets.length} fichas filtradas`}
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          Carregando drill-down...
        </div>
      ) : error ? (
        <div className="rounded-2xl border bg-white p-6 shadow-sm text-red-600 dark:border-slate-800 dark:bg-slate-950">
          {error}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Panel
              title={
                viewMode === "ingredientes"
                  ? "Ingredientes com maior desvio"
                  : "Fichas com maior exposição"
              }
            >
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  layout="vertical"
                  data={viewMode === "ingredientes" ? topIngredientChart : topSheetChart}
                  margin={{ top: 8, right: 20, left: 20, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={formatChartCurrency} />
                  <YAxis type="category" dataKey="name" width={180} />
                  <Tooltip formatter={formatChartCurrency} />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Panel>

            <Panel title="Leitura gerencial">
              <div className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
                <p>
                  Esta visão mostra onde o custo real de compra está acima do custo
                  teórico previsto nas fichas.
                </p>
                <p>
                  Desvio positivo indica pressão de custo. Desvio negativo indica que o
                  custo real está abaixo do teórico.
                </p>
                <p>
                  Use essa análise para revisar fornecedor, gramagem, ficha técnica ou
                  preço de venda.
                </p>
              </div>
            </Panel>
          </div>

          {viewMode === "ingredientes" ? (
            <Panel title="Detalhe por ingrediente">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="px-3 py-2">Ficha</th>
                      <th className="px-3 py-2">Ingrediente</th>
                      <th className="px-3 py-2">Qtd.</th>
                      <th className="px-3 py-2">Custo teórico</th>
                      <th className="px-3 py-2">Custo real</th>
                      <th className="px-3 py-2">Desvio</th>
                      <th className="px-3 py-2">Desvio %</th>
                      <th className="px-3 py-2">Fonte</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row, index) => (
                      <tr key={`${row.technicalSheetId}-${row.ingredientName}-${index}`} className="border-b">
                        <td className="px-3 py-2">{row.technicalSheetName}</td>
                        <td className="px-3 py-2">{row.ingredientName}</td>
                        <td className="px-3 py-2">
                          {row.usageQuantity} {row.usageUnit}
                        </td>
                        <td className="px-3 py-2">
                          {formatCurrency(row.theoreticalFinalCost)}
                        </td>
                        <td className="px-3 py-2">
                          {row.realFinalCost != null
                            ? formatCurrency(row.realFinalCost)
                            : "Sem custo"}
                        </td>
                        <td className={`px-3 py-2 font-semibold ${varianceTextClass(row.varianceValue)}`}>
                          {formatCurrency(row.varianceValue)}
                        </td>
                        <td className={`px-3 py-2 font-semibold ${varianceTextClass(row.variancePercent)}`}>
                          {formatPercent(row.variancePercent)}
                        </td>
                        <td className="px-3 py-2">{row.costSource ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          ) : (
            <Panel title="Detalhe por ficha">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="px-3 py-2">Ficha</th>
                      <th className="px-3 py-2">Categoria</th>
                      <th className="px-3 py-2">Ingredientes</th>
                      <th className="px-3 py-2">Com custo real</th>
                      <th className="px-3 py-2">Custo teórico</th>
                      <th className="px-3 py-2">Custo real</th>
                      <th className="px-3 py-2">Desvio</th>
                      <th className="px-3 py-2">Desvio %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSheets.map((row) => (
                      <tr key={row.technicalSheetId} className="border-b">
                        <td className="px-3 py-2">{row.technicalSheetName}</td>
                        <td className="px-3 py-2">{row.category}</td>
                        <td className="px-3 py-2">{row.ingredientsCount}</td>
                        <td className="px-3 py-2">{row.ingredientsWithRealCost}</td>
                        <td className="px-3 py-2">
                          {formatCurrency(row.totalTheoreticalCost)}
                        </td>
                        <td className="px-3 py-2">
                          {formatCurrency(row.totalRealCost)}
                        </td>
                        <td className={`px-3 py-2 font-semibold ${varianceTextClass(row.totalVarianceValue)}`}>
                          {formatCurrency(row.totalVarianceValue)}
                        </td>
                        <td className={`px-3 py-2 font-semibold ${varianceTextClass(row.averageVariancePercent)}`}>
                          {formatPercent(row.averageVariancePercent)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
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