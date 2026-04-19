"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { listSuppliers } from "@/lib/compras/suppliers";
import {
  listSupplierActionPlanItems,
  listSupplierContactHistory,
  listSupplierScoreReviews,
} from "@/lib/compras/supplier-action-plan";
import { buildBuyerProductivity } from "@/lib/compras/buyer-productivity";
import type {
  Supplier,
  SupplierActionPlanItem,
  SupplierContactHistoryItem,
  SupplierScoreReviewItem,
} from "@/types/compras";

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function thirtyDaysAgoYmd() {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString().slice(0, 10);
}

export default function ComprasProdutividadeCompradoresPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [actions, setActions] = useState<SupplierActionPlanItem[]>([]);
  const [contacts, setContacts] = useState<SupplierContactHistoryItem[]>([]);
  const [reviews, setReviews] = useState<SupplierScoreReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [startDate, setStartDate] = useState(thirtyDaysAgoYmd());
  const [endDate, setEndDate] = useState(todayYmd());
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
      setError("Não foi possível carregar a produtividade dos compradores.");
    } finally {
      setLoading(false);
    }
  }

  const ranking = useMemo(() => {
    const rows = buildBuyerProductivity({
      actions,
      contacts,
      reviews,
      startDate,
      endDate,
    });

    return rows.filter((item) =>
      !search
        ? true
        : item.buyer.toLowerCase().includes(search.toLowerCase())
    );
  }, [actions, contacts, reviews, startDate, endDate, search]);

  const metrics = useMemo(() => {
    return {
      buyers: ranking.length,
      totalActions: ranking.reduce((acc, item) => acc + item.actionsCompleted, 0),
      totalContacts: ranking.reduce((acc, item) => acc + item.contactsMade, 0),
      totalReviews: ranking.reduce((acc, item) => acc + item.reviewsDone, 0),
      totalActivities: ranking.reduce((acc, item) => acc + item.totalActivities, 0),
    };
  }, [ranking]);

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Produtividade por Comprador</h1>
          <p className="text-sm text-gray-500">
            Ranking operacional por usuário no período selecionado.
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
            href="/compras/painel-semanal"
            className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Painel semanal
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Compradores</div>
          <div className="mt-2 text-2xl font-bold">{metrics.buyers}</div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Ações concluídas</div>
          <div className="mt-2 text-2xl font-bold">{metrics.totalActions}</div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Contatos realizados</div>
          <div className="mt-2 text-2xl font-bold">{metrics.totalContacts}</div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Reavaliações feitas</div>
          <div className="mt-2 text-2xl font-bold">{metrics.totalReviews}</div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Atividades totais</div>
          <div className="mt-2 text-2xl font-bold">{metrics.totalActivities}</div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Data inicial</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Data final</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Buscar comprador</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none"
              placeholder="Nome ou email"
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        {loading ? (
          <p className="text-sm text-gray-500">Carregando ranking...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : ranking.length === 0 ? (
          <p className="text-sm text-gray-500">
            Nenhum dado encontrado no período selecionado.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left">
                  <th className="px-4 py-3 font-medium">Ranking</th>
                  <th className="px-4 py-3 font-medium">Comprador</th>
                  <th className="px-4 py-3 font-medium">Ações</th>
                  <th className="px-4 py-3 font-medium">Contatos</th>
                  <th className="px-4 py-3 font-medium">Reavaliações</th>
                  <th className="px-4 py-3 font-medium">Atividades</th>
                  <th className="px-4 py-3 font-medium">Score</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((item, index) => (
                  <tr key={item.buyer} className="border-b">
                    <td className="px-4 py-3 font-medium">#{index + 1}</td>
                    <td className="px-4 py-3 font-medium">{item.buyer}</td>
                    <td className="px-4 py-3">{item.actionsCompleted}</td>
                    <td className="px-4 py-3">{item.contactsMade}</td>
                    <td className="px-4 py-3">{item.reviewsDone}</td>
                    <td className="px-4 py-3">{item.totalActivities}</td>
                    <td className="px-4 py-3 font-bold">{item.score}</td>
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