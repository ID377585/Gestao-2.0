"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  listProductsForNutritionEditor,
  saveProductNutrition,
  saveProductNutritionBatch,
  type ProductNutritionEditorItem,
} from "./actions";
import type { NutritionFacts } from "../actions";

const FIELD_DEFINITIONS: Array<{
  key: keyof NutritionFacts;
  label: string;
  unit: string;
  step: string;
}> = [
  { key: "calories_kcal", label: "Valor energético", unit: "kcal", step: "1" },
  { key: "carbohydrates_g", label: "Carboidratos", unit: "g", step: "0.1" },
  { key: "total_sugars_g", label: "Açúcares totais", unit: "g", step: "0.1" },
  { key: "added_sugars_g", label: "Açúcares adicionados", unit: "g", step: "0.1" },
  { key: "proteins_g", label: "Proteínas", unit: "g", step: "0.1" },
  { key: "total_fat_g", label: "Gorduras totais", unit: "g", step: "0.1" },
  { key: "saturated_fat_g", label: "Gorduras saturadas", unit: "g", step: "0.1" },
  { key: "trans_fat_g", label: "Gorduras trans", unit: "g", step: "0.1" },
  { key: "dietary_fiber_g", label: "Fibra alimentar", unit: "g", step: "0.1" },
  { key: "sodium_mg", label: "Sódio", unit: "mg", step: "1" },
];

const EMPTY_NUTRITION: NutritionFacts = {
  calories_kcal: 0,
  carbohydrates_g: 0,
  total_sugars_g: 0,
  added_sugars_g: 0,
  proteins_g: 0,
  total_fat_g: 0,
  saturated_fat_g: 0,
  trans_fat_g: 0,
  dietary_fiber_g: 0,
  sodium_mg: 0,
};

const CSV_TO_FIELD: Record<string, keyof NutritionFacts> = {
  valor_energetico_kcal_100g: "calories_kcal",
  calorias_kcal_100g: "calories_kcal",
  calories_kcal: "calories_kcal",
  carboidratos_g_100g: "carbohydrates_g",
  carbohydrates_g: "carbohydrates_g",
  acucares_totais_g_100g: "total_sugars_g",
  total_sugars_g: "total_sugars_g",
  acucares_adicionados_g_100g: "added_sugars_g",
  added_sugars_g: "added_sugars_g",
  proteinas_g_100g: "proteins_g",
  proteins_g: "proteins_g",
  gorduras_totais_g_100g: "total_fat_g",
  total_fat_g: "total_fat_g",
  gorduras_saturadas_g_100g: "saturated_fat_g",
  saturated_fat_g: "saturated_fat_g",
  gorduras_trans_g_100g: "trans_fat_g",
  trans_fat_g: "trans_fat_g",
  fibra_alimentar_g_100g: "dietary_fiber_g",
  dietary_fiber_g: "dietary_fiber_g",
  sodio_mg_100g: "sodium_mg",
  sodium_mg: "sodium_mg",
};

