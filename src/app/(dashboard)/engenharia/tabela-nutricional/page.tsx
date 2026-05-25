"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  listNutritionLabelSheets,
  listNutritionSnapshots,
  saveNutritionSnapshot,
  type NutritionLabelSheet,
  type NutritionSnapshotSummary,
} from "./actions";

function formatNumber(value: number, fractionDigits = 1) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data indisponível";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatValue(value: number, unit: string) {
  if (unit === "kcal" || unit === "mg") return `${formatNumber(value, 0)} ${unit}`;
  return `${formatNumber(value, 1)} ${unit}`;
}

function getNutritionValue(sheet: NutritionLabelSheet, key: keyof NutritionLabelSheet["per100g"]) {
  return Number(sheet.per100g[key] ?? 0);
}

function statusLabel(status: NutritionLabelSheet["status"]) {
  if (status === "complete") return "Completa";
  if (status === "partial") return "Parcial";
  return "Pendente";
}

function statusClass(status: NutritionLabelSheet["status"]) {
  if (status === "complete") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "partial") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-red-200 bg-red-50 text-red-800";
}

function getPrintStyles() {
  return `
    <style>
      @page { size: A4 portrait; margin: 10mm; }
      * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      body { margin: 0; padding: 0; background: #fff; color: #111827; font-family: Arial, Helvetica, sans-serif; }
      .no-print { display: none !important; }
      .print-shell { width: 100%; max-width: 190mm; margin: 0 auto; }
      .nutrition-label { width: 110mm; max-width: 100%; border: 2.5px solid #111; padding: 2.5mm; color: #111; background: #fff; font-family: Arial, Helvetica, sans-serif; }
      .nutrition-title { font-size: 20px; line-height: 1; font-weight: 900; letter-spacing: -0.02em; border-bottom: 8px solid #111; padding-bottom: 2mm; margin: 0 0 2mm; }
      .nutrition-subtitle { font-size: 9px; line-height: 1.25; margin: 0 0 2mm; }
      .nutrition-table { width: 100%; border-collapse: collapse; font-size: 8.4px; }
      .nutrition-table th, .nutrition-table td { border-top: 1px solid #111; padding: 1.1mm 0.7mm; text-align: right; vertical-align: top; }
      .nutrition-table th:first-child, .nutrition-table td:first-child { text-align: left; font-weight: 700; }
      .nutrition-table thead th { border-top: 3px solid #111; border-bottom: 1px solid #111; font-weight: 800; }
      .nutrition-footnote { border-top: 4px solid #111; margin-top: 2mm; padding-top: 1.5mm; font-size: 8px; line-height: 1.25; }
      .print-meta { margin-bottom: 5mm; font-size: 11px; color: #334155; }
    </style>
  `;
}

