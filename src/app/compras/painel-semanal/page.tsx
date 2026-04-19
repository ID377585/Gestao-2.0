"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { listSuppliers } from "@/lib/compras/suppliers";
import {
  listSupplierActionPlanItems,
  listSupplierContactHistory,
  listSupplierScoreReviews,
} from "@/lib/compras/supplier-action-plan";
import {
  buildWeeklyBuyerMetrics,
  isCurrentWeek,
} from "@/lib/compras/weekly-buyer-panel";
import type {
  Supplier,
  SupplierActionPlanItem,
  SupplierContactHistoryItem,
  SupplierScoreReviewItem,
} from "@/types/compras";

type WeeklyRow =
  | {
      id: string;
      type: "acao";
      supplierId: string;
      supplierName: string;
      title: string;
      description: string;
      date: string;
      status: string;
    }
  | {
      id: string;
      type: "contato";
      supplierId: string;
      supplierName: string;
      title: string;
      description: string;
      date: string;
      status: string;
    }
  | {
      id: string;
      type: "reavaliacao";
      supplierId: string;
      supplierName: string;
      title: string;
      description: string;
      date: string;
      status: string;
    };

function typeLabel(type: WeeklyRow["type"]) {
  switch (type) {
    case "acao":
      return "Ação";
    case "contato":
      return "Contato";
    case "reavaliacao":
      return "Reavaliação";
    default:
      return type;
  }
}

export default function ComprasPainelSemanalPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [actions, setActions] = useState<SupplierActionPlanItem[]>([]);
  const [contacts, setContacts] = useState<SupplierContactHistoryItem[]>([]);
  const [reviews, setReviews] = useState<SupplierScoreReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const suppliersData = await listSuppliers();
      setSuppliers(suppliersData);

      const allActions: SupplierActionPlanItem[] = [];
      const allContacts: SupplierContactHistoryItem[] = [];
      const allReviews: SupplierScoreReviewItem[] = [];

      for (const supplier of suppliersData) {
        const [supplierActions, supplierContacts, supplierReviews] =
          await Promise.all([
            listSupplierActionPlanItems(supplier.id),
            listSupplierContactHistory(supplier.id),
            listSupplierScoreReviews(supplier.id),
          ]);

        allActions.push(...supplierActions);
        allContacts.push(...supplierContacts);
        allReviews.push(...supplierReviews);
      }

      setActions(allActions);
      setContacts(allContacts);
      setReviews(allReviews);
    } catch (err) {
      console.error(err);
      setError("Não foi possível carregar o painel semanal.");
    } finally {
      setLoading(false);
    }
  }

  const metrics = useMemo(() => {
    return buildWeeklyBuyerMetrics({
      actions,
      contacts,
      reviews,
    });
  }, [actions, contacts, reviews]);

  const weeklyRows = useMemo(() => {
    const rows: WeeklyRow[] = [];

    for (const item of actions) {
      if (isCurrentWeek(item.updatedAt) || isCurrentWeek(item.dueDate)) {
        rows.push({
          id: `acao_${item.id}`,
          type: "acao",
          supplierId: item.supplierId,
          supplierName: item.supplierName,
          title: item.title,
          description: item.description || "Ação do plano semanal.",
          date: item.updatedAt || item.dueDate || "",
          status: item.status,
        });
      }
    }

    for (const item of contacts) {
      if (isCurrentWeek(item.contactDate)) {
        rows.push({
          id: `contato_${item.id}`,
          type: "contato",
          supplierId: item.supplierId,
          supplierName: item.supplierName,
          title: item.subject,
          description: item.notes || "Contato realizado na semana.",
          date: item.contactDate,
          status: item.contactType,
        });
      }
    }

    for (const item of reviews) {
      if (isCurrentWeek(item.updatedAt) || isCurrentWeek(item.scheduledDate)) {
        rows.push({
          id: `review_${item.id}`,
          type: "reavaliacao",
          supplierId: item.supplierId,
          supplierName: item.supplierName,
          title: "Reavaliação de score",
          description: item.notes || "Movimento de reavaliação na semana.",
          date: item.updatedAt || item.scheduledDate,
          status: item.status,
        });
      }
    }

    return rows
      .filter((item) => {
        if (!search) return true;

        return (
          item.supplierName.toLowerCase().includes(search.toLowerCase()) ||
          item.title.toLowerCase().includes(search.toLowerCase()) ||
          item.description.toLowerCase().includes(search.toLowerCase())
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [actions, contacts, reviews, search]);

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Painel Semanal do Comprador</h1>
          <p className="text-sm text-gray-500">
            Visão consolidada da produtividade e tratativas da semana.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/compras/dashboard-diario"
            className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Dashboard diário
          </Link>

          <Link
            href="/compras/follow-up"
            className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Central de follow-up
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Ações da semana</div>
          <div className="mt-2 text-2xl font-bold">{metrics.totalAcoesSemana}</div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Concluídas</div>
          <div className="mt-2 text-2xl font-bold">{metrics.acoesConcluidasSemana}</div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Atrasadas</div>
          <div className="mt-2 text-2xl font-bold">{metrics.acoesAtrasadasSemana}</div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Contatos realizados</div>
          <div className="mt-2 text-2xl font-bold">{metrics.contatosRealizadosSemana}</div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Produtividade</div>
          <div className="mt-2 text-2xl font-bold">{metrics.produtividadePercentual}%</div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <label className="mb-1 block text-sm font-medium">Buscar</label>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border px-3 py-2 outline-none"
          placeholder="Fornecedor, título ou descrição"
        />
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        {loading ? (
          <p className="text-sm text-gray-500">Carregando painel semanal...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : weeklyRows.length === 0 ? (
          <p className="text-sm text-gray-500">
            Nenhuma movimentação encontrada nesta semana.
          </p>
        ) : (
          <div className="space-y-3">
            {weeklyRows.map((item) => (
              <div key={item.id} className="rounded-xl border p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-medium">{item.title}</div>
                    <div className="text-sm text-gray-500">
                      {typeLabel(item.type)} • {item.supplierName}
                    </div>
                  </div>

                  <div className="text-xs text-gray-500">
                    {item.date ? new Date(item.date).toLocaleString("pt-BR") : "-"}
                  </div>
                </div>

                <div className="mt-2 text-sm text-gray-700">{item.description}</div>

                <div className="mt-2 text-xs text-gray-500">
                  Status: {item.status}
                </div>

                <div className="mt-3">
                  <Link
                    href={`/compras/fornecedores/${item.supplierId}/plano-de-acao`}
                    className="text-sm font-medium underline"
                  >
                    Abrir plano de ação
                  </Link>
                  <Link
                    href="/compras/produtividade-compradores"
                    className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
                    >
                    Produtividade
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