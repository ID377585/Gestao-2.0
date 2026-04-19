"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getPurchaseRequestById,
  listPurchaseRequestItems,
} from "@/lib/compras/requests";
import PurchaseHistoryCard from "@/components/compras/purchase-history-card";
import type {
  PurchaseRequest,
  PurchaseRequestItem,
  PurchaseRequestStatus,
} from "@/types/compras";

function statusLabel(status: PurchaseRequestStatus) {
  switch (status) {
    case "pendente":
      return "Pendente";
    case "em_cotacao":
      return "Em cotação";
    case "aprovada":
      return "Aprovada";
    case "rejeitada":
      return "Rejeitada";
    case "convertida":
      return "Convertida";
    default:
      return status;
  }
}

function statusClass(status: PurchaseRequestStatus) {
  switch (status) {
    case "pendente":
      return "bg-yellow-100 text-yellow-800";
    case "em_cotacao":
      return "bg-blue-100 text-blue-800";
    case "aprovada":
      return "bg-green-100 text-green-800";
    case "rejeitada":
      return "bg-red-100 text-red-800";
    case "convertida":
      return "bg-purple-100 text-purple-800";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function priorityLabel(priority: PurchaseRequest["prioridade"]) {
  switch (priority) {
    case "baixa":
      return "Baixa";
    case "media":
      return "Média";
    case "alta":
      return "Alta";
    default:
      return priority;
  }
}

export default function SolicitacaoDetalhePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const requestId = params.id;

  const [request, setRequest] = useState<PurchaseRequest | null>(null);
  const [items, setItems] = useState<PurchaseRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const requestData = await getPurchaseRequestById(requestId);

      if (!requestData) {
        setError("Solicitação não encontrada.");
        setLoading(false);
        return;
      }

      setRequest(requestData);

      const itemsData = await listPurchaseRequestItems(requestId);
      setItems(itemsData);
    } catch (err) {
      console.error(err);
      setError("Não foi possível carregar a solicitação.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (requestId) {
      loadData();
    }
  }, [requestId]);

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500">Carregando solicitação...</p>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="space-y-4 p-6">
        <p className="text-sm text-red-600">
          {error || "Solicitação não encontrada."}
        </p>
        <button
          onClick={() => router.push("/compras/solicitacoes")}
          className="rounded-xl border px-4 py-2 text-sm font-medium"
        >
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Solicitação {request.numero}</h1>
          <p className="text-sm text-gray-500">
            {request.setorSolicitante} • {request.solicitanteNome}
          </p>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-sm font-medium ${statusClass(
            request.status
          )}`}
        >
          {statusLabel(request.status)}
        </span>
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Dados da solicitação</h2>

        <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2 xl:grid-cols-4">
          <div>
            <span className="font-medium">Setor:</span>{" "}
            {request.setorSolicitante}
          </div>
          <div>
            <span className="font-medium">Solicitante:</span>{" "}
            {request.solicitanteNome}
          </div>
          <div>
            <span className="font-medium">Prioridade:</span>{" "}
            {priorityLabel(request.prioridade)}
          </div>
          <div>
            <span className="font-medium">Itens:</span> {request.totalItens}
          </div>
        </div>

        {request.observacoes ? (
          <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm">
            <span className="font-medium">Observações:</span>{" "}
            {request.observacoes}
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Itens da solicitação</h2>

        {items.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum item encontrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left">
                  <th className="px-4 py-3 font-medium">Produto</th>
                  <th className="px-4 py-3 font-medium">Unidade</th>
                  <th className="px-4 py-3 font-medium">Quantidade</th>
                  <th className="px-4 py-3 font-medium">Observação</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="px-4 py-3 font-medium">
                      {item.produtoNome}
                    </td>
                    <td className="px-4 py-3">{item.unidade}</td>
                    <td className="px-4 py-3">{item.quantidade}</td>
                    <td className="px-4 py-3">{item.observacao || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PurchaseHistoryCard entityType="solicitacao" entityId={request.id} />
    </div>
  );
}