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
import {
  createBuyerMonthlyGoal,
  listBuyerMonthlyGoals,
} from "@/lib/compras/buyer-monthly-goals";
import { buildBuyerGoalProgress } from "@/lib/compras/buyer-goal-progress";
import type {
  BuyerMonthlyGoal,
  Supplier,
  SupplierActionPlanItem,
  SupplierContactHistoryItem,
  SupplierScoreReviewItem,
} from "@/types/compras";

function currentMonthYmd() {
  return new Date().toISOString().slice(0, 7);
}

function progressClass(value: number) {
  if (value >= 100) return "bg-green-100 text-green-800";
  if (value >= 70) return "bg-blue-100 text-blue-800";
  if (value >= 40) return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
}

export default function ComprasMetasCompradoresPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [actions, setActions] = useState<SupplierActionPlanItem[]>([]);
  const [contacts, setContacts] = useState<SupplierContactHistoryItem[]>([]);
  const [reviews, setReviews] = useState<SupplierScoreReviewItem[]>([]);
  const [goals, setGoals] = useState<BuyerMonthlyGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [referenceMonth, setReferenceMonth] = useState(currentMonthYmd());
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    buyer: "",
    targetContacts: "10",
    targetActionsCompleted: "10",
    targetReviewsDone: "4",
    notes: "",
  });

  async function loadData(month = referenceMonth) {
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

      const goalsData = await listBuyerMonthlyGoals(month);
      setGoals(goalsData);
    } catch (err) {
      console.error(err);
      setError("Não foi possível carregar as metas dos compradores.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateGoal() {
    if (!form.buyer.trim()) {
      alert("Informe o comprador.");
      return;
    }

    try {
      setSaving(true);

      const currentUser = await getCurrentUserInfo();

      await createBuyerMonthlyGoal({
        buyer: form.buyer,
        referenceMonth,
        targetContacts: Number(form.targetContacts),
        targetActionsCompleted: Number(form.targetActionsCompleted),
        targetReviewsDone: Number(form.targetReviewsDone),
        notes: form.notes,
        createdBy: buildCreatedByLabel(currentUser),
      });

      setForm({
        buyer: "",
        targetContacts: "10",
        targetActionsCompleted: "10",
        targetReviewsDone: "4",
        notes: "",
      });

      await loadData(referenceMonth);
    } catch (err) {
      console.error(err);
      alert("Não foi possível criar a meta.");
    } finally {
      setSaving(false);
    }
  }

  const progressRows = useMemo(() => {
    const rows = buildBuyerGoalProgress({
      goals,
      actions,
      contacts,
      reviews,
    });

    return rows.filter((item) =>
      !search ? true : item.buyer.toLowerCase().includes(search.toLowerCase())
    );
  }, [goals, actions, contacts, reviews, search]);

  const metrics = useMemo(() => {
    return {
      buyers: progressRows.length,
      avgOverall:
        progressRows.length > 0
          ? Math.round(
              progressRows.reduce((acc, item) => acc + item.overallProgress, 0) /
                progressRows.length
            )
          : 0,
      achieved:
        progressRows.filter((item) => item.overallProgress >= 100).length,
      below50:
        progressRows.filter((item) => item.overallProgress < 50).length,
    };
  }, [progressRows]);

  useEffect(() => {
    loadData(referenceMonth);
  }, [referenceMonth]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Metas dos Compradores</h1>
          <p className="text-sm text-gray-500">
            Defina metas mensais e acompanhe o atingimento por usuário.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/compras/produtividade-compradores"
            className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Produtividade
          </Link>

          <Link
            href="/compras/painel-semanal"
            className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Painel semanal
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Compradores</div>
          <div className="mt-2 text-2xl font-bold">{metrics.buyers}</div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Média geral</div>
          <div className="mt-2 text-2xl font-bold">{metrics.avgOverall}%</div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Meta atingida</div>
          <div className="mt-2 text-2xl font-bold">{metrics.achieved}</div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Abaixo de 50%</div>
          <div className="mt-2 text-2xl font-bold">{metrics.below50}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border bg-white p-5 shadow-sm xl:col-span-1">
          <h2 className="mb-4 text-lg font-semibold">Nova meta mensal</h2>

          <div className="space-y-3">
            <input
              value={form.buyer}
              onChange={(e) => setForm((prev) => ({ ...prev, buyer: e.target.value }))}
              className="w-full rounded-xl border px-3 py-2 outline-none"
              placeholder="Nome ou email do comprador"
            />

            <input
              type="month"
              value={referenceMonth}
              onChange={(e) => setReferenceMonth(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none"
            />

            <input
              type="number"
              min={0}
              value={form.targetContacts}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, targetContacts: e.target.value }))
              }
              className="w-full rounded-xl border px-3 py-2 outline-none"
              placeholder="Meta de contatos"
            />

            <input
              type="number"
              min={0}
              value={form.targetActionsCompleted}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  targetActionsCompleted: e.target.value,
                }))
              }
              className="w-full rounded-xl border px-3 py-2 outline-none"
              placeholder="Meta de ações concluídas"
            />

            <input
              type="number"
              min={0}
              value={form.targetReviewsDone}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  targetReviewsDone: e.target.value,
                }))
              }
              className="w-full rounded-xl border px-3 py-2 outline-none"
              placeholder="Meta de reavaliações"
            />

            <textarea
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              className="min-h-[100px] w-full rounded-xl border px-3 py-2 outline-none"
              placeholder="Observações"
            />

            <button
              type="button"
              onClick={handleCreateGoal}
              disabled={saving}
              className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar meta"}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm xl:col-span-2">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 className="text-lg font-semibold">Atingimento por comprador</h2>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-xl border px-3 py-2 outline-none"
              placeholder="Buscar comprador"
            />
          </div>

          {loading ? (
            <p className="text-sm text-gray-500">Carregando metas...</p>
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : progressRows.length === 0 ? (
            <p className="text-sm text-gray-500">
              Nenhuma meta encontrada para o mês selecionado.
            </p>
          ) : (
            <div className="space-y-4">
              {progressRows.map((item) => (
                <div key={`${item.buyer}_${item.referenceMonth}`} className="rounded-xl border p-4">
                  <div className="mb-3 flex items-center justify-between gap-4">
                    <div>
                      <div className="font-medium">{item.buyer}</div>
                      <div className="text-xs text-gray-500">{item.referenceMonth}</div>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${progressClass(
                        item.overallProgress
                      )}`}
                    >
                      {item.overallProgress}%
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="rounded-xl border p-3">
                      <div className="text-sm text-gray-500">Contatos</div>
                      <div className="mt-1 font-semibold">
                        {item.actualContacts} / {item.targetContacts}
                      </div>
                      <div className="text-xs text-gray-500">
                        {item.progressContacts}%
                      </div>
                    </div>

                    <div className="rounded-xl border p-3">
                      <div className="text-sm text-gray-500">Ações concluídas</div>
                      <div className="mt-1 font-semibold">
                        {item.actualActionsCompleted} / {item.targetActionsCompleted}
                      </div>
                      <div className="text-xs text-gray-500">
                        {item.progressActionsCompleted}%
                      </div>
                    </div>

                    <div className="rounded-xl border p-3">
                      <div className="text-sm text-gray-500">Reavaliações</div>
                      <div className="mt-1 font-semibold">
                        {item.actualReviewsDone} / {item.targetReviewsDone}
                      </div>
                      <div className="text-xs text-gray-500">
                        {item.progressReviewsDone}%
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}