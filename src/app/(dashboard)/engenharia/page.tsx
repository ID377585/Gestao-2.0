"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listTechnicalSheets } from "@/app/(dashboard)/dashboard/fichas-tecnicas/actions";

type FichaTecnicaResumo = {
  id: string;
  nome: string;
  categoria: string;
  setor: string;
  rendimento: number;
  custoTotal: number;
  custoPorPorcao: number;
  precoVenda: number;
  ativo: boolean;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(value) ? value : 0);
}

function formatNumber(value: number, fractionDigits = 2) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  }).format(Number.isFinite(value) ? value : 0);
}

function normalizeText(value: string) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function normalizeSector(value: string) {
  const normalized = String(value ?? "").trim();
  return normalized || "Sem setor";
}

function calcularCMV(custoPorPorcao: number, precoVenda: number) {
  if (!precoVenda || precoVenda <= 0) return 0;
  return (custoPorPorcao / precoVenda) * 100;
}

const glassCard =
  "rounded-2xl border border-white/50 bg-white/70 p-5 shadow-xl shadow-slate-900/10 backdrop-blur-xl";

const actionCard =
  "group rounded-3xl border border-white/60 bg-white/75 p-6 shadow-xl shadow-slate-900/10 backdrop-blur-xl transition hover:-translate-y-1 hover:shadow-2xl";

