"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import {
  getDreDashboardData,
  type DreDashboardData,
  type DreLine,
} from "@/lib/financeiro/dre";
import { isLegacyTableMissingError } from "@/lib/legacy/supabase";

const PIE_COLORS = ["#111827", "#2563eb", "#10b981", "#f59e0b", "#ef4444"];

function toNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatChartCurrency(value: unknown) {
  return formatCurrency(toNumber(value));
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function lineColor(value: number) {
  if (value > 0) return "text-emerald-600";
  if (value < 0) return "text-rose-600";
  return "text-slate-700";
}

export default function DrePage() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<DreDashboardData | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        setError("");

        const result = await getDreDashboardData({ dateFrom, dateTo });
        if (cancelled) return;

        setData(result);
      } catch (error) {
        console.error(error);
        if (cancelled) return;

        setError(
          isLegacyTableMissingError(error)
            ? "As tabelas financeiras ainda nao foram provisionadas neste banco."
            : "Nao foi possivel carregar a DRE."
        );
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
  }, [dateFrom, dateTo, reloadKey]);

  const summary = data?.summary;

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="DRE"
        description="Demonstrativo de Resultados do Exercicio com visao gerencial integrada ao financeiro atual."
        actions={
          <>
            <Link
              href="/financeiro/contas-a-receber"
              className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-900"
            >
              Contas a receber
            </Link>
            <Link
              href="/financeiro/contas-a-pagar"
              className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-900"
            >
              Contas a pagar
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 rounded-2xl border bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 md:grid-cols-3">
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
        />
        <button
          type="button"
          onClick={() => setReloadKey((current) => current + 1)}
          className="rounded-xl bg-black px-4 py-2 text-white dark:bg-white dark:text-black"
        >
          Atualizar
        </button>
      </div>

      {loading ? (
        <div className="rounded-2xl border bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Carregando DRE...
          </p>
        </div>
      ) : error || !data || !summary ? (
        <div className="rounded-2xl border bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <p className="text-sm text-red-600">
            {error || "Sem dados para a DRE."}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
            <StatCard
              title="Receita liquida"
              value={formatCurrency(summary.receitaLiquida)}
            />
            <StatCard
              title="Lucro bruto"
              value={formatCurrency(summary.lucroBruto)}
            />
            <StatCard title="EBITDA" value={formatCurrency(summary.ebitda)} />
            <StatCard
              title="Lucro liquido"
              value={formatCurrency(summary.lucroLiquido)}
            />
            <StatCard
              title="Margem bruta"
              value={formatPercent(data.cards.margemBruta)}
            />
            <StatCard
              title="Margem liquida"
              value={formatPercent(data.cards.margemLiquida)}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Panel title="Estrutura da DRE">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={data.lines}
                  margin={{ top: 8, right: 12, left: 0, bottom: 60 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="label"
                    angle={-20}
                    textAnchor="end"
                    interval={0}
                    height={72}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis tickFormatter={formatChartCurrency} />
                  <Tooltip formatter={formatChartCurrency} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {data.lines.map((line) => (
                      <Cell
                        key={line.key}
                        fill={line.value >= 0 ? "#111827" : "#ef4444"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Panel>

            <Panel title="Receitas x despesas x lucro por periodo">
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={data.charts.receitasVsDespesas}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="periodo" />
                  <YAxis tickFormatter={formatChartCurrency} />
                  <Tooltip formatter={formatChartCurrency} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="receitas"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="despesas"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="lucro"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Panel>

            <Panel title="Despesas por categoria">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  layout="vertical"
                  data={data.charts.topDespesas}
                  margin={{ top: 8, right: 20, left: 20, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={formatChartCurrency} />
                  <YAxis type="category" dataKey="name" width={150} />
                  <Tooltip formatter={formatChartCurrency} />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]} fill="#111827" />
                </BarChart>
              </ResponsiveContainer>
            </Panel>

            <Panel title="Composicao da DRE">
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={data.charts.composicaoDre}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={3}
                  >
                    {data.charts.composicaoDre.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={formatChartCurrency} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Panel>

            <Panel title="Evolucao operacional" className="xl:col-span-2">
              <ResponsiveContainer width="100%" height={340}>
                <AreaChart data={data.charts.receitasVsDespesas}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="periodo" />
                  <YAxis tickFormatter={formatChartCurrency} />
                  <Tooltip formatter={formatChartCurrency} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="receitas"
                    stroke="#2563eb"
                    fill="#93c5fd"
                    fillOpacity={0.35}
                  />
                  <Area
                    type="monotone"
                    dataKey="despesas"
                    stroke="#ef4444"
                    fill="#fca5a5"
                    fillOpacity={0.25}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Panel>
          </div>

          <Panel title="Linhas da DRE">
            <div className="space-y-3">
              {data.lines.map((line) => (
                <DreLineRow key={line.key} line={line} />
              ))}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="text-sm text-gray-500 dark:text-slate-400">{title}</div>
      <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-slate-100">
        {value}
      </div>
    </div>
  );
}

function Panel({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 ${className}`}
    >
      <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-slate-100">
        {title}
      </h2>
      {children}
    </div>
  );
}

function DreLineRow({ line }: { line: DreLine }) {
  return (
    <div className="flex items-center justify-between rounded-xl border px-4 py-3 dark:border-slate-800">
      <span className="text-sm font-medium text-gray-700 dark:text-slate-200">
        {line.label}
      </span>
      <span className={`text-sm font-semibold ${lineColor(line.value)}`}>
        {formatCurrency(line.value)}
      </span>
    </div>
  );
}