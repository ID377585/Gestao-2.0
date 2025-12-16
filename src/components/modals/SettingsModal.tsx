"use client";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">
            Configurações
          </h3>
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <div className="text-sm font-medium text-gray-900">
                Notificações por email
              </div>
              <div className="text-xs text-gray-500">
                Receber alertas importantes por email
              </div>
            </div>
            <Switch defaultChecked />
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <div className="text-sm font-medium text-gray-900">
                Notificações no navegador
              </div>
              <div className="text-xs text-gray-500">
                Receber alertas no navegador
              </div>
            </div>
            <Switch defaultChecked />
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <div className="text-sm font-medium text-gray-900">Tema escuro</div>
              <div className="text-xs text-gray-500">Ativar modo escuro</div>
            </div>
            <Switch />
          </div>
        </div>
      </div>
    </div>
  );
}