function formatDate(value: string | null) {
  if (!value) return "Nunca atualizado";
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

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizeHeader(value: string) {
  return normalizeSearch(value).replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
}

function toFormState(product: ProductNutritionEditorItem | null) {
  return {
    nutrition: product?.nutrition ?? { ...EMPTY_NUTRITION },
    source: product?.source ?? "",
    notes: product?.notes ?? "",
  };
}

function escapeCsvCell(value: unknown) {
  const text = String(value ?? "");
  if (/[";\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function downloadCsv(filename: string, rows: unknown[][]) {
  const csv = rows.map((row) => row.map(escapeCsvCell).join(";")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function parseCsvLine(line: string, delimiter: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function parsePtNumber(value: string) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function parseNutritionCsv(text: string) {
  const cleanText = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = cleanText.split("\n").filter((line) => line.trim());

  if (lines.length < 2) return [];

  const delimiter = lines[0].includes(";") ? ";" : ",";
  const headers = parseCsvLine(lines[0], delimiter).map(normalizeHeader);
  const productIdIndex = headers.indexOf("product_id");

  if (productIdIndex < 0) {
    throw new Error("CSV sem coluna product_id.");
  }

  return lines
    .slice(1)
    .map((line) => {
      const cells = parseCsvLine(line, delimiter);
      const nutrition = { ...EMPTY_NUTRITION };

      headers.forEach((header, index) => {
        const key = CSV_TO_FIELD[header];
        if (!key) return;
        nutrition[key] = parsePtNumber(cells[index] ?? "");
      });

      const sourceIndex = headers.indexOf("fonte") >= 0 ? headers.indexOf("fonte") : headers.indexOf("source");
      const notesIndex = headers.indexOf("observacoes") >= 0 ? headers.indexOf("observacoes") : headers.indexOf("notes");

      return {
        productId: cells[productIdIndex]?.trim() ?? "",
        ...nutrition,
        source: sourceIndex >= 0 ? cells[sourceIndex] ?? "" : "",
        notes: notesIndex >= 0 ? cells[notesIndex] ?? "" : "",
      };
    })
    .filter((row) => row.productId);
}

export default function ProdutosTabelaNutricionalPage() {
  const [products, setProducts] = useState<ProductNutritionEditorItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "complete" | "pending">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isImporting, startImportTransition] = useTransition();
  const [form, setForm] = useState(() => toFormState(null));

  async function loadProducts() {
    try {
      setLoading(true);
      setError("");
      const data = await listProductsForNutritionEditor();
      setProducts(data);
    } catch (err) {
      console.error(err);
      setError((err as Error)?.message || "Não foi possível carregar os produtos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  const selectedProduct = useMemo(() => {
    if (!selectedId) return null;
    return products.find((product) => product.productId === selectedId) ?? null;
  }, [products, selectedId]);

  useEffect(() => {
    setForm(toFormState(selectedProduct));
    setSuccess("");
  }, [selectedProduct]);

  const filteredProducts = useMemo(() => {
    const search = normalizeSearch(query);

    return products.filter((product) => {
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "complete" && product.hasNutrition) ||
        (statusFilter === "pending" && !product.hasNutrition);

      if (!matchesStatus) return false;
      if (!search) return true;

      return normalizeSearch(
        [product.name, product.brand, product.category, product.sectorCategory, product.allergens]
          .filter(Boolean)
          .join(" "),
      ).includes(search);
    });
  }, [products, query, statusFilter]);

  const metrics = useMemo(() => {
    return {
      total: products.length,
      complete: products.filter((product) => product.hasNutrition).length,
      pending: products.filter((product) => !product.hasNutrition).length,
    };
  }, [products]);

  function openProductModal(productId: string) {
    setError("");
    setSuccess("");
    setSelectedId(productId);
  }

  function closeProductModal() {
    if (isPending) return;
    setSelectedId(null);
    setError("");
    setSuccess("");
  }

  function updateNutritionField(key: keyof NutritionFacts, value: string) {
    const parsed = Number(value);
    setForm((current) => ({
      ...current,
      nutrition: {
        ...current.nutrition,
        [key]: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0,
      },
    }));
  }

  function handleExportCsv() {
    const rows = [
      [
        "product_id",
        "produto",
        "marca",
        "categoria",
        "unidade_base",
        "valor_energetico_kcal_100g",
        "carboidratos_g_100g",
        "acucares_totais_g_100g",
        "acucares_adicionados_g_100g",
        "proteinas_g_100g",
        "gorduras_totais_g_100g",
        "gorduras_saturadas_g_100g",
        "gorduras_trans_g_100g",
        "fibra_alimentar_g_100g",
        "sodio_mg_100g",
        "fonte",
        "observacoes",
      ],
      ...filteredProducts.map((product) => [
        product.productId,
        product.name,
        product.brand ?? "",
        product.category ?? product.sectorCategory ?? "",
        product.defaultUnitLabel ?? "100g/100ml",
        product.nutrition.calories_kcal || "",
        product.nutrition.carbohydrates_g || "",
        product.nutrition.total_sugars_g || "",
        product.nutrition.added_sugars_g || "",
        product.nutrition.proteins_g || "",
        product.nutrition.total_fat_g || "",
        product.nutrition.saturated_fat_g || "",
        product.nutrition.trans_fat_g || "",
        product.nutrition.dietary_fiber_g || "",
        product.nutrition.sodium_mg || "",
        product.source ?? "",
        product.notes ?? "",
      ]),
    ];

    const suffix = statusFilter === "pending" ? "pendentes" : statusFilter === "complete" ? "completos" : "todos";
    downloadCsv(`produtos-nutricao-${suffix}.csv`, rows);
  }

  async function handleImportCsv(file: File | null) {
    if (!file) return;

    try {
      setError("");
      setSuccess("");
      const text = await file.text();
      const rows = parseNutritionCsv(text);

      if (rows.length === 0) {
        setError("Nenhuma linha válida encontrada no CSV.");
        return;
      }

      startImportTransition(async () => {
        try {
          const result = await saveProductNutritionBatch(rows);
          setSuccess(`${result.importedCount} produto(s) importado(s) com sucesso.`);
          await loadProducts();
        } catch (err) {
          console.error(err);
          setError((err as Error)?.message || "Não foi possível importar o CSV.");
        }
      });
    } catch (err) {
      console.error(err);
      setError((err as Error)?.message || "Não foi possível ler o CSV.");
    }
  }

  function handleSave() {
    if (!selectedProduct) return;

    startTransition(async () => {
      try {
        setError("");
        setSuccess("");
        await saveProductNutrition({
          productId: selectedProduct.productId,
          ...form.nutrition,
          source: form.source,
          notes: form.notes,
        });
        setSuccess("Dados nutricionais salvos com sucesso.");
        await loadProducts();
      } catch (err) {
        console.error(err);
        setError((err as Error)?.message || "Não foi possível salvar os dados nutricionais.");
      }
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-sky-50 to-violet-100 p-6 text-slate-950">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/60 bg-white/75 p-6 shadow-xl shadow-slate-900/10 backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-700">
                Tabela Nutricional
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight">
                Cadastro nutricional dos produtos
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                Informe os valores nutricionais por 100 g ou 100 ml dos produtos usados nas fichas técnicas. Esses dados alimentam automaticamente a tabela nutricional das receitas.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <label className="cursor-pointer rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-100">
                {isImporting ? "Importando..." : "Importar CSV"}
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  disabled={isImporting}
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    event.target.value = "";
                    handleImportCsv(file);
                  }}
                />
              </label>
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={filteredProducts.length === 0}
                className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Exportar CSV
              </button>
              <Link
                href="/engenharia/tabela-nutricional"
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                Ver tabelas
              </Link>
              <Link
                href="/engenharia"
                className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5 hover:bg-slate-800"
              >
                Engenharia
              </Link>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="rounded-2xl border border-white/60 bg-white/75 p-6 shadow-lg">
            Carregando produtos...
          </div>
        ) : (
          <section className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 ${statusFilter === "all" ? "border-slate-900 bg-slate-950 text-white" : "border-white/60 bg-white/75"}`}
              >
                <div className="text-xs opacity-75">Produtos</div>
                <div className="mt-1 text-2xl font-black">{metrics.total}</div>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("complete")}
                className={`rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 ${statusFilter === "complete" ? "border-emerald-700 bg-emerald-700 text-white" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}
              >
                <div className="text-xs opacity-75">Com nutrientes</div>
                <div className="mt-1 text-2xl font-black">{metrics.complete}</div>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("pending")}
                className={`rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 ${statusFilter === "pending" ? "border-amber-700 bg-amber-700 text-white" : "border-amber-200 bg-amber-50 text-amber-800"}`}
              >
                <div className="text-xs opacity-75">Pendentes</div>
                <div className="mt-1 text-2xl font-black">{metrics.pending}</div>
              </button>
            </div>

            <div className="rounded-2xl border border-white/60 bg-white/70 p-4 text-xs text-slate-600 shadow-sm">
              Exporte os produtos do filtro atual, preencha os valores e use <strong>Importar CSV</strong> para atualizar até 500 produtos por vez. Clique em um card para editar os nutrientes em pop-up.
            </div>

            {error && !selectedProduct && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            {success && !selectedProduct && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}

            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar produto, marca, categoria ou alergênico..."
              className="w-full rounded-2xl border border-white/70 bg-white/85 px-4 py-3 text-sm shadow-sm outline-none ring-emerald-500 transition focus:ring-2"
            />

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filteredProducts.map((product) => (
                <button
                  key={product.productId}
                  type="button"
                  onClick={() => openProductModal(product.productId)}
                  className={`rounded-2xl border bg-white/75 p-4 text-left shadow-md shadow-slate-900/10 transition hover:-translate-y-1 hover:shadow-lg ${selectedProduct?.productId === product.productId ? "border-emerald-500 ring-2 ring-emerald-300" : "border-white/70"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="font-bold leading-tight">{product.name}</h2>
                      <p className="mt-1 text-xs text-slate-500">
                        {product.brand || "Sem marca"} • {product.category || product.sectorCategory || "Sem categoria"}
                      </p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${product.hasNutrition ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                      {product.hasNutrition ? "OK" : "Pendente"}
                    </span>
                  </div>
                  <p className="mt-3 text-[11px] text-slate-500">
                    {formatDate(product.updatedAt)}
                  </p>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>

      {selectedProduct ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/70 bg-white shadow-2xl shadow-slate-950/30">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 p-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                  Valores por 100 g / 100 ml
                </p>
                <h2 className="mt-2 text-2xl font-black leading-tight">{selectedProduct.name}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedProduct.brand || "Sem marca"} • {selectedProduct.defaultUnitLabel || "Unidade não informada"}
                </p>
              </div>
              <button
                type="button"
                onClick={closeProductModal}
                disabled={isPending}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {selectedProduct.allergens && (
                <p className="mb-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                  <strong>Alergênicos:</strong> {selectedProduct.allergens}
                </p>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                {FIELD_DEFINITIONS.map((field) => (
                  <label key={field.key} className="block rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <span className="text-xs font-semibold text-slate-700">{field.label}</span>
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        step={field.step}
                        value={form.nutrition[field.key]}
                        onChange={(event) => updateNutritionField(field.key, event.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-500 transition focus:ring-2"
                      />
                      <span className="min-w-10 text-xs font-bold text-slate-500">{field.unit}</span>
                    </div>
                  </label>
                ))}
              </div>

              <label className="mt-4 block">
                <span className="text-xs font-semibold text-slate-700">Fonte dos dados</span>
                <input
                  value={form.source}
                  onChange={(event) => setForm((current) => ({ ...current, source: event.target.value }))}
                  placeholder="Ex.: rótulo do fornecedor, TACO, ficha técnica do fabricante..."
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-500 transition focus:ring-2"
                />
              </label>

              <label className="mt-4 block">
                <span className="text-xs font-semibold text-slate-700">Observações</span>
                <textarea
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  rows={4}
                  placeholder="Observações internas sobre arredondamento, fornecedor ou densidade."
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-500 transition focus:ring-2"
                />
              </label>

              {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
              {success && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}
            </div>

            <div className="flex shrink-0 flex-col gap-3 border-t border-slate-100 bg-slate-50 p-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeProductModal}
                disabled={isPending}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isPending}
                className="rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-900/20 transition hover:-translate-y-0.5 hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "Salvando..." : "Salvar dados nutricionais"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
