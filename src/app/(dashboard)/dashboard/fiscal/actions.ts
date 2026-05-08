"use server";

import forge from "node-forge";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";

const CERTIFICATE_BUCKET = "fiscal-certificates";

function sanitizeFileName(fileName: string) {
  return fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

function encryptPassword(password: string) {
  return forge.util.encode64(password);
}

function extractCertificateExpiration(_buffer: ArrayBuffer) {
  return null;
}

async function getFiscalContext() {
  const supabase = await createSupabaseServerClient();
  const { membership } = await getActiveMembershipOrRedirect();
  const establishmentId = (membership as any)?.establishment_id;

  if (!establishmentId) {
    throw new Error("Estabelecimento não encontrado.");
  }

  return { supabase, establishmentId };
}

export async function uploadFiscalCertificateAction(formData: FormData) {
  const { supabase, establishmentId } = await getFiscalContext();

  const fileEntry = formData.get("file");
  const password = String(formData.get("password") ?? "").trim();
  const cnpj = String(formData.get("cnpj") ?? "").trim();

  if (!(fileEntry instanceof File)) {
    throw new Error("Nenhum certificado foi enviado.");
  }

  if (!password) {
    throw new Error("Informe a senha do certificado.");
  }

  if (!cnpj) {
    throw new Error("Informe o CNPJ.");
  }

  const file = fileEntry;
  const fileName = file.name.toLowerCase();

  if (!fileName.endsWith(".pfx") && !fileName.endsWith(".p12")) {
    throw new Error("Envie um certificado A1 válido (.pfx ou .p12).");
  }

  const safeName = sanitizeFileName(file.name);
  const filePath = `${establishmentId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(CERTIFICATE_BUCKET)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type || "application/x-pkcs12",
    });

  if (uploadError) {
    console.error(uploadError);
    throw new Error("Não foi possível enviar o certificado.");
  }

  const expiresAt = extractCertificateExpiration(await file.arrayBuffer());

  const { error: deactivateError } = await supabase
    .from("fiscal_certificates")
    .update({ status: "inactive", updated_at: new Date().toISOString() })
    .eq("establishment_id", establishmentId)
    .eq("status", "active");

  if (deactivateError) {
    console.error(deactivateError);
  }

  const { error: insertError } = await supabase
    .from("fiscal_certificates")
    .insert({
      establishment_id: establishmentId,
      cnpj,
      certificate_path: filePath,
      encrypted_password: encryptPassword(password),
      expires_at: expiresAt,
      status: "active",
    });

  if (insertError) {
    console.error(insertError);
    throw new Error("Não foi possível salvar o certificado.");
  }

  revalidatePath("/dashboard/fiscal/certificado");

  return { success: true };
}

export async function listFiscalCertificatesAction() {
  const { supabase, establishmentId } = await getFiscalContext();

  const { data, error } = await supabase
    .from("fiscal_certificates")
    .select("id, establishment_id, cnpj, certificate_path, expires_at, status, created_at, updated_at")
    .eq("establishment_id", establishmentId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    throw new Error("Não foi possível carregar os certificados fiscais.");
  }

  return data ?? [];
}

export async function listFiscalNfeInboxAction() {
  const { supabase, establishmentId } = await getFiscalContext();

  const { data, error } = await supabase
    .from("fiscal_nfe_inbox")
    .select("*")
    .eq("establishment_id", establishmentId)
    .order("data_emissao", { ascending: false, nullsFirst: false });

  if (error) {
    console.error(error);
    throw new Error("Não foi possível carregar as notas disponíveis.");
  }

  return data ?? [];
}
