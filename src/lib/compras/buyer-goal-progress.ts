import type {
  BuyerMonthlyGoal,
  SupplierActionPlanItem,
  SupplierContactHistoryItem,
  SupplierScoreReviewItem,
} from "@/types/compras";

export type BuyerGoalProgressRow = {
  buyer: string;
  referenceMonth: string;
  targetContacts: number;
  targetActionsCompleted: number;
  targetReviewsDone: number;
  actualContacts: number;
  actualActionsCompleted: number;
  actualReviewsDone: number;
  progressContacts: number;
  progressActionsCompleted: number;
  progressReviewsDone: number;
  overallProgress: number;
};

function normalizeActor(value?: string) {
  const text = String(value ?? "").trim();
  return text || "Não informado";
}

function toMonth(value?: string) {
  if (!value) return "";
  return value.slice(0, 7);
}

function percent(actual: number, target: number) {
  if (target <= 0) return actual > 0 ? 100 : 0;
  return Math.round((actual / target) * 100);
}

export function buildBuyerGoalProgress(params: {
  goals: BuyerMonthlyGoal[];
  actions: SupplierActionPlanItem[];
  contacts: SupplierContactHistoryItem[];
  reviews: SupplierScoreReviewItem[];
}) {
  return params.goals.map((goal) => {
    const buyer = normalizeActor(goal.buyer);
    const month = goal.referenceMonth;

    const actualActionsCompleted = params.actions.filter(
      (item) =>
        item.status === "concluido" &&
        toMonth(item.updatedAt) === month &&
        normalizeActor(item.assignedTo || item.createdBy) === buyer
    ).length;

    const actualContacts = params.contacts.filter(
      (item) =>
        toMonth(item.contactDate) === month &&
        normalizeActor(item.createdBy) === buyer
    ).length;

    const actualReviewsDone = params.reviews.filter(
      (item) =>
        item.status === "realizada" &&
        toMonth(item.updatedAt) === month &&
        normalizeActor(item.createdBy) === buyer
    ).length;

    const progressContacts = percent(actualContacts, goal.targetContacts);
    const progressActionsCompleted = percent(
      actualActionsCompleted,
      goal.targetActionsCompleted
    );
    const progressReviewsDone = percent(
      actualReviewsDone,
      goal.targetReviewsDone
    );

    const overallProgress = Math.round(
      (progressContacts + progressActionsCompleted + progressReviewsDone) / 3
    );

    return {
      buyer,
      referenceMonth: month,
      targetContacts: goal.targetContacts,
      targetActionsCompleted: goal.targetActionsCompleted,
      targetReviewsDone: goal.targetReviewsDone,
      actualContacts,
      actualActionsCompleted,
      actualReviewsDone,
      progressContacts,
      progressActionsCompleted,
      progressReviewsDone,
      overallProgress,
    } as BuyerGoalProgressRow;
  });
}