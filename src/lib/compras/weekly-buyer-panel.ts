import type {
  SupplierActionPlanItem,
  SupplierContactHistoryItem,
  SupplierScoreReviewItem,
} from "@/types/compras";

export type WeeklyBuyerMetrics = {
  totalAcoesSemana: number;
  acoesConcluidasSemana: number;
  acoesAtrasadasSemana: number;
  contatosRealizadosSemana: number;
  reavaliacoesRealizadasSemana: number;
  produtividadePercentual: number;
};

function startOfWeek(date: Date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfWeek(date: Date) {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function isWithinWeek(value?: string) {
  if (!value) return false;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();
  const start = startOfWeek(now);
  const end = endOfWeek(now);

  return date >= start && date <= end;
}

export function buildWeeklyBuyerMetrics(params: {
  actions: SupplierActionPlanItem[];
  contacts: SupplierContactHistoryItem[];
  reviews: SupplierScoreReviewItem[];
}): WeeklyBuyerMetrics {
  const acoesSemana = params.actions.filter(
    (item) => isWithinWeek(item.dueDate) || isWithinWeek(item.updatedAt)
  );

  const acoesConcluidasSemana = acoesSemana.filter(
    (item) => item.status === "concluido"
  );

  const acoesAtrasadasSemana = params.actions.filter((item) => {
    if (!item.dueDate) return false;
    if (item.status === "concluido" || item.status === "cancelado") return false;

    const due = new Date(item.dueDate);
    const now = new Date();

    return !Number.isNaN(due.getTime()) && due < now;
  });

  const contatosRealizadosSemana = params.contacts.filter((item) =>
    isWithinWeek(item.contactDate)
  );

  const reavaliacoesRealizadasSemana = params.reviews.filter(
    (item) => item.status === "realizada" && isWithinWeek(item.updatedAt)
  );

  const produtividadeBase =
    acoesSemana.length +
    contatosRealizadosSemana.length +
    reavaliacoesRealizadasSemana.length;

  const produtividadeFeita =
    acoesConcluidasSemana.length +
    contatosRealizadosSemana.length +
    reavaliacoesRealizadasSemana.length;

  const produtividadePercentual =
    produtividadeBase > 0
      ? Math.round((produtividadeFeita / produtividadeBase) * 100)
      : 0;

  return {
    totalAcoesSemana: acoesSemana.length,
    acoesConcluidasSemana: acoesConcluidasSemana.length,
    acoesAtrasadasSemana: acoesAtrasadasSemana.length,
    contatosRealizadosSemana: contatosRealizadosSemana.length,
    reavaliacoesRealizadasSemana: reavaliacoesRealizadasSemana.length,
    produtividadePercentual,
  };
}

export function isCurrentWeek(value?: string) {
  return isWithinWeek(value);
}