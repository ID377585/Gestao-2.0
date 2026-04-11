import { EntradaDocumento, Produto, RelatorioCategoriaSkuRow } from './types';

export function gerarRelatorioCategoriaSku(
  entradas: EntradaDocumento[],
  produtos: Produto[],
): RelatorioCategoriaSkuRow[] {
  const map = new Map<string, RelatorioCategoriaSkuRow>();

  for (const entrada of entradas) {
    if (!['aprovada', 'lancada_estoque'].includes(entrada.status)) continue;

    for (const item of entrada.itens) {
      if (!item.produtoId) continue;
      const produto = produtos.find((p) => p.id === item.produtoId);
      if (!produto) continue;

      const key = `${produto.categoria}__${produto.sku}`;
      const atual = map.get(key);

      const quantidade = item.quantidade;
      const valorTotal = item.valorTotal;
      const custoMedioItem = quantidade > 0 ? valorTotal / quantidade : 0;

      if (!atual) {
        map.set(key, {
          categoria: produto.categoria,
          sku: produto.sku,
          produtoNome: produto.nome,
          quantidadeEntrada: quantidade,
          valorTotalEntrada: valorTotal,
          custoMedioPeriodo: custoMedioItem,
        });
      } else {
        const novaQuantidade = atual.quantidadeEntrada + quantidade;
        const novoValor = atual.valorTotalEntrada + valorTotal;
        map.set(key, {
          ...atual,
          quantidadeEntrada: novaQuantidade,
          valorTotalEntrada: novoValor,
          custoMedioPeriodo: novaQuantidade > 0 ? novoValor / novaQuantidade : 0,
        });
      }
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.categoria.localeCompare(b.categoria),
  );
}