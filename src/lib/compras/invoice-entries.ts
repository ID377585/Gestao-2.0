import { createSupabaseServerClient } from "@/lib/supabase/server";

export type DashboardInvoiceEntry = {
  id: string;
  fornecedor?: string | null;
  supplier_name?: string | null;
  numero?: string | null;
  invoice_number?: string | null;
  chave?: string | null;
  access_key?: string | null;
  data_entrada?: string | null;
  entry_date?: string | null;
  valor_total?: number | null;
  total_amount?: number | null;
  status?: string | null;
  created_at?: string | null;
  [key: string]: any;
};

const CANDIDATE_TABLES = [
  "invoice_entry_drafts",
  "invoice_entries",
  "notas_entrada",
  "fiscal_nfe_inbox",
];

function normalizeInvoiceEntry(raw: any): DashboardInvoiceEntry {
  return {
    ...raw,
    id: String(raw.id),
    fornecedor: raw.fornecedor ?? raw.supplier_name ?? raw.emitente_nome ?? raw.razao_social ?? null,
    supplier_name: raw.supplier_name ?? raw.fornecedor ?? raw.emitente_nome ?? raw.razao_social ?? null,
    numero: raw.numero ?? raw.invoice_number ?? raw.nfe_number ?? raw.numero_nota ?? null,
    invoice_number: raw.invoice_number ?? raw.numero ?? raw.nfe_number ?? raw.numero_nota ?? null,
    chave: raw.chave ?? raw.access_key ?? raw.chave_acesso ?? null,
    access_key: raw.access_key ?? raw.chave ?? raw.chave_acesso ?? null,
    data_entrada: raw.data_entrada ?? raw.entry_date ?? raw.created_at ?? null,
    entry_date: raw.entry_date ?? raw.data_entrada ?? raw.created_at ?? null,
    valor_total: Number(raw.valor_total ?? raw.total_amount ?? raw.total ?? 0),
    total_amount: Number(raw.total_amount ?? raw.valor_total ?? raw.total ?? 0),
    status: String(raw.status ?? "draft"),
    created_at: raw.created_at ?? null,
  };
}

function isLegacyTableMissingError(error: unknown) {
  const maybeError = error as { code?: string; message?: string } | null;
  return maybeError?.code === "42P01" || maybeError?.code === "42703";
}

function isMissingTableOrColumnError(error: unknown) {
  if (isLegacyTableMissingError(error)) {
    return true;
  }

  const message =
    error instanceof Error ? error.message : String(error ?? "");

  return (
    message.includes("does not exist") ||
    message.includes("Could not find the table") ||
    message.includes("Could not find") ||
    message.includes("relation") ||
    message.includes("schema cache") ||
    message.includes("column")
  );
}

async function trySelectFromTable(tableName: string) {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from(tableName)
    .select("*")
    .limit(500);

  if (error) {
    throw error;
  }

  if (!Array.isArray(data)) {
    return [];
  }

  return data.map(normalizeInvoiceEntry);
}

export async function listDashboardInvoiceEntries(): Promise<
  DashboardInvoiceEntry[]
> {
  for (const tableName of CANDIDATE_TABLES) {
    try {
      const rows = await trySelectFromTable(tableName);
      if (rows.length > 0 || tableName === CANDIDATE_TABLES.at(-1)) {
        return rows;
      }
    } catch (error) {
      if (!isMissingTableOrColumnError(error)) {
        throw error;
      }
    }
  }

  return [];
}
