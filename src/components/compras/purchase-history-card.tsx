"use client";

import { useEffect, useState } from "react";
import { listPurchaseHistory } from "@/lib/compras/purchase-history";
import type {
  PurchaseHistoryEntry,
  PurchaseHistoryEntityType,
} from "@/types/compras";

function actionLabel(action: PurchaseHistoryEntry["action"]) {
  switch (action) {
    case "solicitacao_criada":
      return "Solicitação criada";
    case "solicitacao_status_alterado":
      return "Status alterado";
    case "pedido_criado":
      return "Pedido criado";
    case "solicitacao_convertida":
      return "Solicitação convertida";
    case "recebimento_iniciado":
      return "Recebimento iniciado";
    case "recebimento_finalizado":
      return "Recebimento finalizado";
    default:
      return action;
  }
}

export default function PurchaseHistoryCard({
  entityType,
  entityId,
}: {
  entityType: PurchaseHistoryEntityType;
  entityId: string;
}) {
  const [items, setItems] = useState<PurchaseHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    try {
      setLoading(true);
      const data = await listPurchaseHistory({ entityType, entityId });
      setItems(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (entityId) {
      loadData();
    }
  }, [entityId, entityType]);

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">Histórico operacional</h2>

      {loading ? (
        <p className="text-sm text-gray-500">Carregando histórico...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhum evento registrado.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
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

              {item.relatedEntityType && item.relatedEntityId ? (
                <div className="mt-1 text-sm text-gray-600">
                  Relacionado: {item.relatedEntityType} • {item.relatedEntityId}
                </div>
              ) : null}

              {item.createdBy ? (
                <div className="mt-1 text-sm text-gray-600">
                  Usuário: {item.createdBy}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}