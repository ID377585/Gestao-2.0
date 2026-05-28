"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  deleteSalesPriceBenchmark,
  loadSalesPriceBenchmarks,
  saveSalesPriceBenchmark,
  type DishType,
  type ProductOption,
  type SalesPriceBenchmark,
} from "./actions";

const DISH_TYPES: DishType[] = ["Entrada", "Prato Principal", "Sobremesa"];
const RESTAURANT_FIELDS = [1, 2, 3, 4, 5] as const;

type FormState = {
  productId: string;
  dishType: DishType;
  manualSalePrice: string;
  restaurant1Name: string;
  restaurant2Name: string;
  restaurant3Name: string;
  restaurant4Name: string;
  restaurant5Name: string;
  restaurant1Price: string;
  restaurant2Price: string;
  restaurant3Price: string;
  restaurant4Price: string;
  restaurant5Price: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  productId: "",
  dishType: "Prato Principal",
  manualSalePrice: "",
  restaurant1Name: "",
  restaurant2Name: "",
  restaurant3Name: "",
  restaurant4Name: "",
  restaurant5Name: "",
  restaurant1Price: "",
  restaurant2Price: "",
  restaurant3Price: "",
  restaurant4Price: "",
  restaurant5Price: "",
  notes: "",
};

function keepRestaurantNames(form: FormState): FormState {
  return {
    ...EMPTY_FORM,
    restaurant1Name: form.restaurant1Name,
    restaurant2Name: form.restaurant2Name,
    restaurant3Name: form.restaurant3Name,
    restaurant4Name: form.restaurant4Name,
    restaurant5Name: form.restaurant5Name,
  };
}

