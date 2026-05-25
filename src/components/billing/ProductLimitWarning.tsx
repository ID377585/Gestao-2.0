import {
  getLimitWarning,
  getLimitWarningClassName,
} from "@/lib/billing/limit-warnings";
import type { PlanUsageMetric } from "@/lib/billing/usage-limits";

type ProductLimitWarningProps = {
  metric: PlanUsageMetric | null | undefined;
};

function formatLimit(metric: PlanUsageMetric) {
  if (metric.isUnlimited) return `${metric.used} de ilimitado`;
  return `${metric.used} de ${metric.limit}`;
}

export function ProductLimitWarning({ metric }: ProductLimitWarningProps) {
  if (!metric) return null;

  const warning = getLimitWarning(metric);

  return (
    <div
      className={`rounded-lg border px-3 py-2 text-xs ${getLimitWarningClassName(
        warning.severity
      )}`}
    >
      <p className="font-semibold">
        {warning.title} · {formatLimit(metric)} produtos/insumos
      </p>
      <p className="mt-1 opacity-90">{warning.message}</p>
      <p className="mt-1 text-[11px] opacity-80">
        Ao atingir o limite, novos cadastros e importações serão bloqueados pelo plano.
      </p>
    </div>
  );
}
