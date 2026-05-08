import { supabase } from "@/lib/supabase/client";
import { FiscalCertificate, FiscalNfeInboxItem } from "./types";

export async function listFiscalCertificates(): Promise<FiscalCertificate[]> {
  const { data, error } = await supabase
    .from("fiscal_certificates")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao listar certificados fiscais", error);
    throw new Error("Não foi possível carregar os certificados.");
  }

  return (data ?? []) as FiscalCertificate[];
}

export async function listFiscalNfeInbox(): Promise<FiscalNfeInboxItem[]> {
  const { data, error } = await supabase
    .from("fiscal_nfe_inbox")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao listar notas fiscais", error);
    throw new Error("Não foi possível carregar as notas fiscais.");
  }

  return (data ?? []) as FiscalNfeInboxItem[];
}
