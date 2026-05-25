"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { AppNotification } from "@/lib/notifications";

type NotificationsModalProps = {
  open: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  onMarkAsRead?: (id: string) => void;
  onMarkAllAsRead?: () => void;
  onArchive?: (id: string) => void;
  onArchiveRead?: () => void;
};

function formatDate(value?: AppNotification["createdAt"]) {
  if (!value) return "Agora";

  try {
    const date =
      typeof (value as any)?.toDate === "function"
        ? (value as any).toDate()
        : new Date(value as any);

    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(date);
  } catch {
    return "Agora";
  }
}

function getPriorityLabel(priority?: AppNotification["priority"]) {
  switch (priority) {
    case "critical":
      return "Crítica";
    case "high":
      return "Alta";
    case "info":
      return "Info";
    default:
      return "Normal";
  }
}

function getPriorityClass(priority?: AppNotification["priority"]) {
  switch (priority) {
    case "critical":
      return "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300";
    case "high":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300";
    case "info":
      return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300";
    default:
      return "border-gray-200 bg-gray-50 text-gray-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
  }
}

function getTypeLabel(type?: AppNotification["type"]) {
  switch (type) {
    case "stock_idle":
      return "Estoque parado";
    case "low_stock":
      return "Estoque baixo";
    case "purchase_above_average":
      return "Compra cara";
    case "high_loss":
      return "Perda alta";
    case "plan_due":
      return "Plano";
    case "notification_checks_ran":
      return "Verificação";
    default:
      return type ? String(type) : "Sistema";
  }
}

function getPayloadRows(notification: AppNotification) {
  const source = notification.payload ?? notification.metadata ?? null;

  if (!source || typeof source !== "object") return [];

  const labels: Record<string, string> = {
    product_name: "Produto",
    name: "Nome",
    quantity: "Quantidade",
    last_movement_at: "Última movimentação",
    unit_price: "Preço comprado",
    average_unit_price: "Preço médio",
    total_value: "Valor total",
    customer_name: "Cliente",
    due_date: "Vencimento",
    status: "Status",
  };

  return Object.entries(source)
    .filter(([key, value]) => labels[key] && value !== null && value !== undefined && value !== "")
    .slice(0, 6)
    .map(([key, value]) => [labels[key], String(value)] as const);
}

export default function NotificationsModal({
  open,
  onClose,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onArchive,
  onArchiveRead,
}: NotificationsModalProps) {
  const unreadCount = notifications.filter((item) => !item.read).length;
  const readCount = notifications.filter((item) => item.read).length;
  const criticalCount = notifications.filter((item) => item.priority === "critical").length;

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : undefined)}>
      <DialogContent className="max-w-2xl border border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-slate-100">
            Notificações
          </DialogTitle>
          <DialogDescription className="text-gray-500 dark:text-slate-400">
            Acompanhe alertas operacionais, financeiros, estoque e planos.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-md border border-gray-200 p-3 dark:border-slate-700 dark:bg-slate-800/50">
            <div className="text-xs text-muted-foreground">Total</div>
            <div className="text-lg font-semibold text-gray-900 dark:text-slate-100">
              {notifications.length}
            </div>
          </div>
          <div className="rounded-md border border-gray-200 p-3 dark:border-slate-700 dark:bg-slate-800/50">
            <div className="text-xs text-muted-foreground">Não lidas</div>
            <div className="text-lg font-semibold text-gray-900 dark:text-slate-100">
              {unreadCount}
            </div>
          </div>
          <div className="rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-900/60 dark:bg-red-950/20">
            <div className="text-xs text-red-700 dark:text-red-300">Críticas</div>
            <div className="text-lg font-semibold text-red-700 dark:text-red-300">
              {criticalCount}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onArchiveRead}
            disabled={readCount === 0}
          >
            Arquivar lidas
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onMarkAllAsRead}
            disabled={unreadCount === 0}
          >
            Marcar todas como lidas
          </Button>
        </div>

        <div className="max-h-[55vh] space-y-2 overflow-auto pr-1">
          {notifications.length === 0 && (
            <div className="rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-muted-foreground dark:border-slate-700">
              Nenhuma notificação no momento.
            </div>
          )}

          {notifications.map((n) => {
            const payloadRows = getPayloadRows(n);

            return (
              <div
                key={n.id}
                className={`rounded-md border p-3 text-sm ${
                  n.read
                    ? "border-gray-200 dark:border-slate-700 dark:bg-slate-800/50"
                    : "border-blue-200 bg-blue-50/40 dark:border-blue-900/60 dark:bg-blue-950/20"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${getPriorityClass(n.priority)}`}>
                        {getPriorityLabel(n.priority)}
                      </span>
                      <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {getTypeLabel(n.type)}
                      </span>
                      {!n.read ? (
                        <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-medium text-white">
                          Nova
                        </span>
                      ) : null}
                    </div>

                    <div className="font-semibold text-gray-900 dark:text-slate-100">
                      {n.title}
                    </div>
                    <div className="mt-1 text-muted-foreground">{n.message}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatDate(n.createdAt)}
                    </div>

                    {payloadRows.length > 0 ? (
                      <div className="mt-3 grid gap-1 rounded-md bg-white/70 p-2 text-xs dark:bg-slate-900/50">
                        {payloadRows.map(([label, value]) => (
                          <div key={label} className="flex justify-between gap-3">
                            <span className="text-muted-foreground">{label}</span>
                            <span className="truncate font-medium text-gray-900 dark:text-slate-100">
                              {value}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-col gap-2">
                    {!n.read && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onMarkAsRead?.(n.id)}
                      >
                        Marcar lida
                      </Button>
                    )}

                    {n.href ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          onMarkAsRead?.(n.id);
                          window.location.assign(n.href!);
                        }}
                      >
                        Abrir
                      </Button>
                    ) : null}

                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-slate-100"
                      onClick={() => onArchive?.(n.id)}
                    >
                      Arquivar
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
