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

export default function NotificationsModal({
  open,
  onClose,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
}: NotificationsModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : undefined)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Notificações</DialogTitle>
          <DialogDescription>
            Acompanhe alertas e avisos do sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="mb-3 flex justify-end">
          <Button variant="outline" size="sm" onClick={onMarkAllAsRead}>
            Marcar todas como lidas
          </Button>
        </div>

        <div className="max-h-[55vh] space-y-2 overflow-auto pr-1">
          {notifications.length === 0 && (
            <div className="text-sm text-muted-foreground">
              Nenhuma notificação no momento.
            </div>
          )}

          {notifications.map((n) => (
            <div key={n.id} className="rounded-md border p-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-gray-900">{n.titulo}</div>
                  <div className="text-muted-foreground">{n.mensagem}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {formatDate(n.createdAt)}
                  </div>
                </div>

                {!n.lida && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onMarkAsRead?.(n.id)}
                  >
                    Marcar lida
                  </Button>
                )}
              </div>
            </div>
          ))}
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