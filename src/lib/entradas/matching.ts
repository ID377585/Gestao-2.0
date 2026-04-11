import { Produto, XmlItemImportado } from './types';
import { normalizeText } from './utils';

function similarity(a: string, b: string): number {
  const aa = normalizeText(a);
  const bb = normalizeText(b);

  if (!aa || !bb) return 0;
  if (aa === bb) return 1;

  const aWords = new Set(aa.split(' ').filter(Boolean));
  const bWords = new Set(bb.split(' ').filter(Boolean));

  const intersection = [...aWords].filter((word) => bWords.has(word)).length;
  const union = new Set([...aWords, ...bWords]).size;

  return union === 0 ? 0 : intersection / union;
}

export function matchItemToProduto(
  item: XmlItemImportado,
  produtos: Produto[],
): XmlItemImportado {
  if (item.ean) {
    const byEan = produtos.find((p) => p.ean && p.ean === item.ean);

    if (byEan) {
      return {
        ...item,
        produtoId: byEan.id || null,
        skuVinculado: byEan.sku,
        categoriaVinculada: byEan.categoria,
        matchScore: 1,
        matchMode: 'ean',
        precisaVinculacaoManual: false,
      };
    }
  }

  if (item.cProd) {
    const byCodigoFornecedor = produtos.find(
      (p) => p.codigoFornecedor && p.codigoFornecedor === item.cProd,
    );

    if (byCodigoFornecedor) {
      return {
        ...item,
        produtoId: byCodigoFornecedor.id || null,
        skuVinculado: byCodigoFornecedor.sku,
        categoriaVinculada: byCodigoFornecedor.categoria,
        matchScore: 0.95,
        matchMode: 'codigo_fornecedor',
        precisaVinculacaoManual: false,
      };
    }
  }

  let best: Produto | null = null;
  let bestScore = 0;

  for (const produto of produtos) {
    const score = similarity(item.xProd, produto.nome);

    if (score > bestScore) {
      best = produto;
      bestScore = score;
    }
  }

  if (best && bestScore >= 0.6) {
    return {
      ...item,
      produtoId: best.id || null,
      skuVinculado: best.sku,
      categoriaVinculada: best.categoria,
      matchScore: Number(bestScore.toFixed(2)),
      matchMode: 'nome',
      precisaVinculacaoManual: false,
    };
  }

  return {
    ...item,
    produtoId: null,
    skuVinculado: null,
    categoriaVinculada: null,
    matchScore: Number(bestScore.toFixed(2)),
    matchMode: 'nenhum',
    precisaVinculacaoManual: true,
  };
}

export function processarMatchingEntrada(
  itens: XmlItemImportado[],
  produtos: Produto[],
): XmlItemImportado[] {
  return itens.map((item) => matchItemToProduto(item, produtos));
}