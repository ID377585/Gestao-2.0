"use client";

import { Button } from "@/components/ui/button";

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
  user: {
    name: string;
    email: string;
    role?: string;
  };
}

export function ProfileModal({ open, onClose, user }: ProfileModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-lg dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100">
            Meu perfil
          </h3>
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </div>

        <div className="space-y-3">
          <div className="rounded-md border border-gray-200 p-3 dark:border-slate-700 dark:bg-slate-800/60">
            <div className="text-xs text-gray-500 dark:text-slate-400">Nome</div>
            <div className="text-sm font-medium text-gray-900 dark:text-slate-100">
              {user.name || "Usuário"}
            </div>
          </div>

          <div className="rounded-md border border-gray-200 p-3 dark:border-slate-700 dark:bg-slate-800/60">
            <div className="text-xs text-gray-500 dark:text-slate-400">Email</div>
            <div className="text-sm font-medium text-gray-900 dark:text-slate-100">
              {user.email || "-"}
            </div>
          </div>

          <div className="rounded-md border border-gray-200 p-3 dark:border-slate-700 dark:bg-slate-800/60">
            <div className="text-xs text-gray-500 dark:text-slate-400">
              Perfil de acesso
            </div>
            <div className="text-sm font-medium text-gray-900 dark:text-slate-100">
              {user.role === "admin" ? "Administrador" : "Usuário"}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={onClose}>Fechar</Button>
        </div>
      </div>
    </div>
  );
}