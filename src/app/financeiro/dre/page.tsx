"use client";

import { useEffect, useMemo, useState } from "react";
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
import { AlertTriangle, Download, FileText, Info, Siren } from "lucide-react";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import {
  getDreDashboardData,
  type DreAlert,
  type DreDashboardData,
  type DreLine,
} from "@/lib/financeiro/dre";
import {
  getPreviousEquivalentPeriod,
  resolveRange,
  type DrePeriodPreset,
} from "@/lib/financeiro/dre-period";
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

function formatNumber(value: number) {
  return value.toLocaleString("pt-BR");
}

function formatChartCurrency(value: unknown) {
  return formatCurrency(toNumber(value));
}

function formatChartNumber(value: unknown) {
  return formatNumber(toNumber(value));
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function lineColor(value: number) {
  if (value > 0) return "text-emerald-600";
  if (value < 0) return "text-rose-600";
  return "text-slate-700";
}

function deltaColor(current: number, previous: number) {
  const delta = current - previous;
  if (delta > 0) return "text-emerald-600";
  if (delta < 0) return "text-rose-600";
  return "text-slate-500";
}

function formatDeltaCurrency(current: number, previous: number) {
  const delta = current - previous;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${formatCurrency(delta)}`;
}

function downloadCsv(filename: string, rows: string[][]) {
  const csvContent = rows
    .map((row) =>
      row
        .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
        .join(";")
    )
    .join("\n");

  const blob = new Blob([csvContent], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function DrePage() {
  const [preset, setPreset] = useState<DrePeriodPreset>("this_month");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<DreDashboardData | null>(null);
  const [previousData, setPreviousData] = useState<DreDashboardData | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const resolvedRange = useMemo(
    () => resolveRange(preset, dateFrom, dateTo),
    [preset, dateFrom, dateTo]
  );

  const reportHref = useMemo(() => {
    const params = new URLSearchParams();

    if (resolvedRange?.dateFrom) {
      params.set("dateFrom", resolvedRange.dateFrom);
    }

    if (resolvedRange?.dateTo) {
      params.set("dateTo", resolvedRange.dateTo);
    }

    const query = params.toString();
    return query
      ? `/financeiro/dre/relatorio?${query}`
      : "/financeiro/dre/relatorio";
  }, [resolvedRange]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        setError("");

        const currentRange = resolvedRange;
        const previousRange = currentRange
          ? getPreviousEquivalentPeriod(currentRange)
          : null;

        const [currentResult, previousResult] = await Promise.all([
          getDreDashboardData(
            currentRange
              ? {
                  dateFrom: currentRange.dateFrom,
                  dateTo: currentRange.dateTo,
                }
              : {}
          ),
          previousRange
            ? getDreDashboardData({
                dateFrom: previousRange.dateFrom,
                dateTo: previousRange.dateTo,
              })
            : Promise.resolve(null),
        ]);

        if (cancelled) return;

        setData(currentResult);
        setPreviousData(previousResult);
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
  }, [resolvedRange, reloadKey]);

  const summary = data?.summary;
  const previousSummary = previousData?.summary ?? null;

  function handleExportCsv() {
    if (!data || !summary) return;

    const rows: string[][] = [
      ["Seção", "Campo", "Valor Atual"],
      ["Resumo", "Receita Bruta", String(summary.receitaBruta)],
      ["Resumo", "Deduções e Impostos", String(summary.deducoesImpostos)],
      ["Resumo", "Receita Líquida", String(summary.receitaLiquida)],
      ["Resumo", "CMV", String(summary.cmv)],
      ["Resumo", "CMV com Perdas Valorizadas", String(summary.cmvComPerdasValorizadas)],
      ["Resumo", "Perdas Valorizadas", String(summary.perdasValorizadas)],
      ["Resumo", "Lucro Bruto", String(summary.lucroBruto)],
      ["Resumo", "Lucro Bruto Ajustado", String(summary.lucroBrutoAjustado)],
      ["Resumo", "Despesas Operacionais", String(summary.despesasOperacionais)],
      ["Resumo", "EBITDA", String(summary.ebitda)],
      ["Resumo", "Resultado Financeiro", String(summary.resultadoFinanceiro)],
      ["Resumo", "Impostos Resultado", String(summary.impostosResultado)],
      ["Resumo", "Lucro Líquido", String(summary.lucroLiquido)],
      ["Resumo", "Lucro Líquido Ajustado", String(summary.lucroLiquidoAjustado)],
      ["Indicadores", "Margem Bruta", String(data.cards.margemBruta)],
      ["Indicadores", "Margem Bruta Ajustada", String(data.cards.margemBrutaAjustada)],
      ["Indicadores", "Margem Líquida", String(data.cards.margemLiquida)],
      ["Indicadores", "Margem Líquida Ajustada", String(data.cards.margemLiquidaAjustada)],
      ["Indicadores", "CMV Percentual", String(data.cards.cmvPercentual)],
      ["Indicadores", "CMV Ajustado Percentual", String(data.cards.cmvAjustadoPercentual)],
      ["Indicadores", "CMV Teórico Percentual", String(data.cards.cmvTeoricoPercentual)],
      ["Indicadores", "Despesas Percentual", String(data.cards.despesasPercentual)],
      ["Perdas", "Registros", String(data.losses.totalRegistros)],
      ["Perdas", "Quantidade", String(data.losses.totalQuantidade)],
      ["Perdas", "Valor Estimado", String(data.losses.totalValorEstimado)],
      ["Fichas Técnicas", "Total de Fichas", String(data.technicalSheets.totalSheets)],
      [
        "Fichas Técnicas",
        "CMV Teórico Médio",
        String(data.technicalSheets.averageTheoreticalCmvPercent),
      ],
      [
        "Variação",
        "Variação Média Ingredientes",
        String(data.technicalSheetVariance.averageVariancePercent),
      ],
      [],
      ["Linhas da DRE", "Label", "Valor"],
      ...data.lines.map((line) => ["Linha", line.label, String(line.value)]),
      [],
      ["Perdas por Motivo", "Motivo", "Quantidade"],
      ...data.charts.perdasPorMotivo.map((item) => [item.name, item.name, String(item.value)]),
      [],
      ["Fichas Críticas", "Ficha", "CMV Teórico"],
      ...data.charts.topFichasCriticas.map((item) => [item.name, item.name, String(item.value)]),
    ];

    downloadCsv("dre-dashboard.csv", rows);
  }

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="DRE"
        description="Demonstrativo de Resultados do Exercicio com visao gerencial integrada ao financeiro atual."
        actions={
          <>
            <Link
              href="/financeiro/dre/drilldown"
              className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-900"
            >
              Drill-down
            </Link>
            <Link
              href="/financeiro/dre/produtos"
              className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-900"
            >
              Produtos
            </Link>
            <Link
              href="/financeiro/dre/fornecedores"
              className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-900"
            >
              Fornecedores
            </Link>
            <Link
              href={reportHref}
              className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-900"
            >
              <FileText className="h-4 w-4" />
              Relatório / PDF
            </Link>
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
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-900"
            >
              <Download className="h-4 w-4" />
              Exportar CSV
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 rounded-2xl border bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 lg:grid-cols-5">
        <select
          value={preset}
          onChange={(e) => setPreset(e.target.value as DrePeriodPreset)}
          className="rounded-xl border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
        >
          <option value="this_month">Este mês</option>
          <option value="last_month">Mês anterior</option>
          <option value="this_quarter">Este trimestre</option>
          <option value="this_year">Este ano</option>
          <option value="custom">Período personalizado</option>
        </select>

        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          disabled={preset !== "custom"}
          className="rounded-xl border px-3 py-2 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          disabled={preset !== "custom"}
          className="rounded-xl border px-3 py-2 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950"
        />
        <div className="rounded-xl border px-3 py-2 text-sm text-gray-600 dark:border-slate-700 dark:text-slate-300">
          {resolvedRange
            ? `Atual: ${resolvedRange.dateFrom} até ${resolvedRange.dateTo}`
            : "Selecione um período"}
        </div>
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
          {previousSummary ? (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
              <ComparisonCard
                title="Receita líquida"
                current={summary.receitaLiquida}
                previous={previousSummary.receitaLiquida}
              />
              <ComparisonCard
                title="Lucro líquido"
                current={summary.lucroLiquido}
                previous={previousSummary.lucroLiquido}
              />
              <ComparisonCard
                title="CMV"
                current={summary.cmv}
                previous={previousSummary.cmv}
              />
              <ComparisonCard
                title="Despesas operacionais"
                current={summary.despesasOperacionais}
                previous={previousSummary.despesasOperacionais}
              />
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Panel title="Alertas automáticos">
              {data.alerts.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  Nenhum alerta crítico no período selecionado.
                </p>
              ) : (
                <div className="space-y-3">
                  {data.alerts.map((alert) => (
                    <AlertCard key={alert.key} alert={alert} />
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Recomendações acionáveis">
              <div className="space-y-3">
                {data.insights.map((insight) => (
                  <div
                    key={insight.key}
                    className="rounded-xl border px-4 py-3 text-sm text-gray-700 dark:border-slate-800 dark:text-slate-200"
                  >
                    {insight.label}
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
            <StatCard title="Receita líquida" value={formatCurrency(summary.receitaLiquida)} />
            <StatCard title="Lucro bruto" value={formatCurrency(summary.lucroBruto)} />
            <StatCard
              title="Lucro bruto ajustado"
              value={formatCurrency(summary.lucroBrutoAjustado)}
            />
            <StatCard title="EBITDA" value={formatCurrency(summary.ebitda)} />
            <StatCard title="Lucro líquido" value={formatCurrency(summary.lucroLiquido)} />
            <StatCard
              title="Lucro líquido ajustado"
              value={formatCurrency(summary.lucroLiquidoAjustado)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
            <StatCard title="Margem bruta" value={formatPercent(data.cards.margemBruta)} />
            <StatCard
              title="Margem bruta ajustada"
              value={formatPercent(data.cards.margemBrutaAjustada)}
            />
            <StatCard title="Margem líquida" value={formatPercent(data.cards.margemLiquida)} />
            <StatCard
              title="Margem líquida ajustada"
              value={formatPercent(data.cards.margemLiquidaAjustada)}
            />
            <StatCard title="CMV %" value={formatPercent(data.cards.cmvPercentual)} />
            <StatCard
              title="CMV ajustado %"
              value={formatPercent(data.cards.cmvAjustadoPercentual)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Registros de perdas"
              value={formatNumber(data.cards.perdasRegistros)}
            />
            <StatCard
              title="Quantidade perdida"
              value={formatNumber(data.cards.perdasQuantidade)}
            />
            <StatCard
              title="Perdas valorizadas"
              value={formatCurrency(data.cards.perdasValorEstimado)}
            />
            <StatCard
              title="Perdas sem custo"
              value={formatNumber(summary.perdasNaoValorizadasQuantidade)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <StatCard
              title="Fichas técnicas"
              value={formatNumber(data.cards.fichasTecnicasQuantidade)}
            />
            <StatCard
              title="CMV teórico médio"
              value={formatPercent(data.cards.cmvTeoricoPercentual)}
            />
            <StatCard
              title="Custo médio por porção"
              value={formatCurrency(data.technicalSheets.averageCostPerPortion)}
            />
            <StatCard
              title="Preço médio de venda"
              value={formatCurrency(data.technicalSheets.averageSalePrice)}
            />
            <StatCard
              title="Variação média ingredientes"
              value={formatPercent(data.cards.variacaoMediaIngredientesPercentual)}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Panel title="Estrutura da DRE">
              <ResponsiveContainer width="100%" height={360}>
                <BarChart
                  data={data.lines}
                  margin={{ top: 8, right: 12, left: 0, bottom: 80 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="label"
                    angle={-20}
                    textAnchor="end"
                    interval={0}
                    height={90}
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

            <Panel title="Receitas x despesas x lucro por período">
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={data.charts.receitasVsDespesas}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="periodo" />
                  <YAxis tickFormatter={formatChartCurrency} />
                  <Tooltip formatter={formatChartCurrency} />
                  <Legend />
                  <Line type="monotone" dataKey="receitas" stroke="#2563eb" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="despesas" stroke="#ef4444" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="lucro" stroke="#10b981" strokeWidth={2} dot={false} />
                  <Line
                    type="monotone"
                    dataKey="lucroAjustado"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Panel>

            <Panel title="Comparativo de CMV">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={data.charts.comparativoCmv}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={formatChartNumber} />
                  <Tooltip formatter={formatChartNumber} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {data.charts.comparativoCmv.map((item) => (
                      <Cell key={item.name} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Panel>

            <Panel title="Composição da DRE">
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
                      <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={formatChartCurrency} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Panel>

            <Panel title="Ingredientes acima do custo teórico">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  layout="vertical"
                  data={data.charts.ingredientesAcimaTeorico}
                  margin={{ top: 8, right: 20, left: 20, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={formatChartCurrency} />
                  <YAxis type="category" dataKey="name" width={180} />
                  <Tooltip formatter={formatChartCurrency} />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]} fill="#f97316" />
                </BarChart>
              </ResponsiveContainer>
            </Panel>

            <Panel title="Fichas com maior exposição ao custo real">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  layout="vertical"
                  data={data.charts.fichasPorExposicao}
                  margin={{ top: 8, right: 20, left: 20, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={formatChartCurrency} />
                  <YAxis type="category" dataKey="name" width={180} />
                  <Tooltip formatter={formatChartCurrency} />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]} fill="#7c3aed" />
                </BarChart>
              </ResponsiveContainer>
            </Panel>

            <Panel title="Evolução operacional" className="xl:col-span-2">
              <ResponsiveContainer width="100%" height={320}>
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

function ComparisonCard({
  title,
  current,
  previous,
}: {
  title: string;
  current: number;
  previous: number;
}) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="text-sm text-gray-500 dark:text-slate-400">{title}</div>
      <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-slate-100">
        {formatCurrency(current)}
      </div>
      <div className="mt-2 text-sm text-gray-500 dark:text-slate-400">
        Período anterior: {formatCurrency(previous)}
      </div>
      <div className={`mt-1 text-sm font-semibold ${deltaColor(current, previous)}`}>
        Variação: {formatDeltaCurrency(current, previous)}
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

function AlertCard({ alert }: { alert: DreAlert }) {
  const styles =
    alert.level === "danger"
      ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300"
      : alert.level === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300"
      : "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-300";

  return (
    <div className={`rounded-xl border p-4 ${styles}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          {alert.level === "danger" ? (
            <Siren className="h-4 w-4" />
          ) : alert.level === "warning" ? (
            <AlertTriangle className="h-4 w-4" />
          ) : (
            <Info className="h-4 w-4" />
          )}
        </div>
        <div>
          <div className="text-sm font-semibold">{alert.title}</div>
          <div className="mt-1 text-sm opacity-90">{alert.description}</div>
        </div>
      </div>
    </div>
  );
}