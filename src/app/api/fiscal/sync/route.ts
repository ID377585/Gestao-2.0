import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { consultarDistribuicaoDfe, parseDistributedDocument, type SefazAmbiente } from "@/lib/fiscal/sefaz-distribuicao-dfe";
import { parseNfeXml } from "@/lib/fiscal/nfe-parser";
import forge from "node-forge";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CERTIFICATE_BUCKET = "fiscal-certificates";
const NFE_XML_BUCKET = "fiscal-nfe-xmls";

type FiscalNsuControlRow = {
  id: string;
  ultimo_nsu: string | null;
};

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY para usar o scheduler fiscal.");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function decryptPassword(encryptedPassword: string) {
  try {
    return forge.util.decode64(encryptedPassword);
  } catch {
    return encryptedPassword;
  }
}

function sanitizeFileName(fileName: string) {
  return fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

function toNumber(value: unknown, fallback = 0) {
  const n = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

function extractNfeSummaryFromDistributedXml(xml: string) {
  const parsed = parseDistributedDocument(xml);
  const procNFe = parsed?.procNFe;
  const nfe = procNFe?.NFe ?? parsed?.NFe;
  const infNFe = nfe?.infNFe;
  const resNFe = parsed?.resNFe;

  if (infNFe) {
    const parsedNfe = parseNfeXml(xml);
    return {
      chave: parsedNfe.invoiceKey,
      numero: parsedNfe.invoiceNumber,
      serie: parsedNfe.invoiceSeries,
      fornecedorNome: parsedNfe.supplierName,
      fornecedorCnpj: parsedNfe.supplierDocument,
      valorTotal: parsedNfe.totalAmount,
      dataEmissao: parsedNfe.issueDate,
      isFullXml: true,
    };
  }

  if (resNFe) {
    return {
      chave: String(resNFe.chNFe ?? "") || null,
      numero: null,
      serie: null,
      fornecedorNome: String(resNFe.xNome ?? "") || null,
      fornecedorCnpj: String(resNFe.CNPJ ?? resNFe.CPF ?? "") || null,
      valorTotal: toNumber(resNFe.vNF, 0),
      dataEmissao: String(resNFe.dhEmi ?? "").slice(0, 10) || null,
      isFullXml: false,
    };
  }

  return null;
}

function isAuthorized(request: NextRequest) {
  const configuredSecret = process.env.FISCAL_SYNC_SECRET;

  if (!configuredSecret) {
    return false;
  }

  const headerSecret = request.headers.get("x-fiscal-sync-secret");
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const querySecret = request.nextUrl.searchParams.get("secret");

  return [headerSecret, bearer, querySecret].some((value) => value === configuredSecret);
}

async function syncEstablishment(params: {
  supabase: ReturnType<typeof createClient>;
  certificate: any;
}) {
  const { supabase, certificate } = params;
  const establishmentId = String(certificate.establishment_id);

  const { data: certificateFile, error: certificateDownloadError } = await supabase.storage
    .from(CERTIFICATE_BUCKET)
    .download(String(certificate.certificate_path));

  if (certificateDownloadError || !certificateFile) {
    throw new Error(`Não foi possível ler o certificado do estabelecimento ${establishmentId}.`);
  }

  const { data: nsuControlData } = await supabase
    .from("fiscal_nsu_control")
    .select("id, ultimo_nsu")
    .eq("establishment_id", establishmentId)
    .maybeSingle();

  const nsuControl = nsuControlData as FiscalNsuControlRow | null;
  let nsuControlId = nsuControl?.id;
  const ultimoNsu = String(nsuControl?.ultimo_nsu ?? "000000000000000");

  if (!nsuControlId) {
    const { data: createdControl, error: createdControlError } = await supabase
      .from("fiscal_nsu_control")
      .insert({
        establishment_id: establishmentId,
        ultimo_nsu: ultimoNsu,
      })
      .select("id")
      .single();

    if (createdControlError || !createdControl) {
      throw new Error(`Não foi possível criar controle de NSU para ${establishmentId}.`);
    }

    nsuControlId = String((createdControl as { id: string }).id);
  }

  const result = await consultarDistribuicaoDfe({
    ambiente: (process.env.SEFAZ_AMBIENTE || "homologacao") as SefazAmbiente,
    ufCode: process.env.SEFAZ_UF || "35",
    cnpj: String(certificate.cnpj),
    ultimoNsu,
    pfxBuffer: Buffer.from(await certificateFile.arrayBuffer()),
    passphrase: decryptPassword(String(certificate.encrypted_password)),
  });

  let imported = 0;
  let ignored = 0;

  for (const doc of result.docs) {
    const summary = extractNfeSummaryFromDistributedXml(doc.xml);

    if (!summary?.chave) {
      ignored += 1;
      continue;
    }

    const safeSchema = sanitizeFileName(doc.schema || "doczip.xml");
    const xmlPath = `${establishmentId}/sefaz/${summary.chave}-${doc.nsu || Date.now()}-${safeSchema}`;

    const { error: uploadError } = await supabase.storage
      .from(NFE_XML_BUCKET)
      .upload(xmlPath, new Blob([doc.xml], { type: "application/xml" }), {
        cacheControl: "3600",
        upsert: true,
        contentType: "application/xml",
      });

    if (uploadError) {
      ignored += 1;
      continue;
    }

    const { error: upsertError } = await supabase
      .from("fiscal_nfe_inbox")
      .upsert(
        {
          establishment_id: establishmentId,
          nsu: doc.nsu || null,
          chave_acesso: summary.chave,
          numero: summary.numero || null,
          serie: summary.serie || null,
          fornecedor_nome: summary.fornecedorNome || null,
          fornecedor_cnpj: summary.fornecedorCnpj || null,
          valor_total: summary.valorTotal || null,
          data_emissao: summary.dataEmissao || null,
          status_manifestacao: summary.isFullXml ? "xml_completo" : "resumo_disponivel",
          xml_path: xmlPath,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "establishment_id,chave_acesso",
        }
      );

    if (upsertError) {
      ignored += 1;
      continue;
    }

    imported += 1;
  }

  const { error: updateNsuError } = await supabase
    .from("fiscal_nsu_control")
    .update({
      ultimo_nsu: result.ultNSU,
      updated_at: new Date().toISOString(),
    })
    .eq("id", nsuControlId);

  if (updateNsuError) {
    throw new Error(`Consulta feita, mas falhou ao atualizar NSU de ${establishmentId}.`);
  }

  return {
    establishmentId,
    cStat: result.cStat,
    xMotivo: result.xMotivo,
    ultNSU: result.ultNSU,
    maxNSU: result.maxNSU,
    received: result.docs.length,
    imported,
    ignored,
  };
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const supabase = getAdminSupabase();
  const establishmentId = request.nextUrl.searchParams.get("establishment_id");

  let query = supabase
    .from("fiscal_certificates")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (establishmentId) {
    query = query.eq("establishment_id", establishmentId);
  }

  const { data: certificates, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const uniqueByEstablishment = new Map<string, any>();

  for (const certificate of certificates ?? []) {
    const key = String(certificate.establishment_id);
    if (!uniqueByEstablishment.has(key)) {
      uniqueByEstablishment.set(key, certificate);
    }
  }

  const results = [];
  const errors = [];

  for (const certificate of uniqueByEstablishment.values()) {
    try {
      results.push(await syncEstablishment({ supabase, certificate }));
    } catch (error: any) {
      errors.push({
        establishmentId: String(certificate.establishment_id),
        error: error?.message || "Erro desconhecido na sincronização fiscal.",
      });
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    processed: results.length,
    failed: errors.length,
    results,
    errors,
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
