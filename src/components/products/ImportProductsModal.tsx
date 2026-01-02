"use client";

import { useState } from "react";

type ImportProductsModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function ImportProductsModal({
  open,
  onClose,
}: ImportProductsModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!file) {
      setError("Selecione um arquivo .csv ou .xlsx antes de enviar.");
      return;
    }

    try {
      setLoading(true);

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/import/products", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.error || "Erro ao importar produtos.");
      }

      // sucesso → redireciona
      window.location.href = "/dashboard/produtos?success=import";
    } catch (err: any) {
      setError(err.message ?? "Erro inesperado ao importar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Importar planilha de produtos
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <p className="mb-4 text-sm text-gray-600">
          Envie um arquivo <strong>.csv</strong> ou <strong>.xlsx</strong> com os
          produtos.  
          Use o modelo exportado em <strong>Exportar → produtos.csv</strong>.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="file"
            accept=".csv,.xlsx"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full rounded border border-gray-300 p-2 text-sm"
          />

          {error && (
            <div className="rounded bg-red-100 p-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
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
