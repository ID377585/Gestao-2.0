"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { buildCreatedByLabel, getCurrentUserInfo } from "@/lib/auth/current-user";
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

type DailyTaskRow =
  | {
      id: string;
      kind: "acao_do_dia";
      supplierId: string;
      supplierName: string;
      title: string;
      description: string;
      date: string;
      priority: "alta" | "media" | "baixa";
      assignedTo?: string;
    }
  | {
      id: string;
      kind: "followup_do_dia";
      supplierId: string;
      supplierName: string;
      title: string;
      description: string;
      date: string;
      priority: "media";
      assignedTo?: string;
    }
  | {
      id: string;
      kind: "reavaliacao_do_dia";
      supplierId: string;
      supplierName: string;
      title: string;
      description: string;
      date: string;
      priority: "alta";
      assignedTo?: string;
    };

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

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

function kindLabel(kind: DailyTaskRow["kind"]) {
  switch (kind) {
    case "acao_do_dia":
      return "Ação do dia";
    case "followup_do_dia":
      return "Contato do dia";
    case "reavaliacao_do_dia":
      return "Reavaliação do dia";
    default:
      return kind;
  }
}

export default function ComprasDashboardDiarioPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [rows, setRows] = useState<DailyTaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentUserLabel, setCurrentUserLabel] = useState("");

  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<
    "todos" | "acao_do_dia" | "followup_do_dia" | "reavaliacao_do_dia"
  >("todos");

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const currentUser = await getCurrentUserInfo();
      const actor = buildCreatedByLabel(currentUser);
      setCurrentUserLabel(actor);

      const suppliersData = await listSuppliers();
      setSuppliers(suppliersData);

      const allRows: DailyTaskRow[] = [];
      const today = todayYmd();

      for (const supplier of suppliersData) {
        const [actions, contacts, reviews] = await Promise.all([
          listSupplierActionPlanItems(supplier.id),
          listSupplierContactHistory(supplier.id),
          listSupplierScoreReviews(supplier.id),
        ]);

        const actionsToday = actions.filter(
          (item: SupplierActionPlanItem) =>
            item.status !== "concluido" &&
            item.status !== "cancelado" &&
            item.dueDate === today
        );

        for (const item of actionsToday) {
          allRows.push({
            id: `acao_${item.id}`,
            kind: "acao_do_dia",
            supplierId: supplier.id,
            supplierName: supplier.razaoSocial,
            title: item.title,
            description: item.description || "Ação prevista para hoje.",
            date: item.dueDate || today,
            priority: item.priority,
            assignedTo: item.assignedTo,
          });
        }

        const contactsToday = contacts.filter(
          (item: SupplierContactHistoryItem) =>
            item.nextFollowUpDate === today
        );

        for (const item of contactsToday) {
          allRows.push({
            id: `followup_${item.id}`,
            kind: "followup_do_dia",
            supplierId: supplier.id,
            supplierName: supplier.razaoSocial,
            title: item.subject,
            description: item.notes || "Contato programado para hoje.",
            date: item.nextFollowUpDate || today,
            priority: "media",
            assignedTo: item.createdBy,
          });
        }

        const reviewsToday = reviews.filter(
          (item: SupplierScoreReviewItem) =>
            item.status === "agendada" &&
            item.scheduledDate === today
        );

        for (const item of reviewsToday) {
          allRows.push({
            id: `review_${item.id}`,
            kind: "reavaliacao_do_dia",
            supplierId: supplier.id,
            supplierName: supplier.razaoSocial,
            title: "Reavaliar score do fornecedor",
            description: item.notes || "Reavaliação agendada para hoje.",
            date: item.scheduledDate,
            priority: "alta",
            assignedTo: item.createdBy,
          });
        }
      }

      allRows.sort((a, b) => {
        const weight = { alta: 3, media: 2, baixa: 1 };
        return weight[b.priority] - weight[a.priority];
      });

      setRows(allRows);
    } catch (err) {
      console.error(err);
      setError("Não foi possível carregar o dashboard diário.");
    } finally {
      setLoading(false);
    }
  }

  const filteredRows = useMemo(() => {
    return rows.filter((item) => {
      const kindOk = kindFilter === "todos" || item.kind === kindFilter;

      const searchOk =
        !search ||
        item.supplierName.toLowerCase().includes(search.toLowerCase()) ||
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        item.description.toLowerCase().includes(search.toLowerCase());

      return kindOk && searchOk;
    });
  }, [rows, kindFilter, search]);

  const metrics = useMemo(() => {
    return {
      total: filteredRows.length,
      acoes: filteredRows.filter((item) => item.kind === "acao_do_dia").length,
      contatos: filteredRows.filter((item) => item.kind === "followup_do_dia").length,
      reviews: filteredRows.filter((item) => item.kind === "reavaliacao_do_dia").length,
    };
  }, [filteredRows]);

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard Diário do Comprador</h1>
          <p className="text-sm text-gray-500">
            Agenda operacional do dia para follow-up e tratativas.
          </p>
          {currentUserLabel ? (
            <p className="mt-1 text-xs text-gray-500">
              Usuário atual: {currentUserLabel}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/compras/follow-up"
            className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Central de follow-up
          </Link>

          <Link
            href="/compras/fornecedores"
            className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Fornecedores
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Tarefas do dia</div>
          <div className="mt-2 text-2xl font-bold">{metrics.total}</div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Ações</div>
          <div className="mt-2 text-2xl font-bold">{metrics.acoes}</div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Contatos</div>
          <div className="mt-2 text-2xl font-bold">{metrics.contatos}</div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Reavaliações</div>
          <div className="mt-2 text-2xl font-bold">{metrics.reviews}</div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Tipo</label>
            <select
              value={kindFilter}
              onChange={(e) =>
                setKindFilter(
                  e.target.value as
                    | "todos"
                    | "acao_do_dia"
                    | "followup_do_dia"
                    | "reavaliacao_do_dia"
                )
              }
              className="w-full rounded-xl border px-3 py-2 outline-none"
            >
              <option value="todos">Todos</option>
              <option value="acao_do_dia">Ações</option>
              <option value="followup_do_dia">Contatos</option>
              <option value="reavaliacao_do_dia">Reavaliações</option>
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
          <p className="text-sm text-gray-500">Carregando agenda do dia...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : filteredRows.length === 0 ? (
          <p className="text-sm text-gray-500">
            Nenhuma tarefa programada para hoje.
          </p>
        ) : (
          <div className="space-y-3">
            {filteredRows.map((item) => (
              <div key={item.id} className="rounded-xl border p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-medium">{item.title}</div>
                    <div className="text-sm text-gray-500">
                      {kindLabel(item.kind)} • {item.supplierName}
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

                <div className="mt-2 text-sm text-gray-700">
                  {item.description}
                </div>

                <div className="mt-2 text-xs text-gray-500">
                  Data: {item.date} • Responsável: {item.assignedTo || "-"}
                </div>

                <div className="mt-3">
                  <Link
                    href={`/compras/fornecedores/${item.supplierId}/plano-de-acao`}
                    className="text-sm font-medium underline"
                  >
                    Abrir plano de ação
                  </Link>

                  <Link
                    href="/compras/painel-semanal"
                    className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
                    >
                    Painel semanal
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