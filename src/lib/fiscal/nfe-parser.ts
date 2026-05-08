import { XMLParser } from "fast-xml-parser";

export type ParsedNfeProductItem = {
  code: string;
  description: string;
  ean: string | null;
  ncm: string | null;
  cfop: string | null;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
};

export type ParsedNfeXml = {
  supplierName: string;
  supplierDocument: string | null;
  invoiceNumber: string;
  invoiceSeries: string | null;
  invoiceKey: string | null;
  issueDate: string;
  totalAmount: number;
  items: ParsedNfeProductItem[];
};

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function toNumber(value: unknown, fallback = 0) {
  const n = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

function normalizeDate(value: unknown) {
  const raw = String(value ?? "").trim();
  return raw ? raw.slice(0, 10) : "";
}

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

export function parseNfeXml(xmlContent: string): ParsedNfeXml {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    removeNSPrefix: true,
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: true,
  });

  const parsed = parser.parse(xmlContent);
  const nfeProc = parsed?.nfeProc ?? parsed;
  const nfe = nfeProc?.NFe ?? nfeProc?.NFeProc?.NFe ?? parsed?.NFe;
  const infNFe = nfe?.infNFe ?? parsed?.infNFe;

  if (!infNFe) {
    throw new Error("Não foi encontrada a estrutura infNFe no XML da NF-e.");
  }

  const ide = infNFe.ide ?? {};
  const emit = infNFe.emit ?? {};
  const total = infNFe.total?.ICMSTot ?? {};

  const rawKey = cleanText(infNFe["@_Id"]);
  const invoiceKey = rawKey.replace(/^NFe/i, "") || null;

  const items = asArray(infNFe.det).map((det): ParsedNfeProductItem => {
    const prod = det?.prod ?? {};
    const quantity = toNumber(prod.qCom, 0);
    const unitCost = toNumber(prod.vUnCom, 0);
    const totalCost = toNumber(prod.vProd, quantity * unitCost);

    return {
      code: cleanText(prod.cProd),
      description: cleanText(prod.xProd),
      ean: cleanText(prod.cEAN) || null,
      ncm: cleanText(prod.NCM) || null,
      cfop: cleanText(prod.CFOP) || null,
      quantity,
      unit: cleanText(prod.uCom) || "UN",
      unitCost,
      totalCost,
    };
  });

  return {
    supplierName: cleanText(emit.xNome),
    supplierDocument: cleanText(emit.CNPJ || emit.CPF) || null,
    invoiceNumber: cleanText(ide.nNF),
    invoiceSeries: cleanText(ide.serie) || null,
    invoiceKey,
    issueDate: normalizeDate(ide.dhEmi || ide.dEmi),
    totalAmount: toNumber(total.vNF, 0),
    items: items.filter((item) => item.description || item.code),
  };
}