function NutritionTable({ sheet }: { sheet: NutritionLabelSheet }) {
  return (
    <div className="nutrition-label rounded-none bg-white text-slate-950 shadow-sm print:shadow-none">
      <h2 className="nutrition-title border-b-[8px] border-black pb-2 text-2xl font-black leading-none tracking-tight">
        INFORMAÇÃO NUTRICIONAL
      </h2>
      <p className="nutrition-subtitle mb-2 text-[11px] leading-tight">
        Porções por embalagem: {formatNumber(sheet.yieldPortions, 0)}<br />
        Porção: {formatNumber(sheet.portionWeight, 1)} {sheet.portionWeightUnit || "g"}
        {sheet.householdMeasure ? ` (${sheet.householdMeasure})` : ""}
      </p>

      <table className="nutrition-table w-full border-collapse text-[10px]">
        <thead>
          <tr>
            <th className="border-y-[3px] border-black py-1 text-left">Nutriente</th>
            <th className="border-y-[3px] border-black py-1 text-right">100 g</th>
            <th className="border-y-[3px] border-black py-1 text-right">Porção</th>
            <th className="border-y-[3px] border-black py-1 text-right">%VD*</th>
          </tr>
        </thead>
        <tbody>
          {sheet.labelRows.map((row) => (
            <tr key={row.key}>
              <td className="border-t border-black py-1 pr-2 font-bold">{row.label}</td>
              <td className="border-t border-black py-1 text-right">
                {formatValue(getNutritionValue(sheet, row.key), row.unit)}
              </td>
              <td className="border-t border-black py-1 text-right">{formatValue(row.value, row.unit)}</td>
              <td className="border-t border-black py-1 text-right">
                {row.dailyValuePercent === null ? "**" : `${row.dailyValuePercent}%`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="nutrition-footnote mt-2 border-t-4 border-black pt-2 text-[9px] leading-tight">
        *Percentual de valores diários fornecidos pela porção. **VD não estabelecido. Valores calculados a partir dos dados nutricionais cadastrados nos ingredientes/produtos da ficha técnica.
      </p>
    </div>
  );
}

export default function TabelaNutricionalPage() {
  const printRef = useRef<HTMLDivElement | null>(null);
  const [sheets, setSheets] = useState<NutritionLabelSheet[]>([]);
  const [snapshots, setSnapshots] = useState<NutritionSnapshotSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);
  const [error, setError] = useState("");
  const [snapshotMessage, setSnapshotMessage] = useState("");
  const [query, setQuery] = useState("");
  const [isSavingSnapshot, startSavingSnapshot] = useTransition();

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setError("");
        const data = await listNutritionLabelSheets();
        if (!mounted) return;
        setSheets(data);
        setSelectedId(data[0]?.id ?? null);
      } catch (err) {
        console.error(err);
        if (mounted) setError("Não foi possível carregar as tabelas nutricionais.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const filteredSheets = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return sheets;
    return sheets.filter((sheet) =>
      [sheet.name, sheet.category, sheet.sector].join(" ").toLowerCase().includes(normalized),
    );
  }, [query, sheets]);

  const selectedSheet = useMemo(() => {
    return sheets.find((sheet) => sheet.id === selectedId) ?? filteredSheets[0] ?? null;
  }, [filteredSheets, selectedId, sheets]);

  async function refreshSnapshots(technicalSheetId: string) {
    try {
      setLoadingSnapshots(true);
      const data = await listNutritionSnapshots(technicalSheetId);
      setSnapshots(data);
    } catch (err) {
      console.error(err);
      setSnapshots([]);
    } finally {
      setLoadingSnapshots(false);
    }
  }

  useEffect(() => {
    if (!selectedSheet) {
      setSnapshots([]);
      return;
    }

    refreshSnapshots(selectedSheet.id);
  }, [selectedSheet?.id]);

  const metrics = useMemo(() => {
    return {
      total: sheets.length,
      complete: sheets.filter((sheet) => sheet.status === "complete").length,
      partial: sheets.filter((sheet) => sheet.status === "partial").length,
      pending: sheets.filter((sheet) => sheet.status === "pending").length,
    };
  }, [sheets]);

  const handlePrint = useCallback(() => {
    const source = printRef.current;
    if (!source) {
      window.print();
      return;
    }

    const printWindow = window.open("", "_blank", "width=900,height=1100");
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
          <title>Tabela Nutricional - ${selectedSheet?.name ?? "Receita"}</title>
          ${getPrintStyles()}
        </head>
        <body>
          <div class="print-shell">${source.outerHTML}</div>
          <script>
            window.addEventListener("load", function () {
              setTimeout(function () { window.focus(); window.print(); }, 350);
            });
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }, [selectedSheet?.name]);

  function handleSaveSnapshot() {
    if (!selectedSheet) return;

    startSavingSnapshot(async () => {
      try {
        setError("");
        setSnapshotMessage("");
        await saveNutritionSnapshot(selectedSheet);
        setSnapshotMessage("Snapshot salvo com sucesso para histórico da receita.");
        await refreshSnapshots(selectedSheet.id);
      } catch (err) {
        console.error(err);
        setError((err as Error)?.message || "Não foi possível salvar o snapshot da tabela nutricional.");
      }
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-sky-50 to-violet-100 p-6 text-slate-950">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 rounded-3xl border border-white/60 bg-white/70 p-6 shadow-xl shadow-slate-900/10 backdrop-blur md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-700">Engenharia</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">Tabela Nutricional</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Cards de todas as fichas técnicas ativas. Clique em uma receita para visualizar e imprimir a tabela nutricional com colunas por 100 g, por porção e %VD.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/engenharia/tabela-nutricional/produtos" className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-900/20 transition hover:-translate-y-0.5 hover:bg-emerald-800">
              Cadastrar nutrientes
            </Link>
            <Link href="/engenharia" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              Voltar à Engenharia
            </Link>
            <button type="button" onClick={handlePrint} disabled={!selectedSheet} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
              Imprimir tabela
            </button>
          </div>
        </header>

        {loading ? (
          <div className="rounded-2xl border border-white/60 bg-white/70 p-6 shadow-lg">Carregando tabelas nutricionais...</div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 shadow-lg">{error}</div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_460px]">
            <section className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm">
                  <div className="text-xs text-slate-500">Fichas</div>
                  <div className="mt-1 text-2xl font-black">{metrics.total}</div>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
                  <div className="text-xs text-emerald-700">Completas</div>
                  <div className="mt-1 text-2xl font-black text-emerald-800">{metrics.complete}</div>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
                  <div className="text-xs text-amber-700">Parciais</div>
                  <div className="mt-1 text-2xl font-black text-amber-800">{metrics.partial}</div>
                </div>
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
                  <div className="text-xs text-red-700">Pendentes</div>
                  <div className="mt-1 text-2xl font-black text-red-800">{metrics.pending}</div>
                </div>
              </div>

              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar receita, categoria ou setor..."
                className="w-full rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm shadow-sm outline-none ring-emerald-500 transition focus:ring-2"
              />

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredSheets.map((sheet) => (
                  <button
                    key={sheet.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(sheet.id);
                      setSnapshotMessage("");
                    }}
                    className={`rounded-2xl border bg-white/75 p-5 text-left shadow-lg shadow-slate-900/10 transition hover:-translate-y-1 hover:shadow-xl ${selectedSheet?.id === sheet.id ? "border-emerald-500 ring-2 ring-emerald-300" : "border-white/70"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="font-bold leading-tight">{sheet.name}</h2>
                        <p className="mt-1 text-xs text-slate-500">{sheet.category} • {sheet.sector}</p>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusClass(sheet.status)}`}>
                        {statusLabel(sheet.status)}
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-600">
                      <div className="rounded-xl bg-slate-50 p-3">
                        <div className="font-semibold text-slate-900">Porção</div>
                        {formatNumber(sheet.portionWeight, 1)} {sheet.portionWeightUnit}
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <div className="font-semibold text-slate-900">Rendimento</div>
                        {formatNumber(sheet.yieldPortions, 0)} porções
                      </div>
                    </div>
                    {sheet.status !== "complete" && (
                      <p className="mt-3 text-xs text-slate-500">
                        Revise nutrientes de {sheet.missingNutritionIngredients.length + sheet.invalidQuantityIngredients.length} item(ns).
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </section>

            <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
              {selectedSheet ? (
                <>
                  <div ref={printRef} className="rounded-3xl border border-white/70 bg-white p-5 shadow-xl shadow-slate-900/10">
                    <div className="print-meta mb-4 text-sm text-slate-600">
                      <strong className="text-slate-950">{selectedSheet.name}</strong><br />
                      {selectedSheet.category} • {selectedSheet.sector}
                    </div>
                    <NutritionTable sheet={selectedSheet} />
                  </div>

                  <div className="rounded-2xl border border-white/70 bg-white/75 p-4 shadow-sm">
                    <button
                      type="button"
                      onClick={handleSaveSnapshot}
                      disabled={isSavingSnapshot || !selectedSheet}
                      className="w-full rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-emerald-900/20 transition hover:-translate-y-0.5 hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSavingSnapshot ? "Salvando snapshot..." : "Salvar snapshot da tabela"}
                    </button>
                    <p className="mt-2 text-xs text-slate-500">
                      Use após revisar os dados para guardar o resultado calculado desta versão da receita.
                    </p>
                    {snapshotMessage && (
                      <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">
                        {snapshotMessage}
                      </p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-white/70 bg-white/75 p-4 text-sm shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <strong>Histórico de snapshots</strong>
                      <span className="text-xs text-slate-500">Últimos 10</span>
                    </div>
                    {loadingSnapshots ? (
                      <p className="mt-3 text-xs text-slate-500">Carregando histórico...</p>
                    ) : snapshots.length === 0 ? (
                      <p className="mt-3 text-xs text-slate-500">Nenhum snapshot salvo para esta receita.</p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {snapshots.map((snapshot) => (
                          <div key={snapshot.id} className="rounded-xl border border-slate-100 bg-white/70 p-3 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-slate-900">{formatDateTime(snapshot.createdAt)}</span>
                              <span className={`rounded-full border px-2 py-0.5 font-bold ${statusClass(snapshot.status)}`}>
                                {statusLabel(snapshot.status)}
                              </span>
                            </div>
                            <div className="mt-2 grid grid-cols-2 gap-2 text-slate-600">
                              <span>Porção: {formatNumber(snapshot.servingWeightG, 1)} g</span>
                              <span>Rend.: {formatNumber(snapshot.portions, 0)}</span>
                              <span>Energia: {formatNumber(snapshot.caloriesKcal, 0)} kcal</span>
                              <span>Sódio: {formatNumber(snapshot.sodiumMg, 0)} mg</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className={`rounded-2xl border p-4 text-sm shadow-sm ${statusClass(selectedSheet.status)}`}>
                    <strong>Status: {statusLabel(selectedSheet.status)}</strong>
                    {selectedSheet.status !== "complete" && (
                      <div className="mt-2 space-y-2 text-xs">
                        {selectedSheet.missingNutritionIngredients.length > 0 && (
                          <p>Sem cadastro nutricional: {selectedSheet.missingNutritionIngredients.join(", ")}</p>
                        )}
                        {selectedSheet.invalidQuantityIngredients.length > 0 && (
                          <p>Quantidade/unidade a revisar: {selectedSheet.invalidQuantityIngredients.join(", ")}</p>
                        )}
                        <Link href="/engenharia/tabela-nutricional/produtos" className="inline-flex rounded-lg bg-white/70 px-3 py-2 text-xs font-bold shadow-sm transition hover:bg-white">
                          Completar cadastro de nutrientes
                        </Link>
                      </div>
                    )}
                  </div>

                  {selectedSheet.allergens && (
                    <div className="rounded-2xl border border-white/70 bg-white/75 p-4 text-sm shadow-sm">
                      <strong>Alergênicos:</strong> {selectedSheet.allergens}
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-2xl border border-white/70 bg-white/75 p-6 shadow-sm">Nenhuma ficha técnica encontrada.</div>
              )}
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
