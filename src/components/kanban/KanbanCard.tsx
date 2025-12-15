"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export interface Pedido {
  id: number;
  estabelecimento: string;
  dataEntrega: string;
  valorTotal: number;
  status: string;
  itens: number;
  progresso: number;
}

type StatusConfigItem = {
  label: string;
  color: string; // ex: "bg-blue-500"
  textColor?: string; // opcional
};

type Props = {
  pedido: Pedido;
  statusInfo?: StatusConfigItem;
  borderColorClass?: string; // ex: "border-l-blue-400"
  formatCurrency: (value: number) => string;
  formatDate: (dateString: string) => string;
};

export function KanbanCard({
  pedido,
  statusInfo,
  borderColorClass = "border-l-slate-300",
  formatCurrency,
  formatDate,
}: Props) {
  return (
    <Card
      className={[
        "cursor-pointer hover:shadow-md transition-shadow",
        "rounded-xl",
        "border-l-4",
        borderColorClass,
      ].join(" ")}
    >
      <CardHeader className="px-3 pt-3 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-sm font-semibold leading-none">
              #{pedido.id}
            </CardTitle>
            <p className="mt-1 text-xs text-gray-600 truncate">
              {pedido.estabelecimento}
            </p>
          </div>

          <Badge
            variant="secondary"
            className={[
              "text-[11px] px-2 py-0.5 text-white",
              statusInfo?.color ?? "bg-gray-500",
            ].join(" ")}
          >
            {statusInfo?.label ?? pedido.status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="px-3 pb-3 pt-0">
        {/* Grid de infos (fica muito mais legível) */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-gray-500">
              Valor
            </div>
            <div className="font-semibold text-green-600">
              {formatCurrency(pedido.valorTotal)}
            </div>
          </div>

          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wide text-gray-500">
              Itens
            </div>
            <div className="font-semibold text-gray-900">{pedido.itens}</div>
          </div>

          <div className="col-span-2">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-wide text-gray-500">
                Entrega
              </div>
              <div className="font-medium text-gray-800">
                {formatDate(pedido.dataEntrega)}
              </div>
            </div>
          </div>

          <div className="col-span-2 mt-1">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-wide text-gray-500">
                Progresso
              </div>
              <div className="text-xs font-semibold text-gray-700">
                {pedido.progresso}%
              </div>
            </div>

            <div className="mt-1">
              <Progress value={pedido.progresso} className="h-2" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
