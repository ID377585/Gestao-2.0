"use client";

import { useMemo, useRef, useState } from "react";

type ImportProductsModalProps = {
  open: boolean;
  onClose: () => void;
};

type ImportResult =
  | {
      ok: true;
      insertedOrUpserted: number;
      updated: number;
      skipped: number;
      totalLines: number;
      establishment_id_used: string;
      delimiter_used?: string;
    }
  | {
      error: string;
      debug?: any;
    };

export default function ImportProductsModal({
  open,
  onClose,
}: ImportProductsModalProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState<any>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const fileLabel = useMemo(() => {
    if (!file) return "Nenhum arquivo escolhido";
    return `${file.name} (${Math.round((file.size / 1024) * 10) / 10} KB)`;
  }, [file]);

  if (!open) return null;

  function resetPicker() {
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setDebug(null);
    setResult(null);

    if (!file) {
      setError("Selecione um arquivo .csv antes de enviar.");
      return;
    }

    try {
      setLoading(true);

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/import/products", {
        method: "POST",
        body: formData,
        headers: {
          Accept: "application/json",
        },
      });

      const data = (await response.json()) as ImportResult;

      if (!response.ok) {
        setError((data as any)?.error || "Erro ao importar produtos.");
        setDebug((data as any)?.debug ?? null);
        return;
      }

      setResult(data);

      // fecha e recarrega lista (mais garantido que redirect)
      // se preferir, pode trocar por window.location.href = ...
      setTimeout(() => {
        onClose();
        window.location.reload();
      }, 700);
    } catch (err: any) {
      setError(err?.message ?? "Erro inesperado ao importar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Importar planilha de produtos</h2>
          <button
            onClick={() => {
              resetPicker();
              setError(null);
              setDebug(null);
              setResult(null);
              onClose();
            }}
            className="text-gray-500 hover:text-gray-700"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <p className="mb-4 text-sm text-gray-600">
          Envie um arquivo <strong>.csv</strong> com os produtos.
          <br />
          No Excel (Mac), escolha <strong>“CSV UTF-8 (Delimitado por Vírgulas) (.csv)”</strong>.
          <br />
          Dica: use o modelo exportado em <strong>Exportar → produtos.csv</strong>.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <input
              ref={inputRef}
              type="file"
              accept=".csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full rounded border border-gray-300 p-2 text-sm"
              disabled={loading}
            />
            <div className="text-xs text-gray-500">{fileLabel}</div>
          </div>

          {error && (
            <div className="rounded bg-red-100 p-2 text-sm text-red-700">
              {error}
              {debug ? (
                <pre className="mt-2 max-h-40 overflow-auto rounded bg-red-50 p-2 text-xs text-red-800">
{JSON.stringify(debug, null, 2)}
                </pre>
              ) : null}
            </div>
          )}

          {result && (result as any).ok && (
            <div className="rounded bg-green-50 p-2 text-sm text-green-800">
              <div className="font-semibold">Importação concluída ✅</div>
              <div className="mt-1 text-xs">
                Inseridos/atualizados (SKU/sem SKU):{" "}
                <strong>{(result as any).insertedOrUpserted}</strong>
                <br />
                Atualizados por ID: <strong>{(result as any).updated}</strong>
                <br />
                Ignorados (sem nome): <strong>{(result as any).skipped}</strong>
                <br />
                Linhas no arquivo: <strong>{(result as any).totalLines}</strong>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                resetPicker();
                setError(null);
                setDebug(null);
                setResult(null);
              }}
              disabled={loading}
              className="rounded border px-4 py-2 text-sm"
            >
              Limpar
            </button>

            <button
              type="button"
              onClick={() => {
                resetPicker();
                setError(null);
                setDebug(null);
                setResult(null);
                onClose();
              }}
              disabled={loading}
              className="rounded border px-4 py-2 text-sm"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={loading}
              className="rounded bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-60"
            >
              {loading ? "Processando..." : "Enviar e processar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
