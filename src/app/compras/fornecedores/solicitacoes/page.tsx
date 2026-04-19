"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  listPurchaseRequests,
  updatePurchaseRequestStatus,
} from "@/lib/compras/requests";
import { buildCreatedByLabel, getCurrentUserInfo } from "@/lib/auth/current-user";
import type { PurchaseRequest, PurchaseRequestStatus } from "@/types/compras";
import { usePurchaseHistory } from "@/hooks/use-purchase-history";

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

function priorityClass(priority: PurchaseRequest["prioridade"]) {
  switch (priority) {
    case "baixa":
      return "bg-gray-100 text-gray-700";
    case "media":
      return "bg-orange-100 text-orange-700";
    case "alta":
      return "bg-red-100 text-red-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

export default function SolicitacoesPage() {
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      setError("");
      const data = await listPurchaseRequests();
      setRequests(data);
    } catch (err) {
      console.error(err);
      setError("Não foi possível carregar as solicitações.");
    } finally {
      setLoading(false);
    }
  }

  const { createPurchaseHistoryEntryWithUser } = usePurchaseHistory();

  async function handleStatusChange(
    id: string,
    status: PurchaseRequestStatus
  ) {
    try {
      const currentUser = await getCurrentUserInfo();

      await updatePurchaseRequestStatus(id, status, {
        userId: currentUser?.id ?? "",
        userName: buildCreatedByLabel(currentUser),
      });

      await createPurchaseHistoryEntryWithUser({
  entityType: "solicitacao",
  entityId: id,
  action: "solicitacao_status_alterado",
  title: "Status da solicitação alterado",
  description: `Novo status: ${status}`,
});

      await loadData();
    } catch (err) {
      console.error(err);
      alert("Não foi possível atualizar o status.");
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Solicitações de compra</h1>
          <p className="text-sm text-gray-500">
            Controle as demandas internas antes da geração dos pedidos.
          </p>
        </div>

        <Link
          href="/compras/solicitacoes/nova"
          className="inline-flex items-center justify-center rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
        >
          Nova solicitação
        </Link>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        {loading ? (
          <p className="text-sm text-gray-500">Carregando solicitações...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : requests.length === 0 ? (
          <p className="text-sm text-gray-500">
            Nenhuma solicitação cadastrada ainda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left">
                  <th className="px-4 py-3 font-medium">Número</th>
                  <th className="px-4 py-3 font-medium">Setor</th>
                  <th className="px-4 py-3 font-medium">Solicitante</th>
                  <th className="px-4 py-3 font-medium">Prioridade</th>
                  <th className="px-4 py-3 font-medium">Itens</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="px-4 py-3 font-medium">{item.numero}</td>
                    <td className="px-4 py-3">{item.setorSolicitante}</td>
                    <td className="px-4 py-3">{item.solicitanteNome}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${priorityClass(
                          item.prioridade
                        )}`}
                      >
                        {priorityLabel(item.prioridade)}
                      </span>
                    </td>
                    <td className="px-4 py-3">{item.totalItens}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${statusClass(
                          item.status
                        )}`}
                      >
                        {statusLabel(item.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {item.dataSolicitacao
                        ? new Date(item.dataSolicitacao).toLocaleDateString("pt-BR")
                        : "-"}
                    </td>
                    <td className="px-4 py-3">
  <div className="flex gap-2">
    <Link
      href={`/compras/solicitacoes/${item.id}`}
      className="rounded-lg border px-3 py-1 text-xs font-medium hover:bg-gray-50"
    >
      Abrir
    </Link>

    <select
      value={item.status}
      onChange={(e) =>
        handleStatusChange(
          item.id,
          e.target.value as PurchaseRequestStatus
        )
      }
      className="rounded-lg border px-2 py-1 text-xs"
    >
      <option value="pendente">Pendente</option>
      <option value="em_cotacao">Em cotação</option>
      <option value="aprovada">Aprovada</option>
      <option value="rejeitada">Rejeitada</option>
      <option value="convertida">Convertida</option>
    </select>
  </div>
</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}