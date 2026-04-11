'use client';

import { useState } from 'react';

interface Props {
  onUpload: (files: File[]) => Promise<void>;
  loading?: boolean;
}

export default function UploadXmlLote({ onUpload, loading }: Props) {
  const [files, setFiles] = useState<File[]>([]);

  return (
    <div className="rounded-2xl border p-4 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold">Upload em lote de XML</h2>

      <input
        type="file"
        accept=".xml"
        multiple
        onChange={(e) => {
          const selected = Array.from(e.target.files || []);
          setFiles(selected);
        }}
        className="mb-3 block w-full"
      />

      <div className="mb-3 text-sm text-gray-600">
        {files.length} arquivo(s) selecionado(s)
      </div>

      <button
        type="button"
        disabled={loading || files.length === 0}
        onClick={() => onUpload(files)}
        className="rounded-xl bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {loading ? 'Processando...' : 'Importar XMLs'}
      </button>
    </div>
  );
}