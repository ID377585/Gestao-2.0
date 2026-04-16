"use client";

import { Button } from "@/components/ui/button";

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
  user: {
    name: string;
    email: string;
    role?: string | null;
    sector?: string | null;
    establishmentId?: string | null;
    lastSignInAt?: string | null;
  };
}

function getRoleLabel(role?: string | null) {
  switch (String(role ?? "").trim()) {
    case "admin":
      return "Administrador";
    case "operacao":
      return "Operação";
    case "producao":
      return "Produção";
    case "estoque":
      return "Estoque";
    case "fiscal":
      return "Fiscal";
    case "entrega":
      return "Entrega";
    case "cliente":
      return "Cliente";
    default:
      return "Usuário";
  }
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
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
              {getRoleLabel(user.role)}
            </div>
          </div>

          <div className="rounded-md border border-gray-200 p-3 dark:border-slate-700 dark:bg-slate-800/60">
            <div className="text-xs text-gray-500 dark:text-slate-400">Setor</div>
            <div className="text-sm font-medium text-gray-900 dark:text-slate-100">
              {user.sector || "—"}
            </div>
          </div>

          <div className="rounded-md border border-gray-200 p-3 dark:border-slate-700 dark:bg-slate-800/60">
            <div className="text-xs text-gray-500 dark:text-slate-400">
              Último acesso
            </div>
            <div className="text-sm font-medium text-gray-900 dark:text-slate-100">
              {formatDate(user.lastSignInAt)}
            </div>
          </div>

          <div className="rounded-md border border-gray-200 p-3 dark:border-slate-700 dark:bg-slate-800/60">
            <div className="text-xs text-gray-500 dark:text-slate-400">
              Estabelecimento
            </div>
            <div className="text-sm font-medium text-gray-900 dark:text-slate-100 break-all">
              {user.establishmentId || "—"}
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