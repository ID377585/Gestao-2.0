"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type NotificationsModalProps = {
  open: boolean;
  onClose: () => void;
  // ⚠️ deixo como any[] para não depender do tipo Notificacao definido no Topbar
  // (evita erro de tipos diferentes em arquivos diferentes)
  notifications: any[];
};

export default function NotificationsModal({
  open,
  onClose,
  notifications,
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

        <div className="space-y-2 max-h-[55vh] overflow-auto pr-1">
          {(!notifications || notifications.length === 0) && (
            <div className="text-sm text-muted-foreground">
              Nenhuma notificação no momento.
            </div>
          )}

          {Array.isArray(notifications) &&
            notifications.map((n: any, idx: number) => (
              <div
                key={n?.id ?? idx}
                className="rounded-md border p-3 text-sm"
              >
                <div className="font-semibold">
                  {n?.title ?? n?.titulo ?? "Notificação"}
                </div>
                <div className="text-muted-foreground">
                  {n?.message ?? n?.mensagem ?? ""}
                </div>
                {(n?.date || n?.createdAt) && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {String(n?.date ?? n?.createdAt)}
                  </div>
                )}
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
