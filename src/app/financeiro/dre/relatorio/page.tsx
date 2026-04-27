"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Printer } from "lucide-react";
import {
  getDreDashboardData,
  type DreDashboardData,
} from "@/lib/financeiro/dre";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { isLegacyTableMissingError } from "@/lib/legacy/supabase";

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatDateLabel(date?: string | null) {
  if (!date) return "-";
  return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR");
}

function lineColor(value: number) {
  if (value > 0) return "text-emerald-600";
  if (value < 0) return "text-rose-600";
  return "text-slate-700";
}

export default function DreRelatorioPage() {
  const searchParams = useSearchParams();

  const dateFrom = searchParams.get("dateFrom") ?? "";
  const dateTo = searchParams.get("dateTo") ?? "";

  const filters = useMemo(
    () => ({
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [dateFrom, dateTo]
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<DreDashboardData | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        setError("");

        const result = await getDreDashboardData(filters);

        if (cancelled) return;
        setData(result);
      } catch (error) {
        console.error(error);

        if (cancelled) return;

        setError(
          isLegacyTableMissingError(error)
            ? "As tabelas financeiras ainda nao foram provisionadas neste banco."
            : "Nao foi possivel carregar o relatorio da DRE."
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
  }, [filters]);

  function handlePrint() {
    window.print();
  }

  const summary = data?.summary;

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="print:hidden">
        <DashboardPageHeader
          title="Relatório Executivo da DRE"
          description="Versão pronta para impressão e exportação em PDF."
          actions={
            <>
              <Link
                href="/financeiro/dre"
                className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-900"
              >
                Voltar para DRE
              </Link>
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-900"
              >
                <Printer className="h-4 w-4" />
                Imprimir / Salvar PDF
              </button>
            </>
          }
        />
      </div>

      <div className="rounded-2xl border bg-white p-8 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none dark:border-slate-800 dark:bg-slate-950">
        {loading ? (
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Carregando relatório...
          </p>
        ) : error || !data || !summary ? (
          <p className="text-sm text-red-600">
            {error || "Sem dados para o relatório."}
          </p>
        ) : (
          <>
            <div className="border-b pb-6 print:pb-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 print:text-2xl">
                    DRE - Relatório Executivo
                  </h1>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    Demonstrativo de Resultados do Exercício com visão gerencial.
                  </p>
                </div>

                <div className="rounded-2xl border px-4 py-3 text-sm dark:border-slate-800">
                  <div>
                    <span className="font-medium">Período inicial:</span>{" "}
                    {formatDateLabel(filters.dateFrom)}
                  </div>
                  <div className="mt-1">
                    <span className="font-medium">Período final:</span>{" "}
                    {formatDateLabel(filters.dateTo)}
                  </div>
                  <div className="mt-1">
                    <span className="font-medium">Emitido em:</span>{" "}
                    {new Date().toLocaleString("pt-BR")}
                  </div>
                </div>
              </div>
            </div>

            <section className="mt-8 print:mt-6">
              <h2 className="mb-4 text-xl font-semibold text-slate-900 dark:text-slate-100">
                Resumo executivo
              </h2>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <SummaryCard
                  title="Receita líquida"
                  value={formatCurrency(summary.receitaLiquida)}
                />
                <SummaryCard
                  title="Lucro bruto"
                  value={formatCurrency(summary.lucroBruto)}
                />
                <SummaryCard
                  title="EBITDA"
                  value={formatCurrency(summary.ebitda)}
                />
                <SummaryCard
                  title="Lucro líquido"
                  value={formatCurrency(summary.lucroLiquido)}
                />
                <SummaryCard
                  title="Lucro líquido ajustado"
                  value={formatCurrency(summary.lucroLiquidoAjustado)}
                />
                <SummaryCard
                  title="CMV %"
                  value={formatPercent(data.cards.cmvPercentual)}
                />
                <SummaryCard
                  title="CMV ajustado %"
                  value={formatPercent(data.cards.cmvAjustadoPercentual)}
                />
                <SummaryCard
                  title="CMV teórico médio"
                  value={formatPercent(data.cards.cmvTeoricoPercentual)}
                />
              </div>
            </section>

            <section className="mt-8 print:mt-6">
              <h2 className="mb-4 text-xl font-semibold text-slate-900 dark:text-slate-100">
                Alertas automáticos
              </h2>

              {data.alerts.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Nenhum alerta crítico no período selecionado.
                </p>
              ) : (
                <div className="space-y-3">
                  {data.alerts.map((alert) => (
                    <div
                      key={alert.key}
                      className="rounded-xl border p-4 text-sm dark:border-slate-800"
                    >
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {alert.title}
                      </div>
                      <div className="mt-1 text-slate-600 dark:text-slate-300">
                        {alert.description}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="mt-8 print:mt-6">
              <h2 className="mb-4 text-xl font-semibold text-slate-900 dark:text-slate-100">
                Recomendações acionáveis
              </h2>

              <div className="space-y-3">
                {data.insights.map((insight) => (
                  <div
                    key={insight.key}
                    className="rounded-xl border p-4 text-sm text-slate-700 dark:border-slate-800 dark:text-slate-200"
                  >
                    {insight.label}
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-8 print:mt-6">
              <h2 className="mb-4 text-xl font-semibold text-slate-900 dark:text-slate-100">
                Linhas da DRE
              </h2>

              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50 text-left dark:bg-slate-900">
                      <th className="px-4 py-3 font-medium">Linha</th>
                      <th className="px-4 py-3 font-medium">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.lines.map((line) => (
                      <tr key={line.key} className="border-b dark:border-slate-800">
                        <td className="px-4 py-3">{line.label}</td>
                        <td
                          className={`px-4 py-3 font-semibold ${lineColor(
                            line.value
                          )}`}
                        >
                          {formatCurrency(line.value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-2 print:mt-6">
              <div className="rounded-2xl border p-5 dark:border-slate-800">
                <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Perdas
                </h3>
                <div className="space-y-2 text-sm">
                  <DataRow
                    label="Registros"
                    value={String(data.losses.totalRegistros)}
                  />
                  <DataRow
                    label="Quantidade"
                    value={formatNumber(data.losses.totalQuantidade)}
                  />
                  <DataRow
                    label="Quantidade valorizada"
                    value={formatNumber(data.losses.totalQuantidadeValorizada)}
                  />
                  <DataRow
                    label="Valor estimado"
                    value={formatCurrency(data.losses.totalValorEstimado)}
                  />
                </div>
              </div>

              <div className="rounded-2xl border p-5 dark:border-slate-800">
                <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Fichas técnicas
                </h3>
                <div className="space-y-2 text-sm">
                  <DataRow
                    label="Total de fichas"
                    value={String(data.technicalSheets.totalSheets)}
                  />
                  <DataRow
                    label="Custo médio por porção"
                    value={formatCurrency(data.technicalSheets.averageCostPerPortion)}
                  />
                  <DataRow
                    label="Preço médio de venda"
                    value={formatCurrency(data.technicalSheets.averageSalePrice)}
                  />
                  <DataRow
                    label="CMV teórico médio"
                    value={formatPercent(
                      data.technicalSheets.averageTheoreticalCmvPercent
                    )}
                  />
                </div>
              </div>
            </section>

            <section className="mt-8 print:mt-6">
              <h2 className="mb-4 text-xl font-semibold text-slate-900 dark:text-slate-100">
                Exposição de custo
              </h2>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <SimpleListCard
                  title="Ingredientes acima do custo teórico"
                  items={data.charts.ingredientesAcimaTeorico.map((item) => ({
                    label: item.name,
                    value: formatCurrency(item.value),
                  }))}
                />

                <SimpleListCard
                  title="Fichas com maior exposição ao custo real"
                  items={data.charts.fichasPorExposicao.map((item) => ({
                    label: item.name,
                    value: formatCurrency(item.value),
                  }))}
                />
              </div>
            </section>
          </>
        )}
      </div>

      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }

          @page {
            size: A4;
            margin: 14mm;
          }
        }
      `}</style>
    </div>
  );
}

function SummaryCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border bg-white p-5 dark:border-slate-800 dark:bg-slate-950 print:break-inside-avoid">
      <div className="text-sm text-slate-500 dark:text-slate-400">{title}</div>
      <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
        {value}
      </div>
    </div>
  );
}

function DataRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b pb-2 last:border-b-0 dark:border-slate-800">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="font-medium text-slate-900 dark:text-slate-100">
        {value}
      </span>
    </div>
  );
}

function SimpleListCard({
  title,
  items,
}: {
  title: string;
  items: Array<{
    label: string;
    value: string;
  }>;
}) {
  return (
    <div className="rounded-2xl border p-5 dark:border-slate-800 print:break-inside-avoid">
      <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </h3>

      {items.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Sem dados para o período.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={`${title}-${item.label}`}
              className="flex items-center justify-between gap-4 border-b pb-2 last:border-b-0 dark:border-slate-800"
            >
              <span className="text-sm text-slate-700 dark:text-slate-200">
                {item.label}
              </span>
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatNumber(value: number) {
  return value.toLocaleString("pt-BR");
}