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
}: SubscriptionStatusBadgeProps) {
  if (!subscription) return null;

  const planLabel = getPlanLabel(subscription.planSlug);
  const statusLabel = getStatusLabel(subscription.status);
  const label = planLabel ? `${planLabel} · ${statusLabel}` : statusLabel;

  return (
    <Badge
      variant={subscription.canAccessSystem === false ? "destructive" : "secondary"}
      className="hidden h-9 items-center rounded-xl px-3 text-xs font-medium md:inline-flex"
      title={subscription.currentPeriodEnd ?? undefined}
    >
      {label}
    </Badge>
  );
}
