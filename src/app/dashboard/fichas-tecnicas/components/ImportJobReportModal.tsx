"use client";

import { useEffect, useState } from "react";

type ImportJob = {
  id: string;
  file_name: string;
  status: string;
  total_pages: number;
  detected_recipes: number;
  created_recipes: number;
  errors: string[];
  created_at: string;
  updated_at: string;
};

type ImportJobPage = {
  id: string;
  page_number: number;
  title: string | null;
  classification: string;
  status: string;
  technical_sheet_id: string | null;
  error_message: string | null;
  parsed_data: {
    name?: string;
    ingredients?: Array<{
      ingredient_name: string;
      usage_quantity: number;
      usage_unit: string;
    }>;
  } | null;
};

type Props = {
  open: boolean;
  jobId: string | null;
  onClose: () => void;
};

export default function ImportJobReportModal({
  open,
  jobId,
  onClose,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [job, setJob] = useState<ImportJob | null>(null);
  const [pages, setPages] = useState<ImportJobPage[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !jobId) return;

    let cancelled = false;

    async function loadReport() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(`/api/import-jobs/${jobId}`);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result?.error || "Erro ao carregar relatório.");
        }

        if (!cancelled) {
          setJob(result.job ?? null);
          setPages(Array.isArray(result.pages) ? result.pages : []);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Erro ao carregar relatório.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadReport();

    return () => {
      cancelled = true;
    };
  }, [open, jobId]);

  if (!open) return null;

  const createdPages = pages.filter((page) => page.status === "created");
  const ignoredPages = pages.filter(
    (page) => page.status === "ignored" || page.status === "review"
  );
  const erroredPages = pages.filter((page) => page.status === "error");

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b p-5">
          <div>
            <h2 className="text-xl font-semibold">Relatório da Importação</h2>
            <p className="text-sm text-gray-500">
              Detalhes da leitura e criação das fichas por página.
            </p>
          </div>

          <button
            onClick={onClose}
            className="text-sm text-gray-500 hover:text-gray-800"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[calc(90vh-80px)] overflow-y-auto p-5">
          {loading ? (
            <div className="rounded-lg border p-4 text-sm">
              Carregando relatório...
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          ) : (
            <div className="space-y-6">
              {job && (
                <div className="grid gap-4 md:grid-cols-5">
                  <div className="rounded-lg border p-4">
                    <p className="text-xs text-gray-500">Arquivo</p>
                    <p className="mt-1 text-sm font-medium break-words">
                      {job.file_name}
                    </p>
                  </div>

                  <div className="rounded-lg border p-4">
                    <p className="text-xs text-gray-500">Status</p>
                    <p className="mt-1 text-sm font-medium">{job.status}</p>
                  </div>

                  <div className="rounded-lg border p-4">
                    <p className="text-xs text-gray-500">Páginas lidas</p>
                    <p className="mt-1 text-sm font-medium">{job.total_pages}</p>
                  </div>

                  <div className="rounded-lg border p-4">
                    <p className="text-xs text-gray-500">Receitas detectadas</p>
                    <p className="mt-1 text-sm font-medium">
                      {job.detected_recipes}
                    </p>
                  </div>

                  <div className="rounded-lg border p-4">
                    <p className="text-xs text-gray-500">Fichas criadas</p>
                    <p className="mt-1 text-sm font-medium">
                      {job.created_recipes}
                    </p>
                  </div>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border bg-green-50 p-4">
                  <p className="text-xs text-green-700">Criadas</p>
                  <p className="mt-1 text-lg font-semibold text-green-800">
                    {createdPages.length}
                  </p>
                </div>

                <div className="rounded-lg border bg-yellow-50 p-4">
                  <p className="text-xs text-yellow-700">Ignoradas / revisão</p>
                  <p className="mt-1 text-lg font-semibold text-yellow-800">
                    {ignoredPages.length}
                  </p>
                </div>

                <div className="rounded-lg border bg-red-50 p-4">
                  <p className="text-xs text-red-700">Com erro</p>
                  <p className="mt-1 text-lg font-semibold text-red-800">
                    {erroredPages.length}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="border-b px-3 py-2 text-left">Página</th>
                      <th className="border-b px-3 py-2 text-left">Título</th>
                      <th className="border-b px-3 py-2 text-left">Classificação</th>
                      <th className="border-b px-3 py-2 text-left">Status</th>
                      <th className="border-b px-3 py-2 text-left">Ingredientes</th>
                      <th className="border-b px-3 py-2 text-left">Erro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pages.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-3 py-4 text-center text-gray-500"
                        >
                          Nenhuma página encontrada para este relatório.
                        </td>
                      </tr>
                    ) : (
                      pages.map((page) => {
                        const ingredientsCount = Array.isArray(
                          page.parsed_data?.ingredients
                        )
                          ? page.parsed_data?.ingredients.length
                          : 0;

                        return (
                          <tr key={page.id}>
                            <td className="border-b px-3 py-2">
                              {page.page_number}
                            </td>
                            <td className="border-b px-3 py-2">
                              {page.title || "Sem título"}
                            </td>
                            <td className="border-b px-3 py-2">
                              {page.classification}
                            </td>
                            <td className="border-b px-3 py-2">
                              {page.status}
                            </td>
                            <td className="border-b px-3 py-2">
                              {ingredientsCount}
                            </td>
                            <td className="border-b px-3 py-2 text-red-700">
                              {page.error_message || "—"}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {job?.errors?.length ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <p className="mb-2 text-sm font-medium text-red-800">
                    Erros gerais do job
                  </p>
                  <ul className="space-y-1 text-sm text-red-700">
                    {job.errors.map((item, index) => (
                      <li key={`${item}-${index}`}>• {item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}