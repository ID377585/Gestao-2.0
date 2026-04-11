'use client';

import { useState } from 'react';
import { parseDanfePdfAssistido } from '@/lib/entradas/danfeParser';

export default function PdfDanfeAssistido() {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [status, setStatus] = useState('');

  async function processar() {
    if (!arquivo) return;
    setStatus('Lendo DANFE/PDF...');
    await parseDanfePdfAssistido(arquivo);
    setStatus('Leitura assistida concluída. Agora você pode revisar e complementar os campos.');
  }

  return (
    <div className="rounded-2xl border p-4 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold">Leitura assistida de DANFE/PDF</h2>
      <input
        type="file"
        accept="application/pdf"
        onChange={(e) => setArquivo(e.target.files?.[0] || null)}
        className="mb-3 block w-full"
      />
      <button
        type="button"
        onClick={processar}
        disabled={!arquivo}
        className="rounded-xl bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        Ler PDF
      </button>
      {status && <p className="mt-3 text-sm text-gray-600">{status}</p>}
    </div>
  );
}