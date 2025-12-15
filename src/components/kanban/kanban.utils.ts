import type { KanbanStatus, StatusConfigItem } from "./kanban.types";

export const statusConfig: Record<string, StatusConfigItem> = {
  criado: { label: "Criado", color: "bg-gray-500", textColor: "text-gray-700" },
  em_preparo: { label: "Em Preparo", color: "bg-blue-500", textColor: "text-blue-700" },
  separacao: { label: "Separação", color: "bg-yellow-500", textColor: "text-yellow-700" },
  conferencia: { label: "Conferência", color: "bg-orange-500", textColor: "text-orange-700" },
  saiu_entrega: { label: "Saiu p/ Entrega", color: "bg-purple-500", textColor: "text-purple-700" },
  entrega_concluida: { label: "Concluído", color: "bg-green-500", textColor: "text-green-700" },
  cancelado: { label: "Cancelado", color: "bg-red-500", textColor: "text-red-700" },
};

export const borderColorByStatus: Record<string, string> = {
  criado: "border-l-gray-400",
  em_preparo: "border-l-blue-400",
  separacao: "border-l-yellow-400",
  conferencia: "border-l-orange-400",
  saiu_entrega: "border-l-purple-400",
  entrega_concluida: "border-l-green-400",
  cancelado: "border-l-red-400",
};

export function formatCurrencyBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatDateBR(dateString: string) {
  return new Date(dateString).toLocaleDateString("pt-BR");
}

export function clampProgress(value: number) {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export function normalizeStatus(status: string): KanbanStatus | string {
  return status?.trim?.() || status;
}
