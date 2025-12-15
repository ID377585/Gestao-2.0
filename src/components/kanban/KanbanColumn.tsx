"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { KanbanCard } from "@/components/kanban/KanbanCard";
import type { KanbanColumnDef, Pedido } from "@/components/kanban/kanban.types";
import { borderColorByStatus, statusConfig } from "@/components/kanban/kanban.utils";

type Props = {
  coluna: KanbanColumnDef;
  pedidos: Pedido[];
  formatCurrency: (value: number) => string;
  formatDate: (dateString: string) => string;
};

export function KanbanColumn({ coluna, pedidos, formatCurrency, formatDate }: Props) {
  return (
    <div className="bg-gray-50 rounded-lg p-2.5 min-w-[260px] lg:min-w-0 flex-shrink-0">
      {/* Header da coluna */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-gray-900 text-xs lg:text-sm truncate pr-2">
          {coluna.title}
        </h3>
        <Badge variant="secondary" className="flex-shrink-0 text-xs px-1.5 py-0.5">
          {pedidos.length}
        </Badge>
      </div>

      {/* Cards */}
      <div className="space-y-2">
        {pedidos.map((pedido) => (
          <KanbanCard
            key={pedido.id}
            pedido={pedido}
            statusInfo={statusConfig[pedido.status]}
            borderColorClass={borderColorByStatus[pedido.status] ?? "border-l-slate-300"}
            formatCurrency={formatCurrency}
            formatDate={formatDate}
          />
        ))}

        {pedidos.length === 0 && (
          <div className="text-center py-6 text-gray-400">
            <span className="text-xl block mb-1">📋</span>
            <p className="text-xs">Nenhum pedido</p>
          </div>
        )}
      </div>
    </div>
  );
}
