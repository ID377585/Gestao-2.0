"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";

async function getContext() {
  const supabase = await createSupabaseServerClient();
  const { membership } = await getActiveMembershipOrRedirect();
  const establishmentId = (membership as any)?.establishment_id;

  if (!establishmentId) {
    throw new Error("Estabelecimento não encontrado.");
  }

  return { supabase, establishmentId: String(establishmentId) };
}

export async function getFiscalDashboardAction() {
  const { supabase, establishmentId } = await getContext();

  const { data: notes, error: notesError } = await supabase
    .from("fiscal_nfe_inbox")
    .select("id, chave_acesso, numero, serie, fornecedor_nome, fornecedor_cnpj, valor_total, data_emissao, status_manifestacao, xml_path, imported_entry_id, created_at, updated_at")
    .eq("establishment_id", establishmentId)
    .order("updated_at", { ascending: false });

  if (notesError) {
    console.error(notesError);
    throw new Error("Não foi possível carregar as notas fiscais.");
  }

  const { data: nsuControl, error: nsuError } = await supabase
    .from("fiscal_nsu_control")
    .select("ultimo_nsu, updated_at")
    .eq("establishment_id", establishmentId)
    .maybeSingle();

  if (nsuError) {
    console.error(nsuError);
  }

  const rows = notes ?? [];
  const total = rows.length;
  const imported = rows.filter((note: any) => Boolean(note.imported_entry_id)).length;
  const pendingEntry = rows.filter((note: any) => !note.imported_entry_id).length;
  const fullXml = rows.filter((note: any) => note.status_manifestacao === "xml_completo").length;
  const summaryOnly = rows.filter((note: any) => note.status_manifestacao === "resumo_disponivel").length;
  const manifested = rows.filter((note: any) => ["ciencia_operacao", "confirmada", "desconhecida", "nao_realizada"].includes(String(note.status_manifestacao))).length;
  const withoutXml = rows.filter((note: any) => !note.xml_path).length;
  const totalValue = rows.reduce((acc: number, note: any) => acc + Number(note.valor_total || 0), 0);

  const pendingNotes = rows
    .filter((note: any) => !note.imported_entry_id)
    .slice(0, 10);

  const xmlPendingNotes = rows
    .filter((note: any) => note.status_manifestacao === "resumo_disponivel" || !note.xml_path)
    .slice(0, 10);

  const recentNotes = rows.slice(0, 10);

  return {
    metrics: {
      total,
      imported,
      pendingEntry,
      fullXml,
      summaryOnly,
      manifested,
      withoutXml,
      totalValue,
    },
    nsu: {
      ultimo_nsu: nsuControl?.ultimo_nsu ?? "000000000000000",
      updated_at: nsuControl?.updated_at ?? null,
    },
    pendingNotes,
    xmlPendingNotes,
    recentNotes,
  };
}
