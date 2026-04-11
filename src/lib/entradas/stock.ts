import { nowIso } from './utils';
import {
  atualizarEntrada,
  atualizarProduto,
  registrarHistoricoCusto,
  registrarMovimentoEstoque,
} from './repository';
import { EntradaDocumento, Produto } from './types';

export async function lancarEntradaNoEstoque(
  entrada: EntradaDocumento,
  produtos: Produto[],
): Promise<void> {
  if (!entrada.id) {
    throw new Error('Entrada sem ID.');
  }

  if (entrada.status !== 'aprovada') {
    throw new Error('Apenas entradas aprovadas podem ser lançadas no estoque.');
  }

  for (const item of entrada.itens) {
    if (!item.produtoId) continue;

    const produto = produtos.find((p) => p.id === item.produtoId);
    if (!produto) continue;

    const estoqueAnterior = produto.estoqueAtual || 0;
    const custoAnterior = produto.custoMedioAtual || 0;
    const quantidadeEntrada = item.quantidade || 0;
    const custoEntrada = item.valorUnitario || 0;

    const valorEstoqueAnterior = estoqueAnterior * custoAnterior;
    const valorNovaEntrada = quantidadeEntrada * custoEntrada;
    const novoEstoque = estoqueAnterior + quantidadeEntrada;
    const novoCustoMedio =
      novoEstoque > 0
        ? (valorEstoqueAnterior + valorNovaEntrada) / novoEstoque
        : custoEntrada;

    await atualizarProduto(produto.id!, {
      estoqueAtual: novoEstoque,
      custoMedioAtual: Number(novoCustoMedio.toFixed(4)),
      atualizadoEm: nowIso(),
    });

    await registrarMovimentoEstoque({
      produtoId: produto.id!,
      sku: produto.sku,
      tipo: 'entrada',
      quantidade: quantidadeEntrada,
      custoUnitario: custoEntrada,
      custoTotal: Number((quantidadeEntrada * custoEntrada).toFixed(2)),
      referenciaEntradaId: entrada.id,
      dataMovimento: nowIso(),
      criadoEm: nowIso(),
    });

    await registrarHistoricoCusto({
      produtoId: produto.id!,
      sku: produto.sku,
      data: nowIso(),
      custoUnitario: custoEntrada,
      quantidadeEntrada,
      entradaId: entrada.id,
    });
  }

  await atualizarEntrada(entrada.id, {
    status: 'lancada_estoque',
    atualizadoEm: nowIso(),
  });
}