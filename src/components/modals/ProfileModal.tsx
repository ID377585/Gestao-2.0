"use client";

import { Button } from "@/components/ui/button";

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
  user: {
    name: string;
    email: string;
  };
}

export function ProfileModal({ open, onClose, user }: ProfileModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">Meu perfil</h3>
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </div>

        <div className="space-y-3">
          <div className="rounded-md border p-3">
            <div className="text-xs text-gray-500">Nome</div>
            <div className="text-sm font-medium text-gray-900">{user.name}</div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-xs text-gray-500">Email</div>
            <div className="text-sm font-medium text-gray-900">{user.email}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
