"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { importTechnicalSheetsFromPdfAction } from "@/app/(dashboard)/dashboard/fichas-tecnicas/pdf-import-actions";

const MAX_FILE_SIZE = 40 * 1024 * 1024; // 40 MB

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess?: (jobId?: string) => void;
  establishmentId: string;
  uploadedBy?: string;
};

export default function PdfImportModal({
  open,
  onClose,
  onSuccess,
}: Props) {
  const [category, setCategory] = useState("Importado PDF");
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) {
      resetState();
    }
  }, [open]);

  if (!open) return null;

  function resetState() {
    setCategory("Importado PDF");
    setFile(null);
    setUploadProgress(0);
    setLoading(false);
    setMessage("");
  }

  function handleClose() {
    if (loading) return;
    resetState();
    onClose();
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setMessage("");

    if (!selected) {
      setFile(null);
      return;
    }

    const isPdf =
      selected.type === "application/pdf" ||
      selected.name.toLowerCase().endsWith(".pdf");

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

  async function handleUpload() {
    if (!file) {
      setMessage("Selecione um PDF para importar.");
      return;
    }

    try {
      setLoading(true);
      setUploadProgress(15);
      setMessage("Lendo PDF e preparando validação...");

      const formData = new FormData();
      formData.append("file", file);
      formData.append("defaultCategory", category);

      setUploadProgress(45);
      setMessage("Analisando tabelas, escalas e campos obrigatórios...");

      const result = await importTechnicalSheetsFromPdfAction(formData);

      if (!result || typeof result.ok !== "boolean") {
        throw new Error(
          "O servidor não retornou uma resposta válida para a importação do PDF."
        );
      }

      if (!result.ok) {
        throw new Error(result.error || "Erro ao importar o PDF.");
      }

      setUploadProgress(100);

      const createdList = result.recipes
        .slice(0, 20)
        .map((item) => `• ${item.name}${item.page ? ` (página ${item.page})` : ""}`)
        .join("\n");

      const ignoredList = result.ignoredPages
        .slice(0, 30)
        .map((item) => `• Página ${item.page}: ${item.title} (${item.reason})`)
        .join("\n");

      const hasBlockedPages = result.ignoredPages.length > 0;
      const reportMessage =
        `Validação concluída.\n\n` +
        `Fichas criadas: ${result.importedCount}\n` +
        `Páginas bloqueadas para revisão: ${result.ignoredPages.length}\n\n` +
        (createdList ? `Receitas importadas:\n${createdList}\n\n` : "") +
        (ignoredList ? `Páginas bloqueadas:\n${ignoredList}\n\n` : "") +
        (hasBlockedPages
          ? "As páginas bloqueadas NÃO foram criadas. Revise os motivos acima antes de tentar importar novamente."
          : "Nenhuma página foi bloqueada nesta importação.");

      setMessage(reportMessage);
      onSuccess?.();
    } catch (error: any) {
      console.error("Erro na importação do PDF:", error);
      setMessage(error?.message || "Falha ao importar o PDF.");
      setUploadProgress(0);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">Importar Ficha Técnica</h2>
            <p className="text-sm text-gray-500">
              Envie um PDF de até 40 MB. O sistema só cria fichas quando a
              tabela passa pelas validações de segurança.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="text-sm text-gray-500 hover:text-gray-800"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Categoria padrão
            </label>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={loading}
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
              disabled={loading}
              className="block w-full text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">Limite máximo: 40 MB</p>
          </div>

          {file && (
            <div className="rounded-lg border bg-gray-50 p-3 text-sm">
              <p>
                <strong>Arquivo:</strong> {file.name}
              </p>
              <p>
                <strong>Tamanho:</strong> {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          )}

          {loading && (
            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span>Processo de validação e importação</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-gray-200">
                <div
                  className="h-2 rounded-full bg-green-600 transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {message && (
            <div className="max-h-96 overflow-auto whitespace-pre-line rounded-lg border px-3 py-2 text-sm">
              {message}
            </div>
          )}

          <div className="rounded-md bg-slate-50 p-3 text-sm text-muted-foreground">
            O importador bloqueia páginas com escala matemática incoerente,
            peso líquido divergente, ingredientes sem quantidade ou modo de
            preparo ausente. Isso evita criar fichas técnicas com campos
            trocados ou dados incompletos.
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="rounded-lg border px-4 py-2 text-sm"
            >
              Fechar
            </button>

            <button
              type="button"
              onClick={handleUpload}
              disabled={loading || !file}
              className="rounded-lg bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {loading ? "Validando..." : "Importar PDF"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
