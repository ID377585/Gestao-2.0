import https from "node:https";
import { gunzipSync } from "node:zlib";
import axios from "axios";
import { XMLParser } from "fast-xml-parser";

export type SefazAmbiente = "homologacao" | "producao";

export type SefazDocZip = {
  nsu: string;
  schema: string;
  xml: string;
};

export type SefazDistribuicaoDfeResult = {
  cStat: string;
  xMotivo: string;
  ultNSU: string;
  maxNSU: string;
  docs: SefazDocZip[];
  rawResponse: string;
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
});

export function getSefazDistributionEndpoint(ambiente: SefazAmbiente) {
  if (ambiente === "producao") {
    return "https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx";
  }

  return "https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx";
}

export function getTpAmb(ambiente: SefazAmbiente) {
  return ambiente === "producao" ? "1" : "2";
}

function onlyDigits(value: string) {
  return String(value ?? "").replace(/\D/g, "");
}

function padNsu(value: string) {
  return onlyDigits(value || "0").padStart(15, "0").slice(-15);
}

function buildDistDFeXml(params: {
  ambiente: SefazAmbiente;
  ufCode: string;
  cnpj: string;
  ultimoNsu: string;
}) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">
  <tpAmb>${getTpAmb(params.ambiente)}</tpAmb>
  <cUFAutor>${onlyDigits(params.ufCode)}</cUFAutor>
  <CNPJ>${onlyDigits(params.cnpj)}</CNPJ>
  <distNSU>
    <ultNSU>${padNsu(params.ultimoNsu)}</ultNSU>
  </distNSU>
</distDFeInt>`.trim();
}

function buildSoapEnvelope(nfeDadosMsg: string) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">
      <nfeDadosMsg>${nfeDadosMsg}</nfeDadosMsg>
    </nfeDistDFeInteresse>
  </soap12:Body>
</soap12:Envelope>`.trim();
}

function findRetDistDFeInt(parsed: any) {
  return (
    parsed?.Envelope?.Body?.nfeDistDFeInteresseResponse?.nfeDistDFeInteresseResult?.retDistDFeInt ??
    parsed?.Envelope?.Body?.nfeDistDFeInteresseResponse?.nfeDistDFeInteresseResult ??
    parsed?.retDistDFeInt ??
    null
  );
}

function decodeDocZip(docZip: any): SefazDocZip {
  const base64 = typeof docZip === "string" ? docZip : String(docZip?.["#text"] ?? "");
  const compressed = Buffer.from(base64, "base64");
  const xml = gunzipSync(compressed).toString("utf-8");

  return {
    nsu: String(docZip?.["@_NSU"] ?? ""),
    schema: String(docZip?.["@_schema"] ?? ""),
    xml,
  };
}

export async function consultarDistribuicaoDfe(params: {
  ambiente: SefazAmbiente;
  ufCode: string;
  cnpj: string;
  ultimoNsu: string;
  pfxBuffer: Buffer;
  passphrase: string;
  timeoutMs?: number;
}): Promise<SefazDistribuicaoDfeResult> {
  const endpoint = getSefazDistributionEndpoint(params.ambiente);
  const nfeDadosMsg = buildDistDFeXml(params);
  const soapEnvelope = buildSoapEnvelope(nfeDadosMsg);

  const httpsAgent = new https.Agent({
    pfx: params.pfxBuffer,
    passphrase: params.passphrase,
    rejectUnauthorized: true,
  });

  const response = await axios.post(endpoint, soapEnvelope, {
    httpsAgent,
    timeout: params.timeoutMs ?? 45000,
    headers: {
      "Content-Type": "application/soap+xml; charset=utf-8; action=\"http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse\"",
    },
  });

  const rawResponse = String(response.data ?? "");
  const parsed = parser.parse(rawResponse);
  const retDist = findRetDistDFeInt(parsed);

  if (!retDist) {
    throw new Error("A resposta da SEFAZ não possui retDistDFeInt.");
  }

  const rawDocs = retDist?.loteDistDFeInt?.docZip;
  const docs = (Array.isArray(rawDocs) ? rawDocs : rawDocs ? [rawDocs] : []).map(decodeDocZip);

  return {
    cStat: String(retDist.cStat ?? ""),
    xMotivo: String(retDist.xMotivo ?? ""),
    ultNSU: padNsu(String(retDist.ultNSU ?? params.ultimoNsu)),
    maxNSU: padNsu(String(retDist.maxNSU ?? retDist.ultNSU ?? params.ultimoNsu)),
    docs,
    rawResponse,
  };
}

export function parseDistributedDocument(xml: string) {
  return parser.parse(xml);
}
