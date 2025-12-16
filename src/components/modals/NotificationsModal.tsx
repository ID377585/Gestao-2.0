"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function NotificationsModal() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label="Notificações"
        >
          🔔
        </Button>
      </DialogTrigger>

      <DialogContent className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle>Notificações</DialogTitle>
        </DialogHeader>

        <div className="text-sm text-muted-foreground">
          Sem notificações no momento.
        </div>
      </DialogContent>
    </Dialog>
  );
}
