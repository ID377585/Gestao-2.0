"use client";

import { Badge } from "@/components/ui/badge";

export type SubscriptionStatusBadgeData = {
  status?: string | null;
  planSlug?: string | null;
  currentPeriodEnd?: string | null;
  canAccessSystem?: boolean;
} | null;

type SubscriptionStatusBadgeProps = {
  subscription?: SubscriptionStatusBadgeData;
  showFallback?: boolean;
};

function getStatusLabel(status?: string | null) {
  switch (status) {
    case "trialing":
      return "Teste";
    case "active":
      return "Ativo";
    case "past_due":
      return "Pagamento pendente";
    case "canceled":
      return "Cancelado";
    case "blocked":
      return "Bloqueado";
    case "not_configured":
      return "Sem cobrança";
    default:
      return "Assinatura";
  }
}

function getPlanLabel(planSlug?: string | null) {
  switch (planSlug) {
    case "starter":
      return "Starter";
    case "growth":
      return "Growth";
    case "enterprise":
      return "Enterprise";
    default:
      return null;
  }
}

export function SubscriptionStatusBadge({
  subscription,
  showFallback = true,
}: SubscriptionStatusBadgeProps) {
  const safeSubscription =
    subscription ??
    (showFallback
      ? {
          status: "not_configured",
          planSlug: null,
          currentPeriodEnd: null,
          canAccessSystem: true,
        }
      : null);

  if (!safeSubscription) return null;

  const planLabel = getPlanLabel(safeSubscription.planSlug);
  const statusLabel = getStatusLabel(safeSubscription.status);
  const label = planLabel ? `${planLabel} · ${statusLabel}` : statusLabel;

  return (
    <Badge
      variant={safeSubscription.canAccessSystem === false ? "destructive" : "secondary"}
      className="hidden h-9 items-center rounded-xl px-3 text-xs font-medium md:inline-flex"
      title={safeSubscription.currentPeriodEnd ?? undefined}
    >
      {label}
    </Badge>
  );
}
