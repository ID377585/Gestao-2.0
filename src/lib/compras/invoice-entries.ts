"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLegacyTableMissingError } from "@/lib/legacy/supabase";

export type DashboardInvoiceEntry = {
  id: string;
  supplier_name: string;
  supplier_document: string | null;
  invoice_number: string;
  invoice_series: string | null;
  invoice_key: string | null;
  issue_date: string;
  entry_date: string;
  total_amount: number;
  notes: string | null;
  status: "active" | "cancelled";
  imported_from_xml: boolean;
  created_at: string;
};

function normalizeInvoiceEntry(raw: any): DashboardInvoiceEntry {
  return {
    id: String(raw.id ?? ""),
    supplier_name: String(
      raw.supplier_name ??
        raw.supplierName ??
        raw.fornecedor_nome ??
        raw.fornecedor ??
        ""
    ),
    supplier_document:
      raw.supplier_document ||
      raw.supplierDocument ||
      raw.fornecedor_documento ||
      raw.cnpj
        ? String(
            raw.supplier_document ??
              raw.supplierDocument ??
              raw.fornecedor_documento ??
              raw.cnpj
          )
        : null,
    invoice_number: String(
      raw.invoice_number ?? raw.invoiceNumber ?? raw.numero_nota ?? raw.nota ?? ""
    ),
    invoice_series:
      raw.invoice_series || raw.invoiceSeries || raw.serie
        ? String(raw.invoice_series ?? raw.invoiceSeries ?? raw.serie)
        : null,
    invoice_key:
      raw.invoice_key || raw.invoiceKey || raw.chave_nfe
        ? String(raw.invoice_key ?? raw.invoiceKey ?? raw.chave_nfe)
        : null,
    issue_date: String(
      raw.issue_date ?? raw.issueDate ?? raw.data_emissao ?? raw.created_at ?? ""
    ),
    entry_date: String(
      raw.entry_date ?? raw.entryDate ?? raw.data_entrada ?? raw.created_at ?? ""
    ),
    total_amount: Number(
      raw.total_amount ?? raw.totalAmount ?? raw.valor_total ?? raw.total ?? 0
    ),
    notes: raw.notes || raw.observacoes ? String(raw.notes ?? raw.observacoes) : null,
    status: String(raw.status ?? "active") as "active" | "cancelled",
    imported_from_xml: Boolean(raw.imported_from_xml ?? raw.importedFromXml ?? false),
    created_at: String(raw.created_at ?? raw.createdAt ?? ""),
  };
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
  const possibleTables = [
    "invoice_entries",
    "compras_invoice_entries",
    "purchase_invoice_entries",
    "entrada_notas",
    "entradas_notas",
    "invoice_entry",
    "invoice_entries_v3",
  ];

  for (const tableName of possibleTables) {
    try {
      const entries = await trySelectFromTable(tableName);

      if (entries.length > 0) {
        return entries.sort((a, b) =>
          String(b.created_at || b.entry_date).localeCompare(
            String(a.created_at || a.entry_date)
          )
        );
      }
    } catch (error) {
      if (isMissingTableOrColumnError(error)) {
        continue;
      }

      console.warn(
        `[fornecedores.dashboard] failed to read table ${tableName}.`,
        error
      );

      continue;
    }
  }

  return [];
}
