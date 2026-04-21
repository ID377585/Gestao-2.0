"use client";

import { useState } from "react";
import { uploadTechnicalSheetPdfImportAction } from "@/app/(dashboard)/dashboard/fichas-tecnicas/actions";

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
  establishmentId,
  uploadedBy,
}: Props) {
  const [category, setCategory] = useState("Importado PDF");
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

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

  function sanitizeFileName(fileName: string) {
    return fileName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .replace(/-+/g, "-");
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setMessage("");

    if (!selected) {
      setFile(null);
      return;
    }

    if (selected.type !== "application/pdf") {
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

    if (!establishmentId) {
      setMessage("EstablishmentId não informado para a importação.");
      return;
    }

    try {
      setLoading(true);
      setMessage("Enviando PDF para o storage...");
      setUploadProgress(10);

      const uploadFormData = new FormData();
uploadFormData.append("file", file);

const uploadResult = await uploadTechnicalSheetPdfImportAction(uploadFormData);

if (!uploadResult?.filePath || !uploadResult?.downloadURL) {
  throw new Error("O upload do PDF não retornou filePath e downloadURL.");
}

const filePath = uploadResult.filePath;
const downloadURL = uploadResult.downloadURL;

setUploadProgress(40);
setMessage("PDF enviado. Obtendo URL do arquivo...");

      setUploadProgress(55);
      setMessage("Criando job de importação...");

      const createResponse = await fetch("/api/import-jobs/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: file.name,
          fileUrl: downloadURL,
          filePath,
          fileSize: file.size,
          mimeType: file.type,
          category,
          establishmentId,
          uploadedBy: uploadedBy || null,
        }),
      });

      const createResult = await createResponse.json();

      if (!createResponse.ok) {
        throw new Error(
          createResult?.error || "Erro ao criar job de importação."
        );
      }

      if (!createResult?.jobId) {
        throw new Error("O job de importação foi criado sem retornar jobId.");
      }

      setUploadProgress(70);
      setMessage("Processando PDF e analisando páginas...");

      const processResponse = await fetch("/api/import-jobs/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobId: createResult.jobId,
        }),
      });

      const processResult = await processResponse.json();

      if (!processResponse.ok) {
        throw new Error(
          processResult?.error || "Erro ao processar o PDF importado."
        );
      }

      setUploadProgress(100);

      const totalPages = processResult?.totalPages ?? 0;
      const detectedRecipes = processResult?.detectedRecipes ?? 0;
      const createdRecipes = processResult?.createdRecipes ?? 0;
      const errors = Array.isArray(processResult?.errors)
        ? processResult.errors
        : [];
      const createdPages = Array.isArray(processResult?.createdPages)
        ? processResult.createdPages
        : [];
      const ignoredPages = Array.isArray(processResult?.ignoredPages)
        ? processResult.ignoredPages
        : [];

      const createdList = createdPages
        .slice(0, 8)
        .map((item: any) => `• Página ${item.pageNumber}: ${item.title}`)
        .join("\n");

      const ignoredList = ignoredPages
        .slice(0, 8)
        .map(
          (item: any) =>
            `• Página ${item.pageNumber}: ${item.title || "Sem título"} (${item.reason})`
        )
        .join("\n");

      const reportMessage =
        `Importação concluída.\n\n` +
        `Páginas lidas: ${totalPages}\n` +
        `Receitas detectadas: ${detectedRecipes}\n` +
        `Fichas criadas: ${createdRecipes}\n` +
        `Páginas ignoradas/revisão: ${ignoredPages.length}\n` +
        `Erros: ${errors.length}\n\n` +
        (createdList ? `Criadas:\n${createdList}\n\n` : "") +
        (ignoredList ? `Ignoradas/Revisão:\n${ignoredList}` : "");

      setMessage(reportMessage);

      onSuccess?.(createResult.jobId);

      setTimeout(() => {
        handleClose();
      }, 3500);
    } catch (error: any) {
      console.error(error);
      setMessage(
        error?.message || "Falha ao enviar o PDF e processar a importação."
      );
      setUploadProgress(0);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">Importar Ficha Técnica</h2>
            <p className="text-sm text-gray-500">
              Envie um PDF de até 40 MB para importar várias fichas de uma vez.
            </p>
          </div>
          <button
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
              accept="application/pdf"
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
                <strong>Tamanho:</strong>{" "}
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          )}

          {loading && (
            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span>Processo de importação</span>
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
            <div className="whitespace-pre-line rounded-lg border px-3 py-2 text-sm">
              {message}
            </div>
          )}

          <div className="rounded-md bg-slate-50 p-3 text-sm text-muted-foreground">
            Nesta etapa, o sistema já salva relatório por página, extrai
            ingredientes para análise, preenche campos técnicos básicos e mostra
            quais páginas foram criadas e quais foram ignoradas.
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={handleClose}
              disabled={loading}
              className="rounded-lg border px-4 py-2 text-sm"
            >
              Cancelar
            </button>
            <button
              onClick={handleUpload}
              disabled={loading || !file}
              className="rounded-lg bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {loading ? "Processando..." : "Importar PDF"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}