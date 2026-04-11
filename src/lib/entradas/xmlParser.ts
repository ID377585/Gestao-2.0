import { EntradaDocumento, XmlItemImportado } from './types';
import { nowIso, parseNumber } from './utils';

function getTagText(parent: Element | Document, tagName: string): string {
  const el = parent.getElementsByTagName(tagName)?.[0];
  return el?.textContent?.trim() || '';
}

export async function parseXmlNfeFile(file: File): Promise<EntradaDocumento> {
  const xmlText = await file.text();
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, 'application/xml');

  const infNFe = xml.getElementsByTagName('infNFe')[0];
  const ide = xml.getElementsByTagName('ide')[0];
  const emit = xml.getElementsByTagName('emit')[0];
  const total = xml.getElementsByTagName('ICMSTot')[0];

  const detNodes = Array.from(xml.getElementsByTagName('det'));

  const itens: XmlItemImportado[] = detNodes.map((det, index) => {
    const prod = det.getElementsByTagName('prod')[0];
    const quantidade = parseNumber(getTagText(prod, 'qCom'));
    const valorUnitario = parseNumber(getTagText(prod, 'vUnCom'));
    const valorTotal = parseNumber(getTagText(prod, 'vProd'));

    return {
      itemId: `${index + 1}`,
      cProd: getTagText(prod, 'cProd'),
      xProd: getTagText(prod, 'xProd'),
      ean: getTagText(prod, 'cEAN') || getTagText(prod, 'cEANTrib'),
      ncm: getTagText(prod, 'NCM'),
      cfop: getTagText(prod, 'CFOP'),
      unidade: getTagText(prod, 'uCom'),
      quantidade,
      valorUnitario,
      valorTotal,
      produtoId: null,
      skuVinculado: null,
      categoriaVinculada: null,
      matchScore: 0,
      matchMode: 'nenhum',
      precisaVinculacaoManual: true,
    };
  });

  const chaveAcesso = infNFe?.getAttribute('Id')?.replace('NFe', '') || '';
  const createdAt = nowIso();

  return {
    origem: 'xml',
    chaveAcesso,
    numeroNota: getTagText(ide, 'nNF'),
    serie: getTagText(ide, 'serie'),
    dataEmissao: getTagText(ide, 'dhEmi') || getTagText(ide, 'dEmi'),
    fornecedor: {
      cnpj: getTagText(emit, 'CNPJ'),
      razaoSocial: getTagText(emit, 'xNome'),
      nomeFantasia: getTagText(emit, 'xFant'),
    },
    itens,
    valorProdutos: parseNumber(getTagText(total, 'vProd')),
    valorNota: parseNumber(getTagText(total, 'vNF')),
    status: 'pendente_vinculacao',
    criadoEm: createdAt,
    atualizadoEm: createdAt,
  };
}

export async function parseXmlBatch(files: File[]): Promise<EntradaDocumento[]> {
  const docs: EntradaDocumento[] = [];
  for (const file of files) {
    if (file.name.toLowerCase().endsWith('.xml')) {
      const parsed = await parseXmlNfeFile(file);
      docs.push(parsed);
    }
  }
  return docs;
}