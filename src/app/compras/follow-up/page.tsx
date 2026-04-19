"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { listSuppliers } from "@/lib/compras/suppliers";
import {
  listSupplierActionPlanItems,
  listSupplierContactHistory,
  listSupplierScoreReviews,
} from "@/lib/compras/supplier-action-plan";
import type {
  Supplier,
  SupplierActionPlanItem,
  SupplierContactHistoryItem,
  SupplierScoreReviewItem,
} from "@/types/compras";

type FollowUpRow =
  | {
      id: string;
      type: "acao_atrasada";
      supplierId: string;
      supplierName: string;
      title: string;
      description: string;
      dueDate: string;
      priority: "alta" | "media" | "baixa";
      status: string;
      assignedTo?: string;
    }
  | {
      id: string;
      type: "followup_pendente";
      supplierId: string;
      supplierName: string;
      title: string;
      description: string;
      dueDate: string;
      priority: "media";
      status: string;
      assignedTo?: string;
    }
  | {
      id: string;
      type: "reavaliacao_vencida";
      supplierId: string;
      supplierName: string;
      title: string;
      description: string;
      dueDate: string;
      priority: "alta";
      status: string;
      assignedTo?: string;
    };

function priorityClass(priority: "alta" | "media" | "baixa") {
  switch (priority) {
    case "alta":
      return "bg-red-100 text-red-800";
    case "media":
      return "bg-yellow-100 text-yellow-800";
    case "baixa":
      return "bg-blue-100 text-blue-800";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function typeLabel(type: FollowUpRow["type"]) {
  switch (type) {
    case "acao_atrasada":
      return "Ação atrasada";
    case "followup_pendente":
      return "Follow-up pendente";
    case "reavaliacao_vencida":
      return "Reavaliação vencida";
    default:
      return type;
  }
}

function diffDays(from?: string, to?: string) {
  if (!from || !to) return 0;

  const start = new Date(from);
  const end = new Date(to);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 0;
  }

  const diffMs = end.getTime() - start.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

export default function ComprasFollowUpPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [rows, setRows] = useState<FollowUpRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [typeFilter, setTypeFilter] = useState<
    "todos" | "acao_atrasada" | "followup_pendente" | "reavaliacao_vencida"
  >("todos");
  const [search, setSearch] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const suppliersData = await listSuppliers();
      setSuppliers(suppliersData);

      const allRows: FollowUpRow[] = [];
      const today = todayYmd();

      for (const supplier of suppliersData) {
        const [actions, contacts, reviews] = await Promise.all([
          listSupplierActionPlanItems(supplier.id),
          listSupplierContactHistory(supplier.id),
          listSupplierScoreReviews(supplier.id),
        ]);

        const overdueActions = actions.filter(
          (item: SupplierActionPlanItem) =>
            item.status !== "concluido" &&
            item.status !== "cancelado" &&
            item.dueDate &&
            item.dueDate < today
        );

        for (const item of overdueActions) {
          allRows.push({
            id: `acao_${item.id}`,
            type: "acao_atrasada",
            supplierId: supplier.id,
            supplierName: supplier.razaoSocial,
            title: item.title,
            description: item.description || "Ação vencida no plano do fornecedor.",
            dueDate: item.dueDate || "",
            priority: item.priority,
            status: item.status,
            assignedTo: item.assignedTo,
          });
        }

        const pendingContacts = contacts.filter(
          (item: SupplierContactHistoryItem) =>
            item.nextFollowUpDate &&
            item.nextFollowUpDate <= today
        );

        for (const item of pendingContacts) {
          allRows.push({
            id: `followup_${item.id}`,
            type: "followup_pendente",
            supplierId: supplier.id,
            supplierName: supplier.razaoSocial,
            title: item.subject,
            description: item.notes || "Contato exige retorno.",
            dueDate: item.nextFollowUpDate || "",
            priority: "media",
            status: item.contactType,
            assignedTo: item.createdBy,
          });
        }

        const overdueReviews = reviews.filter(
          (item: SupplierScoreReviewItem) =>
            item.status === "agendada" &&
            item.scheduledDate &&
            item.scheduledDate < today
        );

        for (const item of overdueReviews) {
          allRows.push({
            id: `review_${item.id}`,
            type: "reavaliacao_vencida",
            supplierId: supplier.id,
            supplierName: supplier.razaoSocial,
            title: "Reavaliação de score pendente",
            description: item.notes || "Reavaliação programada ainda não realizada.",
            dueDate: item.scheduledDate,
            priority: "alta",
            status: item.status,
            assignedTo: item.createdBy,
          });
        }
      }

      allRows.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      setRows(allRows);
    } catch (err) {
      console.error(err);
      setError("Não foi possível carregar a central de follow-up.");
    } finally {
      setLoading(false);
    }
  }

  const filteredRows = useMemo(() => {
    return rows.filter((item) => {
      const typeOk = typeFilter === "todos" || item.type === typeFilter;

      const searchOk =
        !search ||
        item.supplierName.toLowerCase().includes(search.toLowerCase()) ||
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        item.description.toLowerCase().includes(search.toLowerCase());

      return typeOk && searchOk;
    });
  }, [rows, typeFilter, search]);

  const metrics = useMemo(() => {
    return {
      total: filteredRows.length,
      acoesAtrasadas: filteredRows.filter((item) => item.type === "acao_atrasada").length,
      followUps: filteredRows.filter((item) => item.type === "followup_pendente").length,
      reavaliacoes: filteredRows.filter((item) => item.type === "reavaliacao_vencida").length,
    };
  }, [filteredRows]);

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Central de Follow-up</h1>
          <p className="text-sm text-gray-500">
            Acompanhe ações vencidas, retornos pendentes e reavaliações de fornecedores.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/compras/fornecedores"
            className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Fornecedores
          </Link>

          <Link
            href="/compras/alertas"
            className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Ver alertas
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Itens</div>
          <div className="mt-2 text-2xl font-bold">{metrics.total}</div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Ações atrasadas</div>
          <div className="mt-2 text-2xl font-bold">{metrics.acoesAtrasadas}</div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Follow-ups</div>
          <div className="mt-2 text-2xl font-bold">{metrics.followUps}</div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Reavaliações vencidas</div>
          <div className="mt-2 text-2xl font-bold">{metrics.reavaliacoes}</div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Tipo</label>
            <select
              value={typeFilter}
              onChange={(e) =>
                setTypeFilter(
                  e.target.value as
                    | "todos"
                    | "acao_atrasada"
                    | "followup_pendente"
                    | "reavaliacao_vencida"
                )
              }
              className="w-full rounded-xl border px-3 py-2 outline-none"
            >
              <option value="todos">Todos</option>
              <option value="acao_atrasada">Ações atrasadas</option>
              <option value="followup_pendente">Follow-ups pendentes</option>
              <option value="reavaliacao_vencida">Reavaliações vencidas</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Buscar</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none"
              placeholder="Fornecedor, título ou descrição"
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        {loading ? (
          <p className="text-sm text-gray-500">Carregando follow-ups...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : filteredRows.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum item pendente encontrado.</p>
        ) : (
          <div className="space-y-3">
            {filteredRows.map((item) => (
              <div key={item.id} className="rounded-xl border p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-medium">{item.title}</div>
                    <div className="text-sm text-gray-500">
                      {typeLabel(item.type)} • {item.supplierName}
                    </div>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${priorityClass(
                      item.priority
                    )}`}
                  >
                    {item.priority}
                  </span>
                </div>

                <div className="mt-2 text-sm text-gray-700">{item.description}</div>

                <div className="mt-2 text-xs text-gray-500">
                  Vencimento: {item.dueDate || "-"} • Responsável: {item.assignedTo || "-"} •
                  Atraso: {diffDays(item.dueDate, todayYmd()) > 0 ? `${diffDays(item.dueDate, todayYmd())} dia(s)` : "Hoje"}
                </div>

                <div className="mt-3">
                  <Link
                    href={`/compras/fornecedores/${item.supplierId}/plano-de-acao`}
                    className="text-sm font-medium underline"
                  >
                    Abrir plano de ação
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}