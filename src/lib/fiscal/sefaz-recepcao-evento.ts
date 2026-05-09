import https from "node:https";
import axios from "axios";
import forge from "node-forge";
import { XMLParser } from "fast-xml-parser";

export type SefazAmbiente = "homologacao" | "producao";

export type NfeManifestationType =
  | "ciencia_operacao"
  | "confirmacao_operacao"
  | "desconhecimento_operacao"
  | "operacao_nao_realizada";

export const NFE_MANIFESTATION_EVENTS: Record<
  NfeManifestationType,
  { code: string; description: string; requiresJustification: boolean }
> = {
  ciencia_operacao: {
    code: "210210",
    description: "Ciência da Operação",
    requiresJustification: false,
  },
  confirmacao_operacao: {
    code: "210200",
    description: "Confirmação da Operação",
    requiresJustification: false,
  },
  desconhecimento_operacao: {
    code: "210220",
    description: "Desconhecimento da Operação",
    requiresJustification: false,
  },
  operacao_nao_realizada: {
    code: "210240",
    description: "Operação não Realizada",
    requiresJustification: true,
  },
};

export type SendNfeManifestationParams = {
  ambiente: SefazAmbiente;
  ufCode: string;
  cnpj: string;
  chaveAcesso: string;
  manifestationType: NfeManifestationType;
  justification?: string | null;
  pfxBuffer: Buffer;
  passphrase: string;
  sequence?: number;
  timeoutMs?: number;
};

export type SendNfeManifestationResult = {
  cStat: string;
  xMotivo: string;
  eventCode: string;
  eventDescription: string;
  protocol: string | null;
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

export function getSefazEventEndpoint(ambiente: SefazAmbiente) {
  if (ambiente === "producao") {
    return "https://www.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx";
  }

  return "https://hom.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx";
}

function getTpAmb(ambiente: SefazAmbiente) {
  return ambiente === "producao" ? "1" : "2";
}

function onlyDigits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function escapeXml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toIsoWithoutMilliseconds(date = new Date()) {
  return date.toISOString().replace(/\.\d{3}Z$/, "-03:00");
}

function extractPrivateKeyAndCertificatePem(pfxBuffer: Buffer, passphrase: string) {
  const p12Asn1 = forge.asn1.fromDer(pfxBuffer.toString("binary"));
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, passphrase);

  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[
    forge.pki.oids.pkcs8ShroudedKeyBag
  ];
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[
    forge.pki.oids.certBag
  ];

  const privateKey = keyBags?.[0]?.key;
  const certificate = certBags?.[0]?.cert;

  if (!privateKey || !certificate) {
    throw new Error("Não foi possível extrair chave privada/certificado do A1.");
  }

  return {
    privateKeyPem: forge.pki.privateKeyToPem(privateKey),
    certificatePem: forge.pki.certificateToPem(certificate),
  };
}

function buildUnsignedEventXml(params: SendNfeManifestationParams) {
  const event = NFE_MANIFESTATION_EVENTS[params.manifestationType];
  const cnpj = onlyDigits(params.cnpj);
  const chave = onlyDigits(params.chaveAcesso);
  const sequence = String(params.sequence ?? 1).padStart(2, "0");
  const eventId = `ID${event.code}${chave}${sequence}`;

  const justification = params.justification?.trim();

  if (event.requiresJustification && (!justification || justification.length < 15)) {
    throw new Error("Informe uma justificativa com pelo menos 15 caracteres para Operação não Realizada.");
  }

  return {
    eventCode: event.code,
    eventDescription: event.description,
    eventId,
    xml: `<evento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">
  <infEvento Id="${eventId}">
    <cOrgao>${onlyDigits(params.ufCode)}</cOrgao>
    <tpAmb>${getTpAmb(params.ambiente)}</tpAmb>
    <CNPJ>${cnpj}</CNPJ>
    <chNFe>${chave}</chNFe>
    <dhEvento>${toIsoWithoutMilliseconds()}</dhEvento>
    <tpEvento>${event.code}</tpEvento>
    <nSeqEvento>${Number(params.sequence ?? 1)}</nSeqEvento>
    <verEvento>1.00</verEvento>
    <detEvento versao="1.00">
      <descEvento>${event.description}</descEvento>${justification ? `\n      <xJust>${escapeXml(justification)}</xJust>` : ""}
    </detEvento>
  </infEvento>
</evento>`.trim(),
  };
}

