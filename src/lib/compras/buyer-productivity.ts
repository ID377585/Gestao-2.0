import type {
  SupplierActionPlanItem,
  SupplierContactHistoryItem,
  SupplierScoreReviewItem,
} from "@/types/compras";

export type BuyerProductivityRow = {
  buyer: string;
  actionsCompleted: number;
  contactsMade: number;
  reviewsDone: number;
  totalActivities: number;
  score: number;
};

function normalizeActor(value?: string) {
  const text = String(value ?? "").trim();
  return text || "Não informado";
}

function isWithinRange(value: string, startDate: string, endDate: string) {
  const onlyDate = value.slice(0, 10);
  return onlyDate >= startDate && onlyDate <= endDate;
}

export function buildBuyerProductivity(params: {
  actions: SupplierActionPlanItem[];
  contacts: SupplierContactHistoryItem[];
  reviews: SupplierScoreReviewItem[];
  startDate: string;
  endDate: string;
}) {
  const map = new Map<string, BuyerProductivityRow>();

  function ensureBuyer(name: string) {
    if (!map.has(name)) {
      map.set(name, {
        buyer: name,
        actionsCompleted: 0,
        contactsMade: 0,
        reviewsDone: 0,
        totalActivities: 0,
        score: 0,
      });
    }

    return map.get(name)!;
  }

  for (const item of params.actions) {
    if (
      item.status === "concluido" &&
      item.updatedAt &&
      isWithinRange(item.updatedAt, params.startDate, params.endDate)
    ) {
      const buyer = normalizeActor(item.assignedTo || item.createdBy);
      const row = ensureBuyer(buyer);
      row.actionsCompleted += 1;
    }
  }

  for (const item of params.contacts) {
    if (
      item.contactDate &&
      isWithinRange(item.contactDate, params.startDate, params.endDate)
    ) {
      const buyer = normalizeActor(item.createdBy);
      const row = ensureBuyer(buyer);
      row.contactsMade += 1;
    }
  }

  for (const item of params.reviews) {
    if (
      item.status === "realizada" &&
      item.updatedAt &&
      isWithinRange(item.updatedAt, params.startDate, params.endDate)
    ) {
      const buyer = normalizeActor(item.createdBy);
      const row = ensureBuyer(buyer);
      row.reviewsDone += 1;
    }
  }

  const rows = Array.from(map.values()).map((item) => {
    const totalActivities =
      item.actionsCompleted + item.contactsMade + item.reviewsDone;

    const score =
      item.actionsCompleted * 3 +
      item.contactsMade * 2 +
      item.reviewsDone * 2;

    return {
      ...item,
      totalActivities,
      score,
    };
  });

  return rows.sort((a, b) => b.score - a.score);
}