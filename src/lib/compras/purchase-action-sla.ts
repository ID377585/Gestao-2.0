import type { PurchaseAlertActionItem } from "@/types/compras";

export type PurchaseActionSlaInfo = {
  slaHours: number;
  openHours: number;
  overdue: boolean;
  overdueHours: number;
  statusLabel: "no_prazo" | "vencido" | "tratado";
};

function diffHours(from?: string, to?: string) {
  if (!from || !to) return 0;

  const start = new Date(from);
  const end = new Date(to);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 0;
  }

  const diffMs = end.getTime() - start.getTime();
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60)));
}

export function getPurchaseActionSlaHours(
  severity: PurchaseAlertActionItem["severity"]
) {
  switch (severity) {
    case "alta":
      return 24;
    case "media":
      return 72;
    case "baixa":
      return 120;
    default:
      return 72;
  }
}

export function getPurchaseActionSlaInfo(
  item: PurchaseAlertActionItem
): PurchaseActionSlaInfo {
  const slaHours = getPurchaseActionSlaHours(item.severity);

  const endDate =
    item.status === "tratado" ? item.treatedAt || new Date().toISOString() : new Date().toISOString();

  const openHours = diffHours(item.createdAt, endDate);
  const overdue = item.status !== "tratado" && openHours > slaHours;
  const overdueHours = overdue ? openHours - slaHours : 0;

  return {
    slaHours,
    openHours,
    overdue,
    overdueHours,
    statusLabel:
      item.status === "tratado"
        ? "tratado"
        : overdue
        ? "vencido"
        : "no_prazo",
  };
}