"use client";

import { Button } from "@/components/ui/button";

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

export function HelpModal({ open, onClose }: HelpModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">Ajuda</h3>
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </div>

        <div className="space-y-3 text-sm text-gray-700">
          <p>
            Aqui você pode colocar links para documentação, vídeos ou um passo a
            passo de uso do sistema.
          </p>

          <div className="rounded-md border p-4">
            <div className="text-sm font-semibold text-gray-900">Atalhos</div>
            <ul className="mt-2 list-disc pl-5 text-sm text-gray-700">
              <li>Pedidos: acompanhar fluxo no Kanban</li>
              <li>Produção: controlar etapas e prazos</li>
              <li>Estoque: alertas e inventários</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
