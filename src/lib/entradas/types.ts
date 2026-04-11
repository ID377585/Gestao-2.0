export type EntradaStatus =
  | 'rascunho'
  | 'pendente_vinculacao'
  | 'aguardando_aprovacao_1'
  | 'aguardando_aprovacao_2'
  | 'aprovada'
  | 'rejeitada'
  | 'lancada_estoque';

export interface FornecedorData {
  cnpj?: string;
  razaoSocial?: string;
  nomeFantasia?: string;
}

export interface XmlItemImportado {
  itemId: string;
  cProd?: string;
  xProd: string;
  ean?: string;
  ncm?: string;
  cfop?: string;
  unidade?: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  produtoId?: string | null;
  skuVinculado?: string | null;
  categoriaVinculada?: string | null;
  matchScore?: number;
  matchMode?: 'ean' | 'codigo_fornecedor' | 'nome' | 'manual' | 'nenhum';
  precisaVinculacaoManual?: boolean;
}

export interface EntradaDocumento {
  id?: string;
  origem: 'xml' | 'pdf_danfe';
  chaveAcesso?: string;
  numeroNota?: string;
  serie?: string;
  dataEmissao?: string;
  fornecedor: FornecedorData;
  itens: XmlItemImportado[];
  valorProdutos?: number;
  valorNota?: number;
  status: EntradaStatus;
  etapaAprovacao1?: {
    aprovado: boolean;
    aprovadoPor?: string;
    aprovadoEm?: string;
    observacao?: string;
  };
  etapaAprovacao2?: {
    aprovado: boolean;
    aprovadoPor?: string;
    aprovadoEm?: string;
    observacao?: string;
  };
  criadoEm: string;
  atualizadoEm: string;
}

export interface Produto {
  id?: string;
  nome: string;
  sku: string;
  codigoInterno?: string;
  codigoFornecedor?: string;
  ean?: string;
  categoria: string;
  unidade: string;
  estoqueAtual: number;
  custoMedioAtual: number;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface MovimentoEstoque {
  id?: string;
  produtoId: string;
  sku: string;
  tipo: 'entrada';
  quantidade: number;
  custoUnitario: number;
  custoTotal: number;
  referenciaEntradaId: string;
  dataMovimento: string;
  criadoEm: string;
}

export interface HistoricoCustoProduto {
  id?: string;
  produtoId: string;
  sku: string;
  data: string;
  custoUnitario: number;
  quantidadeEntrada: number;
  entradaId: string;
}

export interface RelatorioCategoriaSkuRow {
  categoria: string;
  sku: string;
  produtoNome: string;
  quantidadeEntrada: number;
  valorTotalEntrada: number;
  custoMedioPeriodo: number;
}