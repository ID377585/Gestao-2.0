"use client";

import { useEffect, useState } from "react";
import { listFinancialHistory } from "@/lib/financeiro/financial-history";
import type { FinancialHistoryEntry } from "@/types/compras";

function actionLabel(action: FinancialHistoryEntry["action"]) {
  switch (action) {
    case "criado":
      return "Criado";
    case "editado":
      return "Editado";
    case "pago":
      return "Pago";
    case "recebido":
      return "Recebido";
    case "cancelado":
      return "Cancelado";
    case "pendente":
      return "Pendente";
    case "conciliado_banco":
      return "Conciliado no banco";
    case "desconciliado_banco":
      return "Desconciliado no banco";
    default:
      return action;
  }
}

export default function FinancialHistoryCard({
  financeType,
  financeId,
}: {
  financeType: "pagar" | "receber";
  financeId: string;
}) {
  const [items, setItems] = useState<FinancialHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    try {
      setLoading(true);
      const data = await listFinancialHistory({ financeType, financeId });
      setItems(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (financeId) {
      loadData();
    }
  }, [financeId, financeType]);

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">Histórico financeiro</h2>

      {loading ? (
        <p className="text-sm text-gray-500">Carregando histórico...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhum evento registrado.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border p-4">
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <div className="font-medium">{item.title}</div>
                <div className="text-xs text-gray-500">
                  {item.createdAt
                    ? new Date(item.createdAt).toLocaleString("pt-BR")
                    : "-"}
                </div>
              </div>

              <div className="mt-1 text-sm text-gray-600">
                Ação: {actionLabel(item.action)}
              </div>

              {item.description ? (
                <div className="mt-1 text-sm text-gray-600">
                  {item.description}
                </div>
              ) : null}

              {item.bankAccountName ? (
                <div className="mt-1 text-sm text-gray-600">
                  Conta bancária: {item.bankAccountName}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}