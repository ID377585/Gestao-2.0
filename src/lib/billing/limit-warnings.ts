import type { PlanUsageMetric } from "@/lib/billing/usage-limits";

export type LimitWarningSeverity = "ok" | "info" | "warning" | "danger" | "unlimited";

export type LimitWarning = {
  severity: LimitWarningSeverity;
  title: string;
  message: string;
  shouldSuggestUpgrade: boolean;
};

export function getLimitWarning(metric: PlanUsageMetric): LimitWarning {
  if (metric.isUnlimited) {
    return {
      severity: "unlimited",
      title: "Uso ilimitado",
      message: `${metric.label} não possui limite neste plano.`,
      shouldSuggestUpgrade: false,
    };
  }

  const percentage = metric.percentage ?? 0;

  if (percentage >= 100) {
    return {
      severity: "danger",
      title: "Limite atingido",
      message: `${metric.label} atingiu o limite do plano. Novos cadastros podem exigir upgrade.`,
      shouldSuggestUpgrade: true,
    };
  }

  if (percentage >= 90) {
    return {
      severity: "warning",
      title: "Muito próximo do limite",
      message: `${metric.label} já está acima de 90% do limite. Recomende upgrade antes de bloquear a operação.`,
      shouldSuggestUpgrade: true,
    };
  }

  if (percentage >= 80) {
    return {
      severity: "info",
      title: "Próximo do limite",
      message: `${metric.label} passou de 80% do limite. Este é um bom momento para avisar o cliente.`,
      shouldSuggestUpgrade: true,
    };
  }

  return {
    severity: "ok",
    title: "Dentro do limite",
    message: `${metric.label} está dentro do limite do plano.`,
    shouldSuggestUpgrade: false,
  };
}

export function getLimitWarningClassName(severity: LimitWarningSeverity) {
  switch (severity) {
    case "danger":
      return "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300";
    case "info":
      return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300";
    case "unlimited":
      return "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900/60 dark:bg-purple-950/30 dark:text-purple-300";
    case "ok":
    default:
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300";
  }
}
