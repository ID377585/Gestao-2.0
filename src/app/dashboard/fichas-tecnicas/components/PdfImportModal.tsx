"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import {
  createTechnicalSheetsFromPreviewAction,
  previewTechnicalSheetsFromPdfAction,
} from "@/app/(dashboard)/dashboard/fichas-tecnicas/pdf-import-actions";

const MAX_FILE_SIZE = 40 * 1024 * 1024; // 40 MB

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess?: (jobId?: string) => void;
  establishmentId: string;
  uploadedBy?: string;
};

type PreviewIngredient = {
  product_id?: string | null;
  ingredient_name: string;
  usage_quantity: number;
  usage_unit: string;
  purchase_price?: number;
  purchase_quantity?: number;
  purchase_unit?: string;
  correction_factor?: number;
  cooking_factor?: number;
  base_unit_cost?: number;
  final_cost?: number;
  sort_order?: number;
};

type PreviewScaleIngredient = {
  ingredient_name: string;
  amount: number;
  unit: string;
  sort_order?: number;
};

type PreviewScale = {
  scale_label: string;
  yield_description?: string | null;
  net_weight: number | null;
  sort_order?: number;
  ingredients?: PreviewScaleIngredient[];
};

type PreviewRecipe = {
  name: string;
  category: string;
  yield_portions?: number;
  portion_weight?: number;
  prep_time_minutes?: number;
  profit_margin_percent?: number;
  sale_price?: number;
  total_cost?: number;
  cost_per_portion?: number;
  preparation_method: string;
  ingredients?: PreviewIngredient[];
  scales?: PreviewScale[];
  source_page_number?: number | null;
  import_origin?: string | null;
  source_file_name?: string | null;
  [key: string]: any;
};

type PreviewPage = {
  page: number;
  title: string;
  status: "ready" | "blocked";
  reason: string | null;
  originalReason?: string | null;
  warnings: string[];
  recipe: PreviewRecipe | null;
  selected: boolean;
};

