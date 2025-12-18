"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";

type OrderStatus =
  | "pedido_criado"
  | "aceitou_pedido"
  | "em_preparo"
  | "em_separacao"
  | "em_faturamento"
  | "em_transporte"
  | "entregue"
  | "cancelado"
  | "reaberto"
  | string;

const STEPS: { key: OrderStatus; label: string }[] = [
  { key: "pedido_criado", label: "Pedido criado" },
  { key: "aceitou_pedido", label: "Aceito" },
  { key: "em_preparo", label: "Preparo" },
  { key: "em_separacao", label: "Separação" },
  { key: "em_faturamento", label: "Faturamento" },
  { key: "em_transporte", label: "Transporte" },
  { key: "entregue", label: "Entregue" },
];

function clampIndex(idx: number) {
  if (idx < 0) return 0;
  if (idx > STEPS.length - 1) return STEPS.length - 1;
  return idx;
}

export function OrderStatusStepper({
  status,
  className,
}: {
  status: OrderStatus;
  className?: string;
}) {
  const currentIndex = STEPS.findIndex((s) => s.key === status);

  // status fora do pipeline (ex.: cancelado/reaberto) → não tenta “inventar” index
  const inPipeline = currentIndex >= 0;

  if (status === "cancelado") {
    return (
      <div className={className}>
        <div className="rounded-lg border p-3 bg-white">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium">Status do pedido</div>
            <Badge variant="destructive">Cancelado</Badge>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Este pedido foi cancelado e não avança no fluxo.
          </div>
        </div>
      </div>
    );
  }

  if (status === "reaberto") {
    return (
      <div className={className}>
        <div className="rounded-lg border p-3 bg-white">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium">Status do pedido</div>
            <Badge variant="secondary">Reaberto</Badge>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Pedido reaberto. O próximo avanço dependerá da regra operacional.
          </div>
        </div>
      </div>
    );
  }

  // Se por algum motivo vier um status que não está no pipeline, só mostramos texto
  if (!inPipeline) {
    return (
      <div className={className}>
        <div className="rounded-lg border p-3 bg-white">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium">Status do pedido</div>
            <Badge variant="outline">{String(status)}</Badge>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Status fora do pipeline principal.
          </div>
        </div>
      </div>
    );
  }

  const idx = clampIndex(currentIndex);

  return (
    <div className={className}>
      <div className="rounded-lg border p-4 bg-white">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium">Linha do tempo do pedido</div>
          <Badge variant={status === "entregue" ? "default" : "outline"}>
            {STEPS[idx].label}
          </Badge>
        </div>

        {/* Stepper */}
        <div className="mt-4">
          <div className="flex items-center">
            {STEPS.map((step, i) => {
              const done = i < idx;
              const active = i === idx;

              return (
                <React.Fragment key={step.key}>
                  <div className="flex flex-col items-center">
                    {/* bolinha */}
                    <div
                      className={[
                        "h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold border",
                        done ? "bg-black text-white border-black" : "",
                        active ? "bg-white text-black border-black" : "",
                        !done && !active ? "bg-white text-muted-foreground border-gray-300" : "",
                      ].join(" ")}
                      aria-label={step.label}
                      title={step.label}
                    >
                      {done ? "✓" : i + 1}
                    </div>

                    {/* label */}
                    <div
                      className={[
                        "mt-2 text-[11px] leading-tight text-center w-20",
                        active ? "text-black font-medium" : "text-muted-foreground",
                      ].join(" ")}
                    >
                      {step.label}
                    </div>
                  </div>

                  {/* linha */}
                  {i !== STEPS.length - 1 && (
                    <div
                      className={[
                        "flex-1 h-[2px] mx-2",
                        i < idx ? "bg-black" : "bg-gray-200",
                      ].join(" ")}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          <div className="mt-3 text-xs text-muted-foreground">
            *As etapas anteriores ficam marcadas como concluídas automaticamente.
          </div>
        </div>
      </div>
    </div>
  );
}