function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "-";
  return `${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function toInputValue(value: number | null | undefined) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function toNullableNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function getRestaurantName(item: SalesPriceBenchmark, number: 1 | 2 | 3 | 4 | 5) {
  return item[`restaurant${number}Name` as keyof SalesPriceBenchmark] as string | null;
}

function getRestaurantPrice(item: SalesPriceBenchmark, number: 1 | 2 | 3 | 4 | 5) {
  return item[`restaurant${number}Price` as keyof SalesPriceBenchmark] as number | null;
}

function getPrintRestaurantHeader(items: SalesPriceBenchmark[], number: 1 | 2 | 3 | 4 | 5) {
  const counts = new Map<string, number>();

  items.forEach((item) => {
    const name = getRestaurantName(item, number)?.trim();
    if (!name) return;

    counts.set(name, (counts.get(name) ?? 0) + 1);
  });

  const mostUsed = Array.from(counts.entries()).sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"),
  )[0];

  return mostUsed?.[0] || `Conc. ${number}`;
}

function benchmarkToForm(item: SalesPriceBenchmark): FormState {
  return {
    productId: item.productId,
    dishType: item.dishType,
    manualSalePrice: toInputValue(item.manualSalePrice),
    restaurant1Name: item.restaurant1Name ?? "",
    restaurant2Name: item.restaurant2Name ?? "",
    restaurant3Name: item.restaurant3Name ?? "",
    restaurant4Name: item.restaurant4Name ?? "",
    restaurant5Name: item.restaurant5Name ?? "",
    restaurant1Price: toInputValue(item.restaurant1Price),
    restaurant2Price: toInputValue(item.restaurant2Price),
    restaurant3Price: toInputValue(item.restaurant3Price),
    restaurant4Price: toInputValue(item.restaurant4Price),
    restaurant5Price: toInputValue(item.restaurant5Price),
    notes: item.notes ?? "",
  };
}

function computeCompetitorAverage(form: FormState) {
  const prices = [
    form.restaurant1Price,
    form.restaurant2Price,
    form.restaurant3Price,
    form.restaurant4Price,
    form.restaurant5Price,
  ]
    .map(toNullableNumber)
    .filter((value): value is number => value !== null && value > 0);

  return prices.length > 0 ? roundMoney(prices.reduce((sum, price) => sum + price, 0) / prices.length) : null;
}

function roundSuggestedAboveAverage(average: number) {
  let suggested = Math.ceil(average);
  if (suggested <= average) suggested += 1;
  return suggested;
}

function computeSuggestedAverage(competitorAverage: number | null) {
  return competitorAverage !== null ? roundSuggestedAboveAverage(competitorAverage) : null;
}

function computePercentageIncrease(competitorAverage: number | null, suggestedAverage: number | null) {
  if (competitorAverage === null || suggestedAverage === null || competitorAverage <= 0) return null;
  return roundMoney(((suggestedAverage - competitorAverage) / competitorAverage) * 100);
}

export default function PrecoVendaMedioPage() {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [benchmarks, setBenchmarks] = useState<SalesPriceBenchmark[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  async function loadData() {
    try {
      setLoading(true);
      setError("");
      const data = await loadSalesPriceBenchmarks();
      setProducts(data.products);
      setBenchmarks(data.benchmarks);
      if (data.error) setError(data.error);
    } catch (err) {
      console.error(err);
      setError((err as Error)?.message || "Não foi possível carregar a página.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const selectedProduct = useMemo(() => {
    return products.find((product) => product.id === form.productId) ?? null;
  }, [products, form.productId]);

  const catalogSuggestedPrice = selectedProduct?.suggestedPrice ?? 0;
  const formCompetitorAverage = useMemo(() => computeCompetitorAverage(form), [form]);
  const formSuggestedAverage = useMemo(() => computeSuggestedAverage(formCompetitorAverage), [formCompetitorAverage]);
  const formPercentageVsSuggested = useMemo(
    () => computePercentageIncrease(formCompetitorAverage, formSuggestedAverage),
    [formCompetitorAverage, formSuggestedAverage],
  );

  const filteredBenchmarks = useMemo(() => {
    const q = normalizeSearch(search);
    if (!q) return benchmarks;
    return benchmarks.filter((item) =>
      normalizeSearch([
        item.productName,
        item.brand,
        item.category,
        item.dishType,
        item.restaurant1Name,
        item.restaurant2Name,
        item.restaurant3Name,
        item.restaurant4Name,
        item.restaurant5Name,
      ].filter(Boolean).join(" ")).includes(q),
    );
  }, [benchmarks, search]);

  const printCompetitorHeaders = useMemo(
    () => RESTAURANT_FIELDS.map((number) => getPrintRestaurantHeader(filteredBenchmarks, number)),
    [filteredBenchmarks],
  );

  const printGeneratedAt = useMemo(
    () =>
      new Date().toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      }),
    [],
  );

  const printCompetitorsCount = useMemo(
    () => printCompetitorHeaders.filter((name) => !name.startsWith("Conc.")).length,
    [printCompetitorHeaders],
  );

  const metrics = useMemo(() => {
    const withCompetitors = benchmarks.filter((item) => item.competitorAveragePrice !== null);
    return {
      total: benchmarks.length,
      withCompetitors: withCompetitors.length,
    };
  }, [benchmarks]);

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function editBenchmark(item: SalesPriceBenchmark) {
    setForm(benchmarkToForm(item));
    setStatus("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleSave() {
    setStatus("");
    setError("");
    const namesToKeep = keepRestaurantNames(form);

    startTransition(async () => {
      const result = await saveSalesPriceBenchmark({
        productId: form.productId,
        dishType: form.dishType,
        manualSalePrice: form.manualSalePrice ? Number(form.manualSalePrice) : null,
        restaurant1Name: form.restaurant1Name,
        restaurant2Name: form.restaurant2Name,
        restaurant3Name: form.restaurant3Name,
        restaurant4Name: form.restaurant4Name,
        restaurant5Name: form.restaurant5Name,
        restaurant1Price: form.restaurant1Price ? Number(form.restaurant1Price) : null,
        restaurant2Price: form.restaurant2Price ? Number(form.restaurant2Price) : null,
        restaurant3Price: form.restaurant3Price ? Number(form.restaurant3Price) : null,
        restaurant4Price: form.restaurant4Price ? Number(form.restaurant4Price) : null,
        restaurant5Price: form.restaurant5Price ? Number(form.restaurant5Price) : null,
        notes: form.notes,
      });

      if (!result.ok) {
        setError(result.error || "Não foi possível salvar.");
        return;
      }

      setStatus("Preço Venda Médio salvo com sucesso.");
      setForm(namesToKeep);
      await loadData();
    });
  }

  function handleDelete(item: SalesPriceBenchmark) {
    const confirmed = window.confirm(`Excluir a comparação de ${item.productName}?`);
    if (!confirmed) return;

    setStatus("");
    setError("");

    startTransition(async () => {
      const result = await deleteSalesPriceBenchmark(item.productId);

      if (!result.ok) {
        setError(result.error || "Não foi possível excluir.");
        return;
      }

      if (form.productId === item.productId) setForm(keepRestaurantNames(form));
      setStatus("Comparação excluída com sucesso.");
      await loadData();
    });
  }

  function handlePrint() {
    window.print();
  }

  return (
    <>
      <style>{`
        .benchmark-print-area {
          display: none;
        }

        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }

          html,
          body {
            background: #fff !important;
          }

          body * {
            visibility: hidden !important;
          }

          .benchmark-print-area,
          .benchmark-print-area * {
            visibility: visible !important;
          }

          .benchmark-screen-area {
            display: none !important;
          }

          .benchmark-print-area {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            color: #0f172a !important;
            font-family: Arial, Helvetica, sans-serif !important;
            width: 100% !important;
            max-width: 100% !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .benchmark-print-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 10px;
            margin-bottom: 8px;
            padding: 8px 10px;
            border: 1px solid #d1fae5;
            border-radius: 8px;
            background: #ecfdf5 !important;
          }

          .benchmark-print-title h1 {
            font-size: 14px;
            line-height: 1.1;
            margin: 0;
            font-weight: 900;
            color: #064e3b !important;
          }

          .benchmark-print-title p {
            font-size: 6.8px;
            line-height: 1.25;
            margin: 3px 0 0;
            color: #334155 !important;
          }

          .benchmark-print-meta {
            min-width: 120px;
            text-align: right;
            font-size: 6.4px;
            line-height: 1.35;
            color: #475569 !important;
          }

          .benchmark-print-meta strong {
            display: block;
            font-size: 8px;
            color: #064e3b !important;
          }

          .benchmark-print-summary {
            display: flex;
            gap: 6px;
            margin-bottom: 8px;
          }

          .benchmark-print-summary-card {
            flex: 1;
            padding: 5px 7px;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            background: #f8fafc !important;
          }

          .benchmark-print-summary-card span {
            display: block;
            font-size: 5.8px;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            color: #64748b !important;
            font-weight: 800;
          }

          .benchmark-print-summary-card strong {
            display: block;
            margin-top: 1px;
            font-size: 9px;
            color: #0f172a !important;
          }

          .benchmark-print-table {
            width: 100%;
            max-width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            table-layout: auto;
            font-size: 5.8px;
            line-height: 1.15;
            border: 1px solid #cbd5e1;
            border-radius: 7px;
            overflow: hidden;
          }

          .benchmark-print-table thead {
            display: table-header-group;
          }

          .benchmark-print-table tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .benchmark-print-table th {
            background: #0f766e !important;
            color: #fff !important;
            font-weight: 900;
            text-transform: uppercase;
            white-space: normal;
            border-right: 1px solid #115e59;
            border-bottom: 1px solid #115e59;
            padding: 4px 3px;
            vertical-align: middle;
            text-align: center;
          }

          .benchmark-print-table th:last-child,
          .benchmark-print-table td:last-child {
            border-right: 0;
          }

          .benchmark-print-table td {
            border-right: 1px solid #e2e8f0;
            border-bottom: 1px solid #e2e8f0;
            padding: 3px 3px;
            vertical-align: top;
            word-break: normal;
            overflow-wrap: break-word;
            color: #0f172a !important;
          }

          .benchmark-print-table tbody tr:nth-child(even) td {
            background: #f8fafc !important;
          }

          .benchmark-print-table tbody tr:nth-child(odd) td {
            background: #ffffff !important;
          }

          .benchmark-print-table tbody tr:last-child td {
            border-bottom: 0;
          }

          .benchmark-print-col-prato {
            width: 18%;
          }

          .benchmark-print-col-tipo {
            width: 6%;
          }

          .benchmark-print-col-money {
            width: 7%;
          }

          .benchmark-print-col-competitor {
            width: 6.3%;
          }

          .benchmark-print-col-percent {
            width: 4%;
          }

          .benchmark-print-product {
            font-weight: 900;
            color: #0f172a !important;
          }

          .benchmark-print-muted {
            color: #64748b !important;
            font-size: 5px;
            font-weight: 700;
          }

          .benchmark-print-money,
          .benchmark-print-percent {
            white-space: nowrap;
            text-align: right;
            font-variant-numeric: tabular-nums;
          }

          .benchmark-print-total {
            color: #047857 !important;
            font-weight: 900;
          }

          .benchmark-print-average {
            color: #1d4ed8 !important;
            font-weight: 900;
          }

          .benchmark-print-footer {
            margin-top: 7px;
            padding-top: 4px;
            border-top: 1px solid #e2e8f0;
            font-size: 5.8px;
            color: #64748b !important;
            text-align: right;
          }
        }
      `}</style>

      <div className="benchmark-screen-area min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-sky-100 p-6 text-slate-950">
        <div className="mx-auto max-w-[1700px] space-y-6">
          <header className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-xl shadow-slate-900/10 backdrop-blur">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-700">Engenharia</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">Preço Venda Médio</h1>
            <p className="mt-2 max-w-4xl text-sm text-slate-600">
              Compare o preço atual do catálogo com preços anotados da concorrência. O preço sugerido é arredondado para um número inteiro acima da média dos concorrentes.
            </p>
          </header>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white shadow-lg">
              <p className="text-xs text-slate-300">Pratos monitorados</p>
              <p className="mt-2 text-3xl font-black">{metrics.total}</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900 shadow-sm">
              <p className="text-xs">Com concorrentes</p>
              <p className="mt-2 text-3xl font-black">{metrics.withCompetitors}</p>
            </div>
          </section>

          <section className="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-xl shadow-slate-900/10 backdrop-blur">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">Cadastro da comparação</h2>
                <p className="text-xs text-slate-500">Digite o nome de cada concorrente e o preço encontrado. Os nomes ficam salvos junto com a comparação e permanecem após salvar.</p>
              </div>
            </div>

            <div className="overflow-x-auto pb-2">
              <div className="flex min-w-max items-end gap-3">
                <label className="w-[320px] shrink-0">
                  <span className="text-xs font-bold text-slate-700">Nome do prato</span>
                  <select
                    value={form.productId}
                    onChange={(event) => updateForm("productId", event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none ring-emerald-500 transition focus:ring-2"
                  >
                    <option value="">Selecione um produto do catálogo</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} {product.brand ? ` • ${product.brand}` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="w-[180px] shrink-0">
                  <span className="text-xs font-bold text-slate-700">Tipo</span>
                  <select
                    value={form.dishType}
                    onChange={(event) => updateForm("dishType", event.target.value as DishType)}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none ring-emerald-500 transition focus:ring-2"
                  >
                    {DISH_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </label>

                <div className="w-[190px] shrink-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[11px] font-bold text-slate-600">Preço de custo</p>
                  <p className="mt-1 text-lg font-black">{formatCurrency(catalogSuggestedPrice)}</p>
                </div>

                <label className="w-[160px] shrink-0">
                  <span className="text-xs font-bold text-slate-700">Preço Venda</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.manualSalePrice}
                    onChange={(event) => updateForm("manualSalePrice", event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none ring-emerald-500 transition focus:ring-2"
                  />
                </label>

                {RESTAURANT_FIELDS.map((number) => {
                  const nameKey = `restaurant${number}Name` as keyof FormState;
                  const priceKey = `restaurant${number}Price` as keyof FormState;

                  return (
                    <div key={number} className="w-[190px] shrink-0 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <input
                        value={form[nameKey]}
                        onChange={(event) => updateForm(nameKey, event.target.value as never)}
                        placeholder={`Nome restaurante ${number}`}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold outline-none ring-emerald-500 transition focus:ring-2"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form[priceKey]}
                        onChange={(event) => updateForm(priceKey, event.target.value as never)}
                        placeholder="Preço"
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none ring-emerald-500 transition focus:ring-2"
                      />
                    </div>
                  );
                })}

                <div className="w-[190px] shrink-0 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
                  <p className="text-[11px] font-bold text-blue-800">Média concorrência</p>
                  <p className="mt-1 text-lg font-black text-blue-900">{formatCurrency(formCompetitorAverage)}</p>
                </div>

                <div className="w-[190px] shrink-0 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <p className="text-[11px] font-bold text-emerald-800">Preço médio sugerido</p>
                  <p className="mt-1 text-lg font-black text-emerald-900">{formatCurrency(formSuggestedAverage)}</p>
                </div>

                <div className="w-[110px] shrink-0 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
                  <p className="text-[11px] font-bold text-blue-800">%</p>
                  <p className={`mt-1 text-lg font-black ${(formPercentageVsSuggested ?? 0) >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                    {formatPercent(formPercentageVsSuggested)}
                  </p>
                </div>
              </div>
            </div>

            <label className="mt-4 block">
              <span className="text-xs font-bold text-slate-700">Observações</span>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(event) => updateForm("notes", event.target.value)}
                placeholder="Ex.: restaurante referência, bairro, porção semelhante, data da cotação..."
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-emerald-500 transition focus:ring-2"
              />
            </label>

            {error ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
            {status ? <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{status}</p> : null}

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={isPending}
                className="rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-900/20 transition hover:-translate-y-0.5 hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "Salvando..." : "Salvar comparação"}
              </button>
              <button
                type="button"
                onClick={() => setForm(EMPTY_FORM)}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Limpar tudo
              </button>
            </div>
          </section>

          <section className="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-xl shadow-slate-900/10 backdrop-blur">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-black">Comparações registradas</h2>
                <p className="mt-1 text-sm text-slate-500">Use Editar para carregar os valores no formulário ou Excluir para remover a comparação.</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar prato, restaurante, marca, categoria..."
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-emerald-500 transition focus:ring-2 md:w-80"
                />
                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={filteredBenchmarks.length === 0}
                  className="rounded-2xl border border-slate-200 bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Imprimir comparações
                </button>
              </div>
            </div>

            {loading ? (
              <p className="mt-6 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">Carregando...</p>
            ) : filteredBenchmarks.length === 0 ? (
              <p className="mt-6 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">Nenhuma comparação registrada ainda.</p>
            ) : (
              <div className="mt-6 overflow-x-auto">
                <table className="min-w-[1750px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="sticky left-0 z-10 bg-white px-3 py-3">Prato</th>
                      <th className="px-3 py-3">Tipo</th>
                      <th className="px-3 py-3">Preço de custo</th>
                      <th className="px-3 py-3">Nosso preço definido</th>
                      {RESTAURANT_FIELDS.map((number) => (
                        <th key={number} className="px-3 py-3">Concorrente {number}</th>
                      ))}
                      <th className="px-3 py-3">Média concorrência</th>
                      <th className="px-3 py-3">Preço médio sugerido</th>
                      <th className="px-3 py-3">%</th>
                      <th className="px-3 py-3">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBenchmarks.map((item) => (
                      <tr key={item.id ?? item.productId} className="border-t border-slate-100 transition hover:bg-emerald-50/70">
                        <td className="sticky left-0 z-10 bg-white px-3 py-4 font-bold text-slate-900">
                          {item.productName}
                          <div className="text-xs font-medium text-slate-500">{item.brand || item.category || "Sem categoria"}</div>
                        </td>
                        <td className="px-3 py-4">{item.dishType}</td>
                        <td className="px-3 py-4 font-semibold">{formatCurrency(item.catalogSuggestedPrice)}</td>
                        <td className="px-3 py-4 font-semibold text-slate-900">{formatCurrency(item.manualSalePrice)}</td>
                        {RESTAURANT_FIELDS.map((number) => {
                          const name = getRestaurantName(item, number);
                          const price = getRestaurantPrice(item, number);

                          return (
                            <td key={number} className="px-3 py-4">
                              <div className="font-bold text-slate-800">{name || `Concorrente ${number}`}</div>
                              <div className="text-slate-600">{formatCurrency(price)}</div>
                            </td>
                          );
                        })}
                        <td className="px-3 py-4 font-semibold text-blue-800">{formatCurrency(item.competitorAveragePrice)}</td>
                        <td className="px-3 py-4 font-black text-emerald-700">{formatCurrency(item.suggestedAveragePrice)}</td>
                        <td className={`px-3 py-4 font-bold ${(item.percentageVsSuggested ?? 0) >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                          {formatPercent(item.percentageVsSuggested)}
                        </td>
                        <td className="px-3 py-4">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => editBenchmark(item)}
                              className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800 transition hover:bg-blue-100"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(item)}
                              disabled={isPending}
                              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>

      <div className="benchmark-print-area">
        <div className="benchmark-print-header">
          <div className="benchmark-print-title">
            <h1>Preço Venda Médio</h1>
            <p>
              Comparativo de preços da concorrência para análise de cardápio,
              posicionamento de venda e definição de preço sugerido.
            </p>
          </div>

          <div className="benchmark-print-meta">
            <strong>Relatório</strong>
            Gerado em {printGeneratedAt}
            <br />
            {filteredBenchmarks.length} comparação(ões)
          </div>
        </div>

        <div className="benchmark-print-summary">
          <div className="benchmark-print-summary-card">
            <span>Pratos listados</span>
            <strong>{filteredBenchmarks.length}</strong>
          </div>

          <div className="benchmark-print-summary-card">
            <span>Concorrentes</span>
            <strong>{printCompetitorsCount}</strong>
          </div>

          <div className="benchmark-print-summary-card">
            <span>Tipo de análise</span>
            <strong>Preço médio</strong>
          </div>
        </div>

        <table className="benchmark-print-table">
          <colgroup>
            <col className="benchmark-print-col-prato" />
            <col className="benchmark-print-col-tipo" />
            <col className="benchmark-print-col-money" />
            <col className="benchmark-print-col-money" />
            {RESTAURANT_FIELDS.map((number) => (
              <col key={`print-col-${number}`} className="benchmark-print-col-competitor" />
            ))}
            <col className="benchmark-print-col-money" />
            <col className="benchmark-print-col-money" />
            <col className="benchmark-print-col-percent" />
          </colgroup>

          <thead>
            <tr>
              <th>Prato</th>
              <th>Tipo</th>
              <th>Preço de custo</th>
              <th>Nosso preço</th>
              {RESTAURANT_FIELDS.map((number, index) => (
                <th key={number}>{printCompetitorHeaders[index]}</th>
              ))}
              <th>Média conc.</th>
              <th>Preço sugerido</th>
              <th>%</th>
            </tr>
          </thead>

          <tbody>
            {filteredBenchmarks.map((item) => (
              <tr key={`print-${item.id ?? item.productId}`}>
                <td>
                  <div className="benchmark-print-product">{item.productName}</div>
                  <span className="benchmark-print-muted">{item.brand || item.category || "Sem categoria"}</span>
                </td>

                <td>{item.dishType}</td>

                <td className="benchmark-print-money">
                  {formatCurrency(item.catalogSuggestedPrice)}
                </td>

                <td className="benchmark-print-money benchmark-print-total">
                  {formatCurrency(item.manualSalePrice)}
                </td>

                {RESTAURANT_FIELDS.map((number) => {
                  const price = getRestaurantPrice(item, number);

                  return (
                    <td key={`print-${item.id ?? item.productId}-${number}`} className="benchmark-print-money">
                      {formatCurrency(price)}
                    </td>
                  );
                })}

                <td className="benchmark-print-money benchmark-print-average">
                  {formatCurrency(item.competitorAveragePrice)}
                </td>

                <td className="benchmark-print-money benchmark-print-total">
                  {formatCurrency(item.suggestedAveragePrice)}
                </td>

                <td className="benchmark-print-percent">
                  {formatPercent(item.percentageVsSuggested)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="benchmark-print-footer">
          Relatório gerado pelo módulo Engenharia &gt; Preço Venda Médio.
        </div>
      </div>
    </>
  );
}