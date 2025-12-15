"use client";

import { KanbanColumn } from "@/components/kanban/KanbanColumn";
import type { Pedido, KanbanColumnDef } from "@/components/kanban/kanban.types";
import { formatCurrencyBRL, formatDateBR } from "@/components/kanban/kanban.utils";

interface KanbanBoardProps {
  pedidos: Pedido[];
}

const colunas: KanbanColumnDef[] = [
  { key: "criado", title: "Criado" },
  { key: "em_preparo", title: "Em Preparo" },
  { key: "separacao", title: "Separação" },
  { key: "conferencia", title: "Conferência" },
  { key: "saiu_entrega", title: "Saiu p/ Entrega" },
  { key: "entrega_concluida", title: "Concluído" },
];

export function KanbanBoard({ pedidos }: KanbanBoardProps) {
  return (
    <div className="bg-white rounded-lg border">
      <div className="p-4 lg:p-6">
        <h2 className="text-xl font-semibold mb-4">Kanban de Pedidos</h2>

        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3 min-w-max lg:grid lg:grid-cols-3 xl:grid-cols-6 lg:gap-2 xl:gap-3 min-h-[600px]">
            {colunas.map((coluna) => {
              const pedidosDaColuna = pedidos.filter(
                (p) => p.status === coluna.key
              );

              return (
                <KanbanColumn
                  key={coluna.key}
                  coluna={coluna}
                  pedidos={pedidosDaColuna}
                  formatCurrency={formatCurrencyBRL}
                  formatDate={formatDateBR}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
