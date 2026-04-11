'use client';

import { Produto, XmlItemImportado } from '@/lib/entradas/types';

interface Props {
  item: XmlItemImportado;
  produtos: Produto[];
  onVincular: (produto: Produto) => void;
}

export default function VinculacaoManualModal({ item, produtos, onVincular }: Props) {
  const sugestoes = produtos
    .filter((p) =>
      p.nome.toLowerCase().includes(item.xProd.toLowerCase().slice(0, 5)) ||
      item.xProd.toLowerCase().includes(p.nome.toLowerCase().slice(0, 5)),
    )
    .slice(0, 10);

  return (
    <div className="rounded-2xl border p-4">
      <h3 className="text-lg font-semibold">Vinculação manual</h3>
      <p className="mt-2 text-sm text-gray-600">Item: {item.xProd}</p>

      <div className="mt-4 space-y-2">
        {sugestoes.map((produto) => (
          <button
            key={produto.id}
            type="button"
            onClick={() => onVincular(produto)}
            className="block w-full rounded-xl border px-3 py-2 text-left hover:bg-gray-50"
          >
            <div className="font-medium">{produto.nome}</div>
            <div className="text-xs text-gray-500">
              SKU: {produto.sku} | Categoria: {produto.categoria}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}