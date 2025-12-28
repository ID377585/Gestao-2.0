"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { linkLabelToOrder } from "../actions";

type Props = {
  orderId: string;
};

export function LinkLabelDebug({ orderId }: Props) {
  const [labelCode, setLabelCode] = useState("LBL-FT-TESTE-001");
  const [qtyToUse, setQtyToUse] = useState<string>("");
  const [result, setResult] = useState<any | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      try {
        const payload: any = {
          orderId,
          labelCode: labelCode.trim(),
        };

        if (qtyToUse.trim()) {
          payload.qtyToUse = Number(qtyToUse.replace(",", "."));
        }

        const res = await linkLabelToOrder(payload);
        setResult(res);
        alert(
          `Movimento criado!\n\n` +
            `Movimento: ${res.movementId}\n` +
            `Saldo antes: ${res.availableQtyBefore}\n` +
            `Saldo depois: ${res.availableQtyAfter}`
        );
      } catch (err: any) {
        console.error(err);
        alert(err?.message ?? "Erro ao vincular etiqueta");
      }
    });
  }

  return (
    <div className="mt-6 rounded-lg border p-4 space-y-3">
      <h3 className="font-semibold text-sm">
        ⚙️ Teste rápido – Vincular etiqueta ao pedido
      </h3>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex-1">
          <label className="text-xs font-medium">
            Código da etiqueta (label_code)
          </label>
          <Input
            value={labelCode}
            onChange={(e) => setLabelCode(e.target.value)}
            placeholder="Ex: LBL-FT-TESTE-001"
          />
        </div>

        <div className="w-32">
          <label className="text-xs font-medium">
            Quantidade (opcional)
          </label>
          <Input
            value={qtyToUse}
            onChange={(e) => setQtyToUse(e.target.value)}
            placeholder="10"
          />
        </div>

        <div className="self-end">
          <Button onClick={handleClick} disabled={isPending}>
            {isPending ? "Processando..." : "Usar etiqueta"}
          </Button>
        </div>
      </div>

      {result && (
        <pre className="mt-2 rounded bg-muted p-2 text-xs overflow-x-auto">
{JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
