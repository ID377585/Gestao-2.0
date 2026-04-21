"use client";

import { useEffect, useMemo, useState } from "react";
import { listAllFinancialHistory } from "@/lib/financeiro/financial-history";
import type { FinancialHistoryEntry } from "@/types/compras";

function formatDateTime(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR");
}

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

function sameOrAfter(value: string, compare: string) {
  return value >= compare;
}

function sameOrBefore(value: string, compare: string) {
  return value <= compare;
}

export default function AuditoriaFinanceiraPage() {
  const [items, setItems] = useState<FinancialHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [financeTypeFilter, setFinanceTypeFilter] = useState<
    "todos" | "pagar" | "receber"
  >("todos");
  const [actionFilter, setActionFilter] = useState<
    | "todos"
    | "criado"
    | "editado"
    | "pago"
    | "recebido"
    | "cancelado"
    | "pendente"
    | "conciliado_banco"
    | "desconciliado_banco"
  >("todos");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [createdByFilter, setCreatedByFilter] = useState("");
  const [search, setSearch] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      setError("");
      setItems(await listAllFinancialHistory());
    } catch (err) {
      console.error(err);
      setError("Nao foi possivel carregar a auditoria financeira.");
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
      const financeTypeOk =
        financeTypeFilter === "todos" || item.financeType === financeTypeFilter;

      const actionOk =
        actionFilter === "todos" || item.action === actionFilter;

      const dateOk = (!dateFrom && !dateTo) || inDateRange(item.createdAt);

      const createdByOk =
        !createdByFilter ||
        (item.createdBy ?? "")
          .toLowerCase()
          .includes(createdByFilter.toLowerCase());

      const searchOk =
        !search ||
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        (item.description ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (item.financeId ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (item.bankAccountName ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (item.createdBy ?? "").toLowerCase().includes(search.toLowerCase());

      return financeTypeOk && actionOk && dateOk && createdByOk && searchOk;
    });
  }, [
    items,
    financeTypeFilter,
    actionFilter,
    dateFrom,
    dateTo,
    createdByFilter,
    search,
  ]);

  const metrics = useMemo(() => {
    return {
      total: filteredItems.length,
      pagar: filteredItems.filter((item) => item.financeType === "pagar").length,
      receber: filteredItems.filter((item) => item.financeType === "receber").length,
      conciliacoes: filteredItems.filter(
        (item) =>
          item.action === "conciliado_banco" ||
          item.action === "desconciliado_banco"
      ).length,
      alteracoes: filteredItems.filter(
        (item) =>
          item.action === "editado" ||
          item.action === "cancelado" ||
          item.action === "pendente"
      ).length,
    };
  }, [filteredItems]);

  const usersSummary = useMemo(() => {
    const map = new Map<string, number>();

    for (const item of filteredItems) {
      const key = item.createdBy?.trim() || "Nao informado";
      map.set(key, (map.get(key) ?? 0) + 1);
    }

    return Array.from(map.entries())
      .map(([user, total]) => ({ user, total }))
      .sort((a, b) => b.total - a.total);
  }, [filteredItems]);

  function handlePrint() {
    window.print();
  }

  function clearFilters() {
    setFinanceTypeFilter("todos");
    setActionFilter("todos");
    setDateFrom("");
    setDateTo("");
    setCreatedByFilter("");
    setSearch("");
  }

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6 p-6 print:p-0">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold">Auditoria Financeira</h1>
          <p className="text-sm text-gray-500">
            Historico geral de eventos financeiros do sistema.
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
          <h1 className="text-2xl font-bold">Relatorio de Auditoria Financeira</h1>
          <p className="text-sm text-gray-600">
            Gerado em {new Date().toLocaleString("pt-BR")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Eventos</div>
          <div className="mt-2 text-2xl font-bold">{metrics.total}</div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Contas a pagar</div>
          <div className="mt-2 text-2xl font-bold">{metrics.pagar}</div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Contas a receber</div>
          <div className="mt-2 text-2xl font-bold">{metrics.receber}</div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Conciliacoes</div>
          <div className="mt-2 text-2xl font-bold">{metrics.conciliacoes}</div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Alteracoes</div>
          <div className="mt-2 text-2xl font-bold">{metrics.alteracoes}</div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm print:hidden">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div>
            <label className="mb-1 block text-sm font-medium">Tipo</label>
            <select
              value={financeTypeFilter}
              onChange={(e) =>
                setFinanceTypeFilter(e.target.value as typeof financeTypeFilter)
              }
              className="w-full rounded-xl border px-3 py-2 outline-none"
            >
              <option value="todos">Todos</option>
              <option value="pagar">Pagar</option>
              <option value="receber">Receber</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Acao</label>
            <select
              value={actionFilter}
              onChange={(e) =>
                setActionFilter(e.target.value as typeof actionFilter)
              }
              className="w-full rounded-xl border px-3 py-2 outline-none"
            >
              <option value="todos">Todas</option>
              <option value="criado">Criado</option>
              <option value="editado">Editado</option>
              <option value="pago">Pago</option>
              <option value="recebido">Recebido</option>
              <option value="cancelado">Cancelado</option>
              <option value="pendente">Pendente</option>
              <option value="conciliado_banco">Conciliado no banco</option>
              <option value="desconciliado_banco">Desconciliado no banco</option>
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

          <div>
            <label className="mb-1 block text-sm font-medium">Responsavel</label>
            <input
              value={createdByFilter}
              onChange={(e) => setCreatedByFilter(e.target.value)}
              placeholder="Filtrar por usuario"
              className="w-full rounded-xl border px-3 py-2 outline-none"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium">Busca</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Titulo, descricao, conta, banco..."
            className="w-full rounded-xl border px-3 py-2 outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Eventos financeiros</h2>
            <div className="text-sm text-gray-500">{filteredItems.length} registros</div>
          </div>

          {loading ? (
            <p className="text-sm text-gray-500">Carregando auditoria...</p>
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : filteredItems.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum evento encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left">
                    <th className="px-4 py-3 font-medium">Data</th>
                    <th className="px-4 py-3 font-medium">Tipo</th>
                    <th className="px-4 py-3 font-medium">Acao</th>
                    <th className="px-4 py-3 font-medium">Titulo</th>
                    <th className="px-4 py-3 font-medium">Descricao</th>
                    <th className="px-4 py-3 font-medium">Conta</th>
                    <th className="px-4 py-3 font-medium">Responsavel</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="border-b align-top">
                      <td className="px-4 py-3">{formatDateTime(item.createdAt)}</td>
                      <td className="px-4 py-3 uppercase">{item.financeType}</td>
                      <td className="px-4 py-3">{actionLabel(item.action)}</td>
                      <td className="px-4 py-3 font-medium">{item.title}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {item.description || "-"}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {item.financeId}
                        {item.bankAccountName ? (
                          <div className="mt-1 text-gray-500">{item.bankAccountName}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">{item.createdBy || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Eventos por usuario</h2>

          {usersSummary.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum usuario encontrado.</p>
          ) : (
            <div className="space-y-3">
              {usersSummary.map((item) => (
                <div
                  key={item.user}
                  className="flex items-center justify-between rounded-xl border px-4 py-3"
                >
                  <div className="text-sm font-medium">{item.user}</div>
                  <div className="text-sm text-gray-500">{item.total}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
