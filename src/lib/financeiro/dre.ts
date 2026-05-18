import { createSupabaseServerClient } from "@/lib/supabase/server";

export type DrePeriod = {
  dateFrom?: string;
  dateTo?: string;
};

export type DreMetric = {
  label: string;
  value: number;
};

export type DreData = {
  revenue: number;
  costs: number;
  losses: number;
  grossProfit: number;
  marginPercent: number;
  metrics: DreMetric[];
  invoiceEntries: any[];
  lossesEntries: any[];
};

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isMissingTableError(error: unknown) {
  const maybeError = error as { code?: string; message?: string } | null;
  const message = maybeError?.message ?? String(error ?? "");

  return (
    maybeError?.code === "42P01" ||
    maybeError?.code === "42703" ||
    message.includes("does not exist") ||
    message.includes("Could not find the table") ||
    message.includes("schema cache")
  );
}

function isInsidePeriod(value: unknown, period: DrePeriod) {
  const raw = typeof value === "string" ? value : "";
  if (!raw) return true;

  const time = new Date(raw).getTime();
  if (!Number.isFinite(time)) return true;

  if (period.dateFrom) {
    const from = new Date(`${period.dateFrom}T00:00:00`).getTime();
    if (Number.isFinite(from) && time < from) return false;
  }

  if (period.dateTo) {
    const to = new Date(`${period.dateTo}T23:59:59.999`).getTime();
    if (Number.isFinite(to) && time > to) return false;
  }

  return true;
}

function normalizeInvoice(raw: any) {
  return {
    id: String(raw.id ?? ""),
    entry_date: String(
      raw.entry_date ?? raw.entryDate ?? raw.data_entrada ?? raw.created_at ?? ""
    ),
    total_amount: toNumber(
      raw.total_amount ?? raw.totalAmount ?? raw.valor_total ?? raw.total ?? 0
    ),
    status: String(raw.status ?? "active"),
    created_at: String(raw.created_at ?? raw.createdAt ?? ""),
  };
}

async function readTableSafely(tableName: string) {
  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .limit(5000);

    if (error) {
      throw error;
    }

    return Array.isArray(data) ? data : [];
  } catch (error) {
    if (isMissingTableError(error)) {
      return [];
    }

    throw error;
  }
}

export async function getDreData(period: DrePeriod = {}): Promise<DreData> {
  const [invoiceEntriesRaw, lossesRaw] = await Promise.all([
    readTableSafely("invoice_entry_drafts"),
    readTableSafely("losses"),
  ]);

  const invoiceEntries = invoiceEntriesRaw
    .map(normalizeInvoice)
    .filter((entry) => isInsidePeriod(entry.entry_date || entry.created_at, period));

  const lossesEntries = lossesRaw.filter((entry: any) =>
    isInsidePeriod(entry.created_at, period)
  );

  const revenue = invoiceEntries.reduce(
    (sum, entry) => sum + toNumber(entry.total_amount),
    0
  );
  const losses = lossesEntries.reduce(
    (sum: number, entry: any) => sum + toNumber(entry.qty) * toNumber(entry.unit_cost ?? 0),
    0
  );
  const costs = losses;
  const grossProfit = revenue - costs;
  const marginPercent = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

  return {
    revenue,
    costs,
    losses,
    grossProfit,
    marginPercent,
    metrics: [
      { label: "Receita", value: revenue },
      { label: "Custos", value: costs },
      { label: "Perdas", value: losses },
      { label: "Lucro bruto", value: grossProfit },
    ],
    invoiceEntries,
    lossesEntries,
  };
}