async function signEventXml(xml: string, pfxBuffer: Buffer, passphrase: string) {
  const { SignedXml } = await import("xml-crypto");
  const { DOMParser } = await import("@xmldom/xmldom");
  const { privateKeyPem, certificatePem } = extractPrivateKeyAndCertificatePem(pfxBuffer, passphrase);

  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const infEvento = doc.getElementsByTagName("infEvento")[0];
  const id = infEvento?.getAttribute("Id");

  if (!id) {
    throw new Error("Não foi possível identificar o Id do evento para assinatura.");
  }

  const sig = new SignedXml({
    privateKey: privateKeyPem,
    publicCert: certificatePem,
    canonicalizationAlgorithm: "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
    signatureAlgorithm: "http://www.w3.org/2000/09/xmldsig#rsa-sha1",
  });

  sig.addReference({
    xpath: "//*[local-name(.)='infEvento']",
    digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1",
    transforms: [
      "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
      "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
    ],
    uri: `#${id}`,
  });

  sig.computeSignature(xml, {
    location: {
      reference: "//*[local-name(.)='infEvento']",
      action: "after",
    },
  });

  return sig.getSignedXml();
}

function buildLoteEventoXml(signedEventXml: string, loteId: string) {
  return `<envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">
  <idLote>${loteId}</idLote>
  ${signedEventXml}
</envEvento>`.trim();
}

function buildSoapEnvelope(nfeDadosMsg: string) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeRecepcaoEventoNF xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4">
      <nfeDadosMsg>${nfeDadosMsg}</nfeDadosMsg>
    </nfeRecepcaoEventoNF>
  </soap12:Body>
</soap12:Envelope>`.trim();
}

function findRetEvento(parsed: any) {
  const result =
    parsed?.Envelope?.Body?.nfeRecepcaoEventoNFResponse?.nfeRecepcaoEventoNFResult ??
    parsed?.Envelope?.Body?.nfeRecepcaoEventoNFResult ??
    parsed?.retEnvEvento ??
    null;

  const retEnvEvento = result?.retEnvEvento ?? result;
  const retEvento = retEnvEvento?.retEvento;
  return Array.isArray(retEvento) ? retEvento[0] : retEvento;
}

export async function sendNfeManifestationEvent(
  params: SendNfeManifestationParams
): Promise<SendNfeManifestationResult> {
  const event = NFE_MANIFESTATION_EVENTS[params.manifestationType];
  const endpoint = getSefazEventEndpoint(params.ambiente);
  const unsignedEvent = buildUnsignedEventXml(params);
  const signedEventXml = await signEventXml(unsignedEvent.xml, params.pfxBuffer, params.passphrase);
  const loteXml = buildLoteEventoXml(signedEventXml, String(Date.now()).slice(-15));
  const soapEnvelope = buildSoapEnvelope(loteXml);

  const httpsAgent = new https.Agent({
    pfx: params.pfxBuffer,
    passphrase: params.passphrase,
    rejectUnauthorized: true,
  });

  const response = await axios.post(endpoint, soapEnvelope, {
    httpsAgent,
    timeout: params.timeoutMs ?? 45000,
    headers: {
      "Content-Type": "application/soap+xml; charset=utf-8; action=\"http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4/nfeRecepcaoEventoNF\"",
    },
  });

  const rawResponse = String(response.data ?? "");
  const parsed = parser.parse(rawResponse);
  const retEvento = findRetEvento(parsed);
  const infEvento = retEvento?.infEvento ?? retEvento;

  return {
    cStat: String(infEvento?.cStat ?? ""),
    xMotivo: String(infEvento?.xMotivo ?? ""),
    eventCode: event.code,
    eventDescription: event.description,
    protocol: infEvento?.nProt ? String(infEvento.nProt) : null,
    rawResponse,
  };
}
