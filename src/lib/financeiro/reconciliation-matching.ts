import type {
  AccountPayable,
  AccountReceivable,
  BankReconciliationEntry,
} from "@/types/compras";

export type ReconciliationSuggestion = {
  reconciliationEntryId: string;
  financeType: "pagar" | "receber";
  financeId: string;
  financeLabel: string;
  score: number;
  reason: string;
};

function parseYmdToDate(value?: string) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function diffDays(a?: string, b?: string) {
  const dateA = parseYmdToDate(a);
  const dateB = parseYmdToDate(b);

  if (!dateA || !dateB) return 999;

  const diffMs = Math.abs(dateA.getTime() - dateB.getTime());
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function normalizeText(value?: string) {
  return (value ?? "").trim().toLowerCase();
}

function includesEither(a?: string, b?: string) {
  const aa = normalizeText(a);
  const bb = normalizeText(b);

  if (!aa || !bb) return false;

  return aa.includes(bb) || bb.includes(aa);
}

function buildPayableCandidates(payables: AccountPayable[]) {
  return payables
    .filter(
      (item) =>
        item.statusPagamento !== "cancelado" &&
        Number(item.valor) > 0
    )
    .map((item) => ({
      financeType: "pagar" as const,
      financeId: item.id,
      label: `${item.supplierName} - ${item.descricao}`,
      valor: Number(item.valor),
      data: item.dataPagamento || item.vencimento || "",
      bankAccountId: item.bankAccountId ?? "",
      descricao: item.descricao ?? "",
      nome: item.supplierName ?? "",
    }));
}

function buildReceivableCandidates(receivables: AccountReceivable[]) {
  return receivables
    .filter(
      (item) =>
        item.statusRecebimento !== "cancelado" &&
        Number(item.valor) > 0
    )
    .map((item) => ({
      financeType: "receber" as const,
      financeId: item.id,
      label: `${item.customerName} - ${item.descricao}`,
      valor: Number(item.valor),
      data: item.dataRecebimento || item.vencimento || "",
      bankAccountId: item.bankAccountId ?? "",
      descricao: item.descricao ?? "",
      nome: item.customerName ?? "",
    }));
}

export function buildReconciliationSuggestions(params: {
  entries: BankReconciliationEntry[];
  payables: AccountPayable[];
  receivables: AccountReceivable[];
}) {
  const payableCandidates = buildPayableCandidates(params.payables);
  const receivableCandidates = buildReceivableCandidates(params.receivables);

  const suggestions = new Map<string, ReconciliationSuggestion>();

  for (const entry of params.entries) {
    if (entry.conciliado) continue;
    if (entry.origem === "financeiro" && entry.origemId) continue;

    const financePool =
      entry.tipo === "saida" ? payableCandidates : receivableCandidates;

    let best: ReconciliationSuggestion | null = null;

    for (const candidate of financePool) {
      let score = 0;
      const reasons: string[] = [];

      if (Math.abs(Number(entry.valor) - Number(candidate.valor)) < 0.01) {
        score += 60;
        reasons.push("mesmo valor");
      } else {
        continue;
      }

      if (
        entry.bankAccountId &&
        candidate.bankAccountId &&
        entry.bankAccountId === candidate.bankAccountId
      ) {
        score += 20;
        reasons.push("mesma conta bancária");
      }

      const days = diffDays(entry.data, candidate.data);

      if (days <= 1) {
        score += 15;
        reasons.push("data muito próxima");
      } else if (days <= 3) {
        score += 10;
        reasons.push("data próxima");
      } else if (days <= 7) {
        score += 5;
        reasons.push("data compatível");
      }

      if (
        includesEither(entry.descricao, candidate.descricao) ||
        includesEither(entry.descricao, candidate.nome)
      ) {
        score += 10;
        reasons.push("descrição parecida");
      }

      if (!best || score > best.score) {
        best = {
          reconciliationEntryId: entry.id,
          financeType: candidate.financeType,
          financeId: candidate.financeId,
          financeLabel: candidate.label,
          score,
          reason: reasons.join(", "),
        };
      }
    }

    if (best && best.score >= 60) {
      suggestions.set(entry.id, best);
    }
  }

  return suggestions;
}