export default function EngenhariaDashboardPage() {
  const pageRef = useRef<HTMLDivElement | null>(null);
  const [fichas, setFichas] = useState<FichaTecnicaResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const handlePrint = useCallback(() => {
    const source = pageRef.current;
    if (!source) {
      window.print();
      return;
    }

    const printWindow = window.open("", "_blank", "width=1440,height=900");
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.open();
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Dados de Engenharia de Cardápio</title>
          <style>
            @page { size: A4 landscape; margin: 8mm; }
            * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #0f172a; background: #fff; }
            .no-print { display: none !important; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; }
            th, td { border-bottom: 1px solid #cbd5e1; padding: 6px; text-align: left; }
            th { background: #f1f5f9; }
          </style>
        </head>
        <body>${source.outerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        setLoading(true);
        setError("");
        const result = await listTechnicalSheets();

        if (!mounted) return;

        setFichas(
          (result ?? []).map((item: any) => {
            const rendimento = Number(item.yield_portions ?? 0);
            const custoTotal = Number(item.total_cost ?? 0);
            const custoPorPorcao =
              Number(item.cost_per_portion ?? 0) > 0
                ? Number(item.cost_per_portion ?? 0)
                : rendimento > 0
                  ? custoTotal / rendimento
                  : custoTotal;

            return {
              id: String(item.id),
              nome: String(item.name ?? "Sem nome"),
              categoria: String(item.category ?? "").trim() || "Sem categoria",
              setor: normalizeSector(String(item.sector ?? "")),
              rendimento,
              custoTotal,
              custoPorPorcao,
              precoVenda: Number(item.sale_price ?? 0),
              ativo: item.active !== false,
            };
          }),
        );
      } catch (err) {
        console.error("Erro ao carregar dashboard de engenharia:", err);
        if (mounted) setError("Não foi possível carregar o dashboard de engenharia.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  const fichasAtivas = useMemo(() => fichas.filter((item) => item.ativo !== false), [fichas]);

  const metrics = useMemo(() => {
    const total = fichasAtivas.length;
    const custoTotalMedio =
      total > 0 ? fichasAtivas.reduce((sum, item) => sum + item.custoTotal, 0) / total : 0;
    const fichasComRendimento = fichasAtivas.filter((item) => item.rendimento > 0);
    const custoPorPorcaoMedio =
      fichasComRendimento.length > 0
        ? fichasComRendimento.reduce((sum, item) => sum + item.custoPorPorcao, 0) /
          fichasComRendimento.length
        : 0;
    const semRendimento = fichasAtivas.filter((item) => item.rendimento <= 0).length;
    const semCusto = fichasAtivas.filter((item) => item.custoTotal <= 0).length;
    const cmvMedio =
      total > 0
        ? fichasAtivas.reduce((sum, item) => sum + calcularCMV(item.custoPorPorcao, item.precoVenda), 0) /
          total
        : 0;

    return { total, custoTotalMedio, custoPorPorcaoMedio, semRendimento, semCusto, cmvMedio };
  }, [fichasAtivas]);

  const porSetor = useMemo(() => {
    const grouped = fichasAtivas.reduce<Record<string, number>>((acc, item) => {
      acc[item.setor] = (acc[item.setor] ?? 0) + 1;
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([setor, quantidade]) => ({ setor, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 8);
  }, [fichasAtivas]);

  const porCategoria = useMemo(() => {
    const grouped = fichasAtivas.reduce<Record<string, number>>((acc, item) => {
      acc[item.categoria] = (acc[item.categoria] ?? 0) + 1;
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([categoria, quantidade]) => ({ categoria, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 8);
  }, [fichasAtivas]);

  const topCustoPorPorcao = useMemo(() => {
    return [...fichasAtivas]
      .filter((item) => item.custoPorPorcao > 0)
      .sort((a, b) => b.custoPorPorcao - a.custoPorPorcao)
      .slice(0, 10);
  }, [fichasAtivas]);

  const fichasAtencao = useMemo(() => {
    return fichasAtivas
      .filter((item) => item.rendimento <= 0 || item.custoTotal <= 0 || item.custoPorPorcao <= 0)
      .slice(0, 10);
  }, [fichasAtivas]);

  return (
    <div
      ref={pageRef}
      className="min-h-screen bg-gradient-to-br from-emerald-50 via-sky-50 to-violet-100 p-6 text-slate-950"
    >
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 rounded-3xl border border-white/60 bg-white/75 p-6 shadow-xl shadow-slate-900/10 backdrop-blur md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-700">Engenharia</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">Dados de Engenharia de Cardápio</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Visão executiva das fichas técnicas com foco em custo, rendimento, CMV e distribuição por setor.
            </p>
          </div>

          <div className="no-print flex flex-wrap gap-3">
            <Link
              href="/engenharia/tabela-nutricional"
              className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-emerald-900/20 transition hover:-translate-y-0.5 hover:bg-emerald-800"
            >
              Tabela Nutricional
            </Link>
            <Link
              href="/engenharia/tabela-nutricional/produtos"
              className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-100"
            >
              Cadastrar Nutrientes
            </Link>
            <button
              type="button"
              onClick={handlePrint}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              Imprimir
            </button>
            <Link
              href="/dashboard/fichas-tecnicas"
              className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5 hover:bg-slate-800"
            >
              Fichas técnicas
            </Link>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Link href="/engenharia/tabela-nutricional" className={actionCard}>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Nova área</div>
            <h2 className="mt-2 text-2xl font-black">Tabela Nutricional</h2>
            <p className="mt-2 text-sm text-slate-600">
              Gere, revise, salve snapshots e imprima a tabela nutricional das receitas com ficha técnica.
            </p>
            <span className="mt-4 inline-flex rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white transition group-hover:bg-emerald-800">
              Abrir página
            </span>
          </Link>

          <Link href="/engenharia/tabela-nutricional/produtos" className={actionCard}>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-blue-700">Cadastro</div>
            <h2 className="mt-2 text-2xl font-black">Nutrientes</h2>
            <p className="mt-2 text-sm text-slate-600">
              Cadastre ou importe por CSV os nutrientes por 100 g/100 ml dos produtos usados nas receitas.
            </p>
            <span className="mt-4 inline-flex rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white transition group-hover:bg-blue-800">
              Cadastrar dados
            </span>
          </Link>

          <Link href="/dashboard/fichas-tecnicas" className={actionCard}>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-700">Base</div>
            <h2 className="mt-2 text-2xl font-black">Fichas Técnicas</h2>
            <p className="mt-2 text-sm text-slate-600">
              Acesse e mantenha as receitas, ingredientes, rendimento e custos usados pela Engenharia.
            </p>
            <span className="mt-4 inline-flex rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white transition group-hover:bg-slate-800">
              Abrir fichas
            </span>
          </Link>

          <button type="button" onClick={handlePrint} className={`${actionCard} text-left`}>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-violet-700">Relatório</div>
            <h2 className="mt-2 text-2xl font-black">Imprimir</h2>
            <p className="mt-2 text-sm text-slate-600">
              Gere uma visão impressa dos principais indicadores de engenharia de cardápio.
            </p>
            <span className="mt-4 inline-flex rounded-xl bg-violet-700 px-4 py-2 text-sm font-bold text-white transition group-hover:bg-violet-800">
              Imprimir relatório
            </span>
          </button>
        </section>

        {loading ? (
          <div className={glassCard}>
            <p className="text-sm text-slate-600">Carregando dashboard...</p>
          </div>
        ) : error ? (
          <div className={glassCard}>
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className={glassCard}>
                <div className="text-sm text-slate-600">Fichas técnicas ativas</div>
                <div className="mt-2 text-3xl font-black">{metrics.total}</div>
                <p className="mt-1 text-xs text-slate-500">Receitas ativas registradas.</p>
              </div>
              <div className={glassCard}>
                <div className="text-sm text-slate-600">Custo total médio</div>
                <div className="mt-2 text-3xl font-black">{formatMoney(metrics.custoTotalMedio)}</div>
                <p className="mt-1 text-xs text-slate-500">Média do custo total por ficha.</p>
              </div>
              <div className={glassCard}>
                <div className="text-sm text-slate-600">Custo por porção médio</div>
                <div className="mt-2 text-3xl font-black">{formatMoney(metrics.custoPorPorcaoMedio)}</div>
                <p className="mt-1 text-xs text-slate-500">Indicador de precificação e margem.</p>
              </div>
              <div className={glassCard}>
                <div className="text-sm text-slate-600">CMV médio</div>
                <div className="mt-2 text-3xl font-black">{formatNumber(metrics.cmvMedio, 1)}%</div>
                <p className="mt-1 text-xs text-slate-500">Com base no preço de venda cadastrado.</p>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-3">
              <div className={glassCard}>
                <h2 className="text-lg font-bold">Fichas por setor</h2>
                <div className="mt-4 space-y-3">
                  {porSetor.length === 0 ? (
                    <p className="text-sm text-slate-600">Nenhum setor encontrado.</p>
                  ) : (
                    porSetor.map((item) => (
                      <div key={item.setor}>
                        <div className="flex justify-between text-sm">
                          <span className="font-semibold">{item.setor}</span>
                          <span>{item.quantidade}</span>
                        </div>
                        <div className="mt-1 h-2 rounded-full bg-slate-100">
                          <div
                            className="h-2 rounded-full bg-emerald-600"
                            style={{ width: `${Math.max(8, (item.quantidade / Math.max(1, metrics.total)) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className={glassCard}>
                <h2 className="text-lg font-bold">Fichas por categoria</h2>
                <div className="mt-4 space-y-3">
                  {porCategoria.length === 0 ? (
                    <p className="text-sm text-slate-600">Nenhuma categoria encontrada.</p>
                  ) : (
                    porCategoria.map((item) => (
                      <div key={item.categoria}>
                        <div className="flex justify-between text-sm">
                          <span className="font-semibold">{item.categoria}</span>
                          <span>{item.quantidade}</span>
                        </div>
                        <div className="mt-1 h-2 rounded-full bg-slate-100">
                          <div
                            className="h-2 rounded-full bg-blue-600"
                            style={{ width: `${Math.max(8, (item.quantidade / Math.max(1, metrics.total)) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className={glassCard}>
                <h2 className="text-lg font-bold">Fichas com atenção</h2>
                <div className="mt-4 space-y-3">
                  {fichasAtencao.length === 0 ? (
                    <p className="text-sm text-emerald-700">Nenhuma ficha crítica encontrada.</p>
                  ) : (
                    fichasAtencao.map((item) => (
                      <div key={item.id} className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm">
                        <div className="font-bold text-amber-900">{item.nome}</div>
                        <div className="mt-1 text-xs text-amber-800">
                          Rend.: {formatNumber(item.rendimento, 0)} • Custo: {formatMoney(item.custoTotal)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>

            <section className={glassCard}>
              <h2 className="text-lg font-bold">Top custo por porção</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-3 pr-4">Ficha</th>
                      <th className="py-3 pr-4">Setor</th>
                      <th className="py-3 pr-4">Categoria</th>
                      <th className="py-3 pr-4">Rendimento</th>
                      <th className="py-3 pr-4">Custo por porção</th>
                      <th className="py-3 pr-4">CMV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topCustoPorPorcao.length === 0 ? (
                      <tr>
                        <td className="py-4 text-slate-500" colSpan={6}>Nenhuma ficha com custo por porção encontrado.</td>
                      </tr>
                    ) : (
                      topCustoPorPorcao.map((item) => (
                        <tr key={item.id} className="border-b border-slate-100">
                          <td className="py-3 pr-4 font-semibold">{item.nome}</td>
                          <td className="py-3 pr-4">{item.setor}</td>
                          <td className="py-3 pr-4">{item.categoria}</td>
                          <td className="py-3 pr-4">{formatNumber(item.rendimento, 0)}</td>
                          <td className="py-3 pr-4 font-bold">{formatMoney(item.custoPorPorcao)}</td>
                          <td className="py-3 pr-4">{formatNumber(calcularCMV(item.custoPorPorcao, item.precoVenda), 1)}%</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