function asNumber(value: unknown, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function blankIngredient(index = 0): PreviewIngredient {
  return {
    product_id: null,
    ingredient_name: "",
    usage_quantity: 0,
    usage_unit: "G",
    purchase_price: 0,
    purchase_quantity: 1,
    purchase_unit: "G",
    correction_factor: 1,
    cooking_factor: 1,
    base_unit_cost: 0,
    final_cost: 0,
    sort_order: index,
  };
}

function blankScale(index = 0): PreviewScale {
  return {
    scale_label: `${index + 1}X`,
    yield_description: null,
    net_weight: null,
    sort_order: index,
    ingredients: [],
  };
}

function buildDraftRecipe(page: Pick<PreviewPage, "page" | "title">, category: string): PreviewRecipe {
  return {
    name: page.title && page.title !== "Receita importada" ? page.title : `Ficha página ${page.page}`,
    category: category || "Importado PDF",
    yield_portions: 1,
    portion_weight: 0,
    prep_time_minutes: 0,
    profit_margin_percent: 0,
    sale_price: 0,
    total_cost: 0,
    cost_per_portion: 0,
    preparation_method: "",
    difficulty_level: null,
    temperature_celsius: null,
    cooking_time_minutes: null,
    cooking_factor_grams: null,
    correction_factor_grams: null,
    yield_label: null,
    portion_weight_unit: "G",
    storage_instructions: null,
    shelf_life_frozen: null,
    shelf_life_refrigerated: null,
    shelf_life_room_temp: null,
    allergens: null,
    source_updated_at: null,
    import_origin: "pdf_import_reviewed",
    source_file_name: null,
    source_page_number: page.page,
    video_url: null,
    ingredients: [blankIngredient(0)],
    scales: [blankScale(0)],
  };
}

function getRecipeErrors(recipe: PreviewRecipe | null) {
  const errors: string[] = [];
  if (!recipe) {
    errors.push("Revise e preencha os dados da ficha.");
    return errors;
  }

  if (!recipe.name?.trim()) errors.push("Nome da ficha é obrigatório.");
  if (!recipe.category?.trim()) errors.push("Categoria é obrigatória.");
  if (!recipe.preparation_method?.trim() || recipe.preparation_method.trim().length < 20) {
    errors.push("Modo de preparo precisa ter pelo menos 20 caracteres.");
  }

  const ingredients = recipe.ingredients ?? [];
  if (ingredients.length < 1) errors.push("Inclua pelo menos 1 ingrediente.");
  ingredients.forEach((ingredient, index) => {
    if (!ingredient.ingredient_name?.trim()) errors.push(`Ingrediente ${index + 1} está sem nome.`);
    if (!Number.isFinite(Number(ingredient.usage_quantity)) || Number(ingredient.usage_quantity) < 0) {
      errors.push(`Ingrediente ${ingredient.ingredient_name || index + 1} tem quantidade inválida.`);
    }
    if (!ingredient.usage_unit?.trim()) errors.push(`Ingrediente ${ingredient.ingredient_name || index + 1} está sem unidade.`);
  });

  const scales = recipe.scales ?? [];
  if (scales.length < 1) errors.push("Inclua pelo menos 1 escala.");
  scales.forEach((scale, index) => {
    if (!scale.scale_label?.trim()) errors.push(`Escala ${index + 1} está sem nome.`);
    if (scale.net_weight !== null && scale.net_weight !== undefined && !Number.isFinite(Number(scale.net_weight))) {
      errors.push(`Escala ${scale.scale_label || index + 1} tem peso líquido inválido.`);
    }
  });

  return errors;
}

function syncScaleIngredients(recipe: PreviewRecipe): PreviewRecipe {
  const ingredients = (recipe.ingredients ?? []).map((ingredient, index) => ({
    ...blankIngredient(index),
    ...ingredient,
    usage_quantity: asNumber(ingredient.usage_quantity, 0),
    sort_order: index,
  }));

  const scales = (recipe.scales?.length ? recipe.scales : [blankScale(0)]).map((scale, scaleIndex) => {
    const existingScaleIngredients = scale.ingredients ?? [];
    return {
      ...scale,
      scale_label: scale.scale_label || `${scaleIndex + 1}X`,
      net_weight:
        scale.net_weight === null || scale.net_weight === undefined || scale.net_weight === ""
          ? null
          : asNumber(scale.net_weight, 0),
      sort_order: scaleIndex,
      ingredients: ingredients.map((ingredient, ingredientIndex) => {
        const existing = existingScaleIngredients.find(
          (item) => item.ingredient_name === ingredient.ingredient_name
        );
        return {
          ingredient_name: ingredient.ingredient_name,
          amount: asNumber(existing?.amount ?? ingredient.usage_quantity, 0),
          unit: existing?.unit || ingredient.usage_unit || "G",
          sort_order: ingredientIndex,
        };
      }),
    };
  });

  return {
    ...recipe,
    yield_portions: asNumber(recipe.yield_portions, 1) || 1,
    portion_weight: asNumber(recipe.portion_weight, 0),
    prep_time_minutes: asNumber(recipe.prep_time_minutes, 0),
    profit_margin_percent: asNumber(recipe.profit_margin_percent, 0),
    sale_price: asNumber(recipe.sale_price, 0),
    total_cost: asNumber(recipe.total_cost, 0),
    cost_per_portion: asNumber(recipe.cost_per_portion, 0),
    ingredients,
    scales,
  };
}

function normalizePageAfterEdit(page: PreviewPage): PreviewPage {
  const recipe = page.recipe ? syncScaleIngredients(page.recipe) : null;
  const errors = getRecipeErrors(recipe);
  const status = errors.length === 0 ? "ready" : "blocked";
  return {
    ...page,
    recipe,
    status,
    reason: status === "ready" ? null : errors.slice(0, 5).join(" | "),
    selected: status === "ready" ? page.selected : false,
  };
}

export default function PdfImportModal({ open, onClose, onSuccess }: Props) {
  const [category, setCategory] = useState("Importado PDF");
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [previewPages, setPreviewPages] = useState<PreviewPage[]>([]);
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");

  const readyCount = useMemo(
    () => previewPages.filter((page) => page.status === "ready").length,
    [previewPages]
  );
  const blockedCount = useMemo(
    () => previewPages.filter((page) => page.status === "blocked").length,
    [previewPages]
  );
  const selectedCount = useMemo(
    () => previewPages.filter((page) => page.status === "ready" && page.selected).length,
    [previewPages]
  );

  useEffect(() => {
    if (!open) resetState();
  }, [open]);

  if (!open) return null;

  function resetState() {
    setCategory("Importado PDF");
    setFile(null);
    setUploadProgress(0);
    setLoading(false);
    setMessage("");
    setPreviewPages([]);
    setStep("upload");
  }

  function handleClose() {
    if (loading) return;
    resetState();
    onClose();
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setMessage("");
    setPreviewPages([]);
    setStep("upload");

    if (!selected) {
      setFile(null);
      return;
    }

    const isPdf = selected.type === "application/pdf" || selected.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setMessage("Selecione apenas arquivos PDF.");
      setFile(null);
      return;
    }

    if (selected.size > MAX_FILE_SIZE) {
      setMessage("O arquivo excede 40 MB. Envie um PDF de até 40 MB.");
      setFile(null);
      return;
    }

    setFile(selected);
  }

  async function handlePreview() {
    if (!file) {
      setMessage("Selecione um PDF para analisar.");
      return;
    }

    try {
      setLoading(true);
      setUploadProgress(20);
      setMessage("Lendo PDF e montando pré-visualização...");

      const formData = new FormData();
      formData.append("file", file);
      formData.append("defaultCategory", category);

      setUploadProgress(65);
      const result = await previewTechnicalSheetsFromPdfAction(formData);

      if (!result || typeof result.ok !== "boolean") {
        throw new Error("O servidor não retornou uma resposta válida para a análise do PDF.");
      }
      if (!result.ok) throw new Error(result.error || "Erro ao analisar o PDF.");

      const pages = result.pages.map((page) => {
        const originalReason = page.reason ?? null;
        const recipe = page.recipe ?? buildDraftRecipe(page, category);
        return normalizePageAfterEdit({
          ...page,
          originalReason,
          recipe,
          selected: page.status === "ready",
        } as PreviewPage);
      });

      setPreviewPages(pages);
      setStep("preview");
      setUploadProgress(100);
      setMessage(
        `Pré-visualização concluída.\n\n` +
          `Fichas prontas para criar: ${pages.filter((page) => page.status === "ready").length}\n` +
          `Páginas bloqueadas para revisão: ${pages.filter((page) => page.status === "blocked").length}\n\n` +
          `As páginas bloqueadas agora podem ser corrigidas nesta tela. Quando os erros forem resolvidos, elas ficam prontas para seleção.`
      );
    } catch (error: any) {
      console.error("Erro na análise do PDF:", error);
      setMessage(
        error?.message ||
          "Falha ao analisar o PDF. Se isso ocorrer somente na versão publicada, faça um novo deploy para aplicar as configurações do servidor."
      );
      setUploadProgress(0);
    } finally {
      setLoading(false);
    }
  }

  function updatePageRecipe(pageNumber: number, updater: (recipe: PreviewRecipe) => PreviewRecipe) {
    setPreviewPages((pages) =>
      pages.map((page) => {
        if (page.page !== pageNumber) return page;
        const currentRecipe = page.recipe ?? buildDraftRecipe(page, category);
        return normalizePageAfterEdit({
          ...page,
          recipe: updater(currentRecipe),
          selected: page.selected,
        });
      })
    );
  }

  function updatePreviewRecipe(pageNumber: number, patch: Partial<PreviewRecipe>) {
    updatePageRecipe(pageNumber, (recipe) => ({ ...recipe, ...patch }));
  }

  function updateIngredient(pageNumber: number, index: number, patch: Partial<PreviewIngredient>) {
    updatePageRecipe(pageNumber, (recipe) => {
      const ingredients = [...(recipe.ingredients ?? [])];
      ingredients[index] = { ...blankIngredient(index), ...ingredients[index], ...patch, sort_order: index };
      return { ...recipe, ingredients };
    });
  }

  function addIngredient(pageNumber: number) {
    updatePageRecipe(pageNumber, (recipe) => ({
      ...recipe,
      ingredients: [...(recipe.ingredients ?? []), blankIngredient(recipe.ingredients?.length ?? 0)],
    }));
  }

  function removeIngredient(pageNumber: number, index: number) {
    updatePageRecipe(pageNumber, (recipe) => ({
      ...recipe,
      ingredients: (recipe.ingredients ?? []).filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  function updateScale(pageNumber: number, index: number, patch: Partial<PreviewScale>) {
    updatePageRecipe(pageNumber, (recipe) => {
      const scales = [...(recipe.scales ?? [])];
      scales[index] = { ...blankScale(index), ...scales[index], ...patch, sort_order: index };
      return { ...recipe, scales };
    });
  }

  function addScale(pageNumber: number) {
    updatePageRecipe(pageNumber, (recipe) => ({
      ...recipe,
      scales: [...(recipe.scales ?? []), blankScale(recipe.scales?.length ?? 0)],
    }));
  }

  function removeScale(pageNumber: number, index: number) {
    updatePageRecipe(pageNumber, (recipe) => ({
      ...recipe,
      scales: (recipe.scales ?? []).filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  function togglePage(pageNumber: number) {
    setPreviewPages((pages) =>
      pages.map((page) =>
        page.page === pageNumber && page.status === "ready"
          ? { ...page, selected: !page.selected }
          : page
      )
    );
  }

  async function handleCreateSelected() {
    const recipes = previewPages
      .map(normalizePageAfterEdit)
      .filter((page) => page.status === "ready" && page.selected && page.recipe)
      .map((page) => syncScaleIngredients(page.recipe as PreviewRecipe));

    if (recipes.length === 0) {
      setMessage("Nenhuma ficha pronta foi selecionada para criação.");
      return;
    }

    try {
      setLoading(true);
      setUploadProgress(35);
      setMessage("Criando fichas selecionadas...");

      const formData = new FormData();
      formData.append("recipes", JSON.stringify(recipes));

      const result = await createTechnicalSheetsFromPreviewAction(formData);

      if (!result || typeof result.ok !== "boolean") {
        throw new Error("O servidor não retornou uma resposta válida para a criação das fichas.");
      }
      if (!result.ok) throw new Error(result.error || "Erro ao criar fichas selecionadas.");

      setUploadProgress(100);
      setStep("done");

      const createdList = result.recipes
        .slice(0, 30)
        .map((item) => `• ${item.name}${item.page ? ` (página ${item.page})` : ""}`)
        .join("\n");
      const ignoredList = result.ignoredPages
        .slice(0, 30)
        .map((item) => `• Página ${item.page ?? "?"}: ${item.title} (${item.reason})`)
        .join("\n");

      setMessage(
        `Criação concluída.\n\n` +
          `Fichas criadas: ${result.importedCount}\n` +
          `Fichas selecionadas que não foram criadas: ${result.ignoredPages.length}\n\n` +
          (createdList ? `Receitas criadas:\n${createdList}\n\n` : "") +
          (ignoredList ? `Não criadas:\n${ignoredList}\n\n` : "") +
          `As fichas corrigidas na revisão também puderam ser importadas quando ficaram prontas.`
      );
      onSuccess?.();
    } catch (error: any) {
      console.error("Erro ao criar fichas selecionadas:", error);
      setMessage(error?.message || "Falha ao criar fichas selecionadas.");
      setUploadProgress(0);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="max-h-[92vh] w-full max-w-6xl overflow-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Importar Ficha Técnica</h2>
            <p className="text-sm text-gray-500">
              Analise o PDF, revise a pré-visualização, corrija páginas bloqueadas e crie apenas as fichas selecionadas.
            </p>
          </div>

          <button type="button" onClick={handleClose} disabled={loading} className="text-sm text-gray-500 hover:text-gray-800">
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[1fr_1.4fr]">
            <div>
              <label className="mb-1 block text-sm font-medium">Categoria padrão</label>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={loading || step !== "upload"}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                placeholder="Importado PDF"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">PDF</label>
              <input
                type="file"
                accept="application/pdf,.pdf"
                onChange={handleFileChange}
                disabled={loading || step !== "upload"}
                className="block w-full text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">Limite máximo: 40 MB</p>
            </div>
          </div>

          {file && (
            <div className="rounded-lg border bg-gray-50 p-3 text-sm">
              <p><strong>Arquivo:</strong> {file.name}</p>
              <p><strong>Tamanho:</strong> {(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          )}

          {loading && (
            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span>{step === "preview" ? "Criação das fichas" : "Validação do PDF"}</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-gray-200">
                <div className="h-2 rounded-full bg-green-600 transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          )}

          {message && (
            <div className="max-h-64 overflow-auto whitespace-pre-line rounded-lg border px-3 py-2 text-sm">
              {message}
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border p-3 text-sm"><strong>{readyCount}</strong><br />prontas para criar</div>
                <div className="rounded-lg border p-3 text-sm"><strong>{blockedCount}</strong><br />bloqueadas para revisão</div>
                <div className="rounded-lg border p-3 text-sm"><strong>{selectedCount}</strong><br />selecionadas</div>
              </div>

              {previewPages.map((page) => (
                <div key={page.page} className="rounded-xl border p-4 text-sm">
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">Página {page.page}: {page.title}</p>
                      <p className={page.status === "ready" ? "text-green-700" : "text-red-700"}>
                        {page.status === "ready" ? "Pronta para criação" : `Bloqueada: ${page.reason}`}
                      </p>
                      {page.originalReason && page.originalReason !== page.reason && (
                        <p className="text-xs text-gray-500">Erro original: {page.originalReason}</p>
                      )}
                      {page.warnings.length > 0 && (
                        <p className="text-amber-700">Avisos: {page.warnings.join(" | ")}</p>
                      )}
                    </div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={page.selected}
                        onChange={() => togglePage(page.page)}
                        disabled={loading || page.status !== "ready"}
                      />
                      Criar esta ficha
                    </label>
                  </div>

                  {page.recipe && (
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block font-medium">Nome da ficha</label>
                        <input
                          value={page.recipe.name}
                          onChange={(e) => updatePreviewRecipe(page.page, { name: e.target.value })}
                          disabled={loading}
                          className="w-full rounded-lg border px-3 py-2 outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block font-medium">Categoria</label>
                        <input
                          value={page.recipe.category}
                          onChange={(e) => updatePreviewRecipe(page.page, { category: e.target.value })}
                          disabled={loading}
                          className="w-full rounded-lg border px-3 py-2 outline-none"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="mb-1 block font-medium">Modo de preparo</label>
                        <textarea
                          value={page.recipe.preparation_method}
                          onChange={(e) => updatePreviewRecipe(page.page, { preparation_method: e.target.value })}
                          disabled={loading}
                          className="h-24 w-full rounded-lg border px-3 py-2 outline-none"
                        />
                      </div>

                      <div className="rounded-lg bg-slate-50 p-3 md:col-span-2">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <strong>Ingredientes</strong>
                          <button type="button" onClick={() => addIngredient(page.page)} disabled={loading} className="rounded border px-2 py-1 text-xs">
                            + Ingrediente
                          </button>
                        </div>
                        <div className="space-y-2">
                          {(page.recipe.ingredients ?? []).map((ingredient, index) => (
                            <div key={`${page.page}-ingredient-${index}`} className="grid gap-2 md:grid-cols-[1fr_120px_90px_auto]">
                              <input
                                value={ingredient.ingredient_name}
                                onChange={(e) => updateIngredient(page.page, index, { ingredient_name: e.target.value })}
                                disabled={loading}
                                className="rounded-lg border px-3 py-2 outline-none"
                                placeholder="Ingrediente"
                              />
                              <input
                                type="number"
                                value={ingredient.usage_quantity}
                                onChange={(e) => updateIngredient(page.page, index, { usage_quantity: asNumber(e.target.value, 0) })}
                                disabled={loading}
                                className="rounded-lg border px-3 py-2 outline-none"
                                placeholder="Qtd."
                              />
                              <input
                                value={ingredient.usage_unit}
                                onChange={(e) => updateIngredient(page.page, index, { usage_unit: e.target.value.toUpperCase(), purchase_unit: e.target.value.toUpperCase() })}
                                disabled={loading}
                                className="rounded-lg border px-3 py-2 outline-none"
                                placeholder="Un."
                              />
                              <button type="button" onClick={() => removeIngredient(page.page, index)} disabled={loading} className="rounded border px-2 py-1 text-xs">
                                Remover
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-lg bg-slate-50 p-3 md:col-span-2">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <strong>Escalas</strong>
                          <button type="button" onClick={() => addScale(page.page)} disabled={loading} className="rounded border px-2 py-1 text-xs">
                            + Escala
                          </button>
                        </div>
                        <div className="space-y-2">
                          {(page.recipe.scales ?? []).map((scale, index) => (
                            <div key={`${page.page}-scale-${index}`} className="grid gap-2 md:grid-cols-[140px_160px_1fr_auto]">
                              <input
                                value={scale.scale_label}
                                onChange={(e) => updateScale(page.page, index, { scale_label: e.target.value })}
                                disabled={loading}
                                className="rounded-lg border px-3 py-2 outline-none"
                                placeholder="1X"
                              />
                              <input
                                type="number"
                                value={scale.net_weight ?? ""}
                                onChange={(e) => updateScale(page.page, index, { net_weight: e.target.value === "" ? null : asNumber(e.target.value, 0) })}
                                disabled={loading}
                                className="rounded-lg border px-3 py-2 outline-none"
                                placeholder="Peso líquido"
                              />
                              <input
                                value={scale.yield_description ?? ""}
                                onChange={(e) => updateScale(page.page, index, { yield_description: e.target.value || null })}
                                disabled={loading}
                                className="rounded-lg border px-3 py-2 outline-none"
                                placeholder="Rendimento/descrição"
                              />
                              <button type="button" onClick={() => removeScale(page.page, index)} disabled={loading} className="rounded border px-2 py-1 text-xs">
                                Remover
                              </button>
                            </div>
                          ))}
                        </div>
                        <p className="mt-2 text-xs text-gray-500">
                          Ao criar, os ingredientes das escalas são sincronizados com a lista corrigida acima.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="rounded-md bg-slate-50 p-3 text-sm text-muted-foreground">
            Agora o fluxo permite corrigir páginas bloqueadas na própria importação. Depois que nome, preparo, ingredientes e escalas estiverem válidos, a página muda para pronta e pode ser selecionada para criação.
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button type="button" onClick={handleClose} disabled={loading} className="rounded-lg border px-4 py-2 text-sm">
              Fechar
            </button>
            {step === "upload" && (
              <button
                type="button"
                onClick={handlePreview}
                disabled={loading || !file}
                className="rounded-lg bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                {loading ? "Analisando..." : "Analisar PDF"}
              </button>
            )}
            {step === "preview" && (
              <>
                <button
                  type="button"
                  onClick={() => setStep("upload")}
                  disabled={loading}
                  className="rounded-lg border px-4 py-2 text-sm"
                >
                  Trocar PDF
                </button>
                <button
                  type="button"
                  onClick={handleCreateSelected}
                  disabled={loading || selectedCount === 0}
                  className="rounded-lg bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
                >
                  {loading ? "Criando..." : "Criar fichas selecionadas"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
