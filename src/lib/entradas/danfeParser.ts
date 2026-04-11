import { EntradaDocumento } from './types';
import { nowIso } from './utils';

/**
 * Estrutura pronta para plugar OCR real.
 * Você pode integrar depois com:
 * - pdfjs-dist
 * - tesseract.js
 * - API externa de OCR
 */
export async function parseDanfePdfAssistido(file: File): Promise<EntradaDocumento> {
  const createdAt = nowIso();

  return {
    origem: 'pdf_danfe',
    chaveAcesso: '',
    numeroNota: '',
    serie: '',
    dataEmissao: '',
    fornecedor: {
      cnpj: '',
      razaoSocial: file.name,
      nomeFantasia: '',
    },
    itens: [],
    valorProdutos: 0,
    valorNota: 0,
    status: 'rascunho',
    criadoEm: createdAt,
    atualizadoEm: createdAt,
  };
}