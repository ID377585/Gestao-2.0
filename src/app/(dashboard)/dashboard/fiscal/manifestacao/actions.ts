"use server";

import forge from "node-forge";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";
import {
  sendNfeManifestationEvent,
  type NfeManifestationType,
  type SefazAmbiente,
} from "@/lib/fiscal/sefaz-recepcao-evento";

const CERTIFICATE_BUCKET = "fiscal-certificates";

function decryptPassword(encryptedPassword: string) {
  try {
    return forge.util.decode64(encryptedPassword);
  } catch {
    return encryptedPassword;
  }
}

async function getContext() {
  const supabase = await createSupabaseServerClient();
  const { membership } = await getActiveMembershipOrRedirect();
  const establishmentId = (membership as any)?.establishment_id;

  if (!establishmentId) {
    throw new Error("Estabelecimento não encontrado.");
  }

  return { supabase, establishmentId: String(establishmentId) };
}

export async function manifestFiscalNfeAction(params: {
  noteId: string;
  manifestationType: NfeManifestationType;
  justification?: string | null;
}) {
  const { supabase, establishmentId } = await getContext();

  const { data: note, error: noteError } = await supabase
    .from("fiscal_nfe_inbox")
    .select("id, chave_acesso, status_manifestacao")
    .eq("id", params.noteId)
    .eq("establishment_id", establishmentId)
    .single();

  if (noteError || !note) {
    console.error(noteError);
    throw new Error("NF-e não encontrada para manifestação.");
  }

  const { data: certificate, error: certificateError } = await supabase
    .from("fiscal_certificates")
    .select("*")
    .eq("establishment_id", establishmentId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (certificateError) {
    console.error(certificateError);
    throw new Error("Não foi possível carregar o certificado ativo.");
  }

  if (!certificate) {
    throw new Error("Cadastre um certificado A1 ativo antes de manifestar a NF-e.");
  }

  const { data: certificateFile, error: certificateDownloadError } = await supabase.storage
    .from(CERTIFICATE_BUCKET)
    .download(String((certificate as any).certificate_path));

  if (certificateDownloadError || !certificateFile) {
    console.error(certificateDownloadError);
    throw new Error("Não foi possível ler o certificado A1 salvo.");
  }

  const result = await sendNfeManifestationEvent({
    ambiente: (process.env.SEFAZ_AMBIENTE || "homologacao") as SefazAmbiente,
    ufCode: process.env.SEFAZ_UF || "35",
    cnpj: String((certificate as any).cnpj),
    chaveAcesso: String((note as any).chave_acesso),
    manifestationType: params.manifestationType,
    justification: params.justification || null,
    pfxBuffer: Buffer.from(await certificateFile.arrayBuffer()),
    passphrase: decryptPassword(String((certificate as any).encrypted_password)),
  });

  const acceptedCodes = new Set(["135", "136", "573"]);
  const statusByType: Record<NfeManifestationType, string> = {
    ciencia_operacao: "ciencia_operacao",
    confirmacao_operacao: "confirmada",
    desconhecimento_operacao: "desconhecida",
    operacao_nao_realizada: "nao_realizada",
  };

  if (acceptedCodes.has(result.cStat)) {
    const { error: updateError } = await supabase
      .from("fiscal_nfe_inbox")
      .update({
        status_manifestacao: statusByType[params.manifestationType],
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.noteId)
      .eq("establishment_id", establishmentId);

    if (updateError) {
      console.error(updateError);
      throw new Error("Evento registrado, mas não foi possível atualizar o status local da NF-e.");
    }
  }

  revalidatePath("/dashboard/fiscal/notas");

  return result;
}
