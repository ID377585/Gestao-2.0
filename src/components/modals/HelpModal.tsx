"use client";

import { Button } from "@/components/ui/button";

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

export function HelpModal({ open, onClose }: HelpModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-lg border border-gray-200 bg-white p-6 shadow-lg dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100">
            Ajuda
          </h3>
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </div>

        <div className="space-y-3 text-sm text-gray-700 dark:text-slate-300">
          <p>
            Aqui você pode colocar documentação, vídeos, perguntas frequentes
            ou um passo a passo de uso do sistema.
          </p>

          <div className="rounded-md border border-gray-200 p-4 dark:border-slate-700 dark:bg-slate-800/60">
            <div className="text-sm font-semibold text-gray-900 dark:text-slate-100">
              Atalhos
            </div>
            <ul className="mt-2 list-disc pl-5 text-sm text-gray-700 dark:text-slate-300">
              <li>Pedidos: acompanhar pedidos criados e status</li>
              <li>Produção: controlar execução e andamento</li>
              <li>Estoque: monitorar níveis e alertas</li>
              <li>Inventário: registrar conferências e ajustes</li>
            </ul>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={onClose}>Fechar</Button>
        </div>
      </div>
    </div>
  );
}