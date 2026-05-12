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

type PreviewRecipe = {
  name: string;
  category: string;
  preparation_method: string;
  ingredients?: Array<{ ingredient_name: string; usage_quantity: number; usage_unit: string }>;
  scales?: Array<{ scale_label: string; net_weight: number | null }>;
  source_page_number?: number | null;
  [key: string]: any;
};

type PreviewPage = {
  page: number;
  title: string;
  status: "ready" | "blocked";
  reason: string | null;
  warnings: string[];
  recipe: PreviewRecipe | null;
  selected: boolean;
};

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

      const pages = result.pages.map((page) => ({
        ...page,
        selected: page.status === "ready",
      })) as PreviewPage[];

      setPreviewPages(pages);
      setStep("preview");
      setUploadProgress(100);
      setMessage(
        `Pré-visualização concluída.\n\n` +
          `Fichas prontas para criar: ${pages.filter((page) => page.status === "ready").length}\n` +
          `Páginas bloqueadas para revisão: ${pages.filter((page) => page.status === "blocked").length}\n\n` +
          `Revise os dados abaixo e clique em “Criar fichas selecionadas” somente quando estiver tudo correto.`
      );
    } catch (error: any) {
      console.error("Erro na análise do PDF:", error);
      setMessage(error?.message || "Falha ao analisar o PDF.");
      setUploadProgress(0);
    } finally {
      setLoading(false);
    }
  }

  function updatePreviewRecipe(pageNumber: number, patch: Partial<PreviewRecipe>) {
    setPreviewPages((pages) =>
      pages.map((page) =>
        page.page === pageNumber && page.recipe
          ? { ...page, recipe: { ...page.recipe, ...patch } }
          : page
      )
    );
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
      .filter((page) => page.status === "ready" && page.selected && page.recipe)
      .map((page) => page.recipe as PreviewRecipe);

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
          `Páginas bloqueadas originalmente: ${blockedCount}\n` +
          `Fichas selecionadas que não foram criadas: ${result.ignoredPages.length}\n\n` +
          (createdList ? `Receitas criadas:\n${createdList}\n\n` : "") +
          (ignoredList ? `Não criadas:\n${ignoredList}\n\n` : "") +
          `As páginas bloqueadas na pré-visualização não foram criadas.`
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
      <div className="max-h-[92vh] w-full max-w-5xl overflow-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Importar Ficha Técnica</h2>
            <p className="text-sm text-gray-500">
              Analise o PDF, revise a pré-visualização e crie apenas as fichas selecionadas.
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
                <div className="rounded-lg border p-3 text-sm"><strong>{blockedCount}</strong><br />bloqueadas</div>
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
                      {page.warnings.length > 0 && (
                        <p className="text-amber-700">Avisos: {page.warnings.join(" | ")}</p>
                      )}
                    </div>
                    {page.status === "ready" && (
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={page.selected} onChange={() => togglePage(page.page)} disabled={loading} />
                        Criar esta ficha
                      </label>
                    )}
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
                      <div className="rounded-lg bg-slate-50 p-3">
                        <strong>Ingredientes:</strong> {page.recipe.ingredients?.length ?? 0}
                        <div className="mt-2 max-h-24 overflow-auto text-xs">
                          {(page.recipe.ingredients ?? []).slice(0, 8).map((ingredient, index) => (
                            <p key={`${ingredient.ingredient_name}-${index}`}>
                              {ingredient.ingredient_name}: {ingredient.usage_quantity} {ingredient.usage_unit}
                            </p>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3">
                        <strong>Escalas:</strong> {page.recipe.scales?.length ?? 0}
                        <div className="mt-2 max-h-24 overflow-auto text-xs">
                          {(page.recipe.scales ?? []).slice(0, 10).map((scale, index) => (
                            <p key={`${scale.scale_label}-${index}`}>
                              {scale.scale_label}: peso líquido {scale.net_weight ?? "-"}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="rounded-md bg-slate-50 p-3 text-sm text-muted-foreground">
            Agora o fluxo separa análise e criação. Páginas bloqueadas não entram no banco. Páginas prontas podem ser revisadas, desmarcadas ou ter nome, categoria e modo de preparo ajustados antes de criar.
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
