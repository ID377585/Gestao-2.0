"use client";

import { useEffect, useMemo, useState } from "react";
import { listAllPurchaseHistory } from "@/lib/compras/purchase-history";
import type { PurchaseHistoryEntry } from "@/types/compras";

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

function sameOrAfter(value: string, compare: string) {
  return value >= compare;
}

function sameOrBefore(value: string, compare: string) {
  return value <= compare;
}

export default function AuditoriaComprasPage() {
  const [items, setItems] = useState<PurchaseHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [entityTypeFilter, setEntityTypeFilter] = useState<
    "todos" | "solicitacao" | "pedido" | "recebimento"
  >("todos");
  const [actionFilter, setActionFilter] = useState<
    | "todos"
    | "solicitacao_criada"
    | "solicitacao_status_alterado"
    | "pedido_criado"
    | "solicitacao_convertida"
    | "recebimento_iniciado"
    | "recebimento_finalizado"
  >("todos");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      setError("");
      const data = await listAllPurchaseHistory();
      setItems(data);
    } catch (err) {
      console.error(err);
      setError("Não foi possível carregar a auditoria de compras.");
    } finally {
      setLoading(false);
    }
  }

  function inDateRange(value?: string) {
    if (!value) return false;

    const onlyDate = value.slice(0, 10);

    if (dateFrom && !sameOrAfter(onlyDate, dateFrom)) return false;
    if (dateTo && !sameOrBefore(onlyDate, dateTo)) return false;

    return true;
  }

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const entityOk =
        entityTypeFilter === "todos" || item.entityType === entityTypeFilter;

      const actionOk =
        actionFilter === "todos" || item.action === actionFilter;

      const dateOk =
        (!dateFrom && !dateTo) || inDateRange(item.createdAt);

      const searchOk =
        !search ||
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        (item.description ?? "").toLowerCase().includes(search.toLowerCase()) ||
        item.entityId.toLowerCase().includes(search.toLowerCase()) ||
        (item.createdBy ?? "").toLowerCase().includes(search.toLowerCase());

      return entityOk && actionOk && dateOk && searchOk;
    });
  }, [items, entityTypeFilter, actionFilter, dateFrom, dateTo, search]);

  const metrics = useMemo(() => {
    return {
      total: filteredItems.length,
      solicitacoes: filteredItems.filter((item) => item.entityType === "solicitacao").length,
      pedidos: filteredItems.filter((item) => item.entityType === "pedido").length,
      recebimentos: filteredItems.filter((item) => item.entityType === "recebimento").length,
    };
  }, [filteredItems]);

  function handlePrint() {
    window.print();
  }

  function clearFilters() {
    setEntityTypeFilter("todos");
    setActionFilter("todos");
    setDateFrom("");
    setDateTo("");
    setSearch("");
  }

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6 p-6 print:p-0">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold">Auditoria de Compras</h1>
          <p className="text-sm text-gray-500">
            Histórico operacional de solicitações, pedidos e recebimentos.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-xl border px-4 py-2 text-sm font-medium"
          >
            Limpar filtros
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Imprimir / Salvar em PDF
          </button>
        </div>
      </div>

      <div className="hidden print:block">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">Relatório de Auditoria de Compras</h1>
          <p className="text-sm text-gray-600">
            Gerado em {new Date().toLocaleString("pt-BR")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Eventos</div>
          <div className="mt-2 text-2xl font-bold">{metrics.total}</div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Solicitações</div>
          <div className="mt-2 text-2xl font-bold">{metrics.solicitacoes}</div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Pedidos</div>
          <div className="mt-2 text-2xl font-bold">{metrics.pedidos}</div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Recebimentos</div>
          <div className="mt-2 text-2xl font-bold">{metrics.recebimentos}</div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm print:hidden">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Entidade</label>
            <select
              value={entityTypeFilter}
              onChange={(e) =>
                setEntityTypeFilter(
                  e.target.value as "todos" | "solicitacao" | "pedido" | "recebimento"
                )
              }
              className="w-full rounded-xl border px-3 py-2 outline-none"
            >
              <option value="todos">Todas</option>
              <option value="solicitacao">Solicitação</option>
              <option value="pedido">Pedido</option>
              <option value="recebimento">Recebimento</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Ação</label>
            <select
              value={actionFilter}
              onChange={(e) =>
                setActionFilter(
                  e.target.value as
                    | "todos"
                    | "solicitacao_criada"
                    | "solicitacao_status_alterado"
                    | "pedido_criado"
                    | "solicitacao_convertida"
                    | "recebimento_iniciado"
                    | "recebimento_finalizado"
                )
              }
              className="w-full rounded-xl border px-3 py-2 outline-none"
            >
              <option value="todos">Todas</option>
              <option value="solicitacao_criada">Solicitação criada</option>
              <option value="solicitacao_status_alterado">Status alterado</option>
              <option value="pedido_criado">Pedido criado</option>
              <option value="solicitacao_convertida">Solicitação convertida</option>
              <option value="recebimento_iniciado">Recebimento iniciado</option>
              <option value="recebimento_finalizado">Recebimento finalizado</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Data inicial</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Data final</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium">Buscar</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border px-3 py-2 outline-none"
            placeholder="Título, descrição, ID ou usuário"
          />
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        {loading ? (
          <p className="text-sm text-gray-500">Carregando auditoria...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : filteredItems.length === 0 ? (
          <p className="text-sm text-gray-500">
            Nenhum evento encontrado.
          </p>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => (
              <div key={item.id} className="rounded-xl border p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-medium">{item.title}</div>
                    <div className="text-sm text-gray-500">
                      {item.entityType} • {actionLabel(item.action)} • ID {item.entityId}
                    </div>
                  </div>

                  <div className="text-sm text-gray-500">
                    {item.createdAt
                      ? new Date(item.createdAt).toLocaleString("pt-BR")
                      : "-"}
                  </div>
                </div>

                {item.description ? (
                  <div className="mt-2 text-sm text-gray-700">
                    {item.description}
                  </div>
                ) : null}

                <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                  <div className="text-sm text-gray-600">
                    Usuário: {item.createdBy || "Não informado"}
                  </div>

                  <div className="text-sm text-gray-600">
                    Relacionado:{" "}
                    {item.relatedEntityType && item.relatedEntityId
                      ? `${item.relatedEntityType} • ${item.relatedEntityId}`
                      : "-"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}