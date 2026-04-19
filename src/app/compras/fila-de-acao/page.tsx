"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { buildCreatedByLabel, getCurrentUserInfo } from "@/lib/auth/current-user";
import {
  listPurchaseActionQueue,
  markPurchaseActionAsDone,
  reopenPurchaseAction,
} from "@/lib/compras/purchase-action-queue";
import { getPurchaseActionSlaInfo } from "@/lib/compras/purchase-action-sla";
import type { PurchaseAlertActionItem } from "@/types/compras";

function severityLabel(severity: PurchaseAlertActionItem["severity"]) {
  switch (severity) {
    case "alta":
      return "Alta";
    case "media":
      return "Média";
    case "baixa":
      return "Baixa";
    default:
      return severity;
  }
}

function severityClass(severity: PurchaseAlertActionItem["severity"]) {
  switch (severity) {
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

function slaClass(statusLabel: "no_prazo" | "vencido" | "tratado") {
  switch (statusLabel) {
    case "no_prazo":
      return "bg-green-100 text-green-800";
    case "vencido":
      return "bg-red-100 text-red-800";
    case "tratado":
      return "bg-gray-100 text-gray-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function slaLabel(statusLabel: "no_prazo" | "vencido" | "tratado") {
  switch (statusLabel) {
    case "no_prazo":
      return "No prazo";
    case "vencido":
      return "Vencido";
    case "tratado":
      return "Tratado";
    default:
      return statusLabel;
  }
}

type QueueRow = PurchaseAlertActionItem & {
  slaHours: number;
  openHours: number;
  overdue: boolean;
  overdueHours: number;
  slaStatusLabel: "no_prazo" | "vencido" | "tratado";
};

export default function FilaDeAcaoComprasPage() {
  const [items, setItems] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const [statusFilter, setStatusFilter] = useState<"todos" | "pendente" | "tratado">("todos");
  const [severityFilter, setSeverityFilter] = useState<"todos" | "alta" | "media" | "baixa">("todos");
  const [slaFilter, setSlaFilter] = useState<"todos" | "no_prazo" | "vencido" | "tratado">("todos");
  const [search, setSearch] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const data = await listPurchaseActionQueue();

      const enriched: QueueRow[] = data.map((item) => {
        const sla = getPurchaseActionSlaInfo(item);

        return {
          ...item,
          slaHours: sla.slaHours,
          openHours: sla.openHours,
          overdue: sla.overdue,
          overdueHours: sla.overdueHours,
          slaStatusLabel: sla.statusLabel,
        };
      });

      setItems(
        enriched.sort((a, b) => {
          if (a.status === "pendente" && b.status !== "pendente") return -1;
          if (a.status !== "pendente" && b.status === "pendente") return 1;
          if (a.overdue && !b.overdue) return -1;
          if (!a.overdue && b.overdue) return 1;
          return b.openHours - a.openHours;
        })
      );
    } catch (err) {
      console.error(err);
      setError("Não foi possível carregar a fila de ação.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDone(item: QueueRow) {
    try {
      const currentUser = await getCurrentUserInfo();

      await markPurchaseActionAsDone({
        id: item.id,
        observacaoTratativa: notes[item.id] ?? item.observacaoTratativa ?? "",
        treatedBy: buildCreatedByLabel(currentUser),
      });

      await loadData();
      alert("Alerta marcado como tratado.");
    } catch (err) {
      console.error(err);
      alert("Não foi possível concluir a tratativa.");
    }
  }

  async function handleReopen(item: QueueRow) {
    try {
      await reopenPurchaseAction({ id: item.id });
      await loadData();
      alert("Item reaberto com sucesso.");
    } catch (err) {
      console.error(err);
      alert("Não foi possível reabrir o item.");
    }
  }

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const statusOk =
        statusFilter === "todos" || item.status === statusFilter;

      const severityOk =
        severityFilter === "todos" || item.severity === severityFilter;

      const slaOk =
        slaFilter === "todos" || item.slaStatusLabel === slaFilter;

      const searchOk =
        !search ||
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        item.description.toLowerCase().includes(search.toLowerCase()) ||
        (item.supplierName ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (item.purchaseOrderNumber ?? "").toLowerCase().includes(search.toLowerCase());

      return statusOk && severityOk && slaOk && searchOk;
    });
  }, [items, statusFilter, severityFilter, slaFilter, search]);

  const metrics = useMemo(() => {
    const pendentes = filteredItems.filter((item) => item.status === "pendente");
    const tratados = filteredItems.filter((item) => item.status === "tratado");
    const vencidos = pendentes.filter((item) => item.overdue);

    const averageOpenHours =
      pendentes.length > 0
        ? Math.round(
            pendentes.reduce((acc, item) => acc + item.openHours, 0) /
              pendentes.length
          )
        : 0;

    return {
      total: filteredItems.length,
      pendentes: pendentes.length,
      tratados: tratados.length,
      vencidos: vencidos.length,
      averageOpenHours,
    };
  }, [filteredItems]);

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Fila de Ação de Compras</h1>
          <p className="text-sm text-gray-500">
            Trate alertas operacionais e acompanhe SLA das pendências.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/compras/eficiencia-operacional"
            className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Eficiência operacional
          </Link>

          <Link
            href="/compras/alertas"
            className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Voltar para alertas
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Itens</div>
          <div className="mt-2 text-2xl font-bold">{metrics.total}</div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Pendentes</div>
          <div className="mt-2 text-2xl font-bold">{metrics.pendentes}</div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Tratados</div>
          <div className="mt-2 text-2xl font-bold">{metrics.tratados}</div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Vencidos</div>
          <div className="mt-2 text-2xl font-bold">{metrics.vencidos}</div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Tempo médio aberto</div>
          <div className="mt-2 text-2xl font-bold">{metrics.averageOpenHours}h</div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Status</label>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as "todos" | "pendente" | "tratado")
              }
              className="w-full rounded-xl border px-3 py-2 outline-none"
            >
              <option value="todos">Todos</option>
              <option value="pendente">Pendentes</option>
              <option value="tratado">Tratados</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Severidade</label>
            <select
              value={severityFilter}
              onChange={(e) =>
                setSeverityFilter(e.target.value as "todos" | "alta" | "media" | "baixa")
              }
              className="w-full rounded-xl border px-3 py-2 outline-none"
            >
              <option value="todos">Todas</option>
              <option value="alta">Alta</option>
              <option value="media">Média</option>
              <option value="baixa">Baixa</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">SLA</label>
            <select
              value={slaFilter}
              onChange={(e) =>
                setSlaFilter(
                  e.target.value as "todos" | "no_prazo" | "vencido" | "tratado"
                )
              }
              className="w-full rounded-xl border px-3 py-2 outline-none"
            >
              <option value="todos">Todos</option>
              <option value="no_prazo">No prazo</option>
              <option value="vencido">Vencido</option>
              <option value="tratado">Tratado</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Buscar</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none"
              placeholder="Fornecedor, pedido ou descrição"
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        {loading ? (
          <p className="text-sm text-gray-500">Carregando fila...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : filteredItems.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum item encontrado.</p>
        ) : (
          <div className="space-y-4">
            {filteredItems.map((item) => (
              <div key={item.id} className="rounded-xl border p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-medium">{item.title}</div>
                    <div className="text-sm text-gray-500">{item.description}</div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${severityClass(
                        item.severity
                      )}`}
                    >
                      {severityLabel(item.severity)}
                    </span>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${slaClass(
                        item.slaStatusLabel
                      )}`}
                    >
                      {slaLabel(item.slaStatusLabel)}
                    </span>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="space-y-2 text-sm text-gray-600">
                    <div>Fornecedor: {item.supplierName || "-"}</div>
                    <div>Pedido: {item.purchaseOrderNumber || "-"}</div>
                    <div>SLA: {item.slaHours}h</div>
                    <div>Tempo em aberto: {item.openHours}h</div>
                    <div>
                      Excedente: {item.overdue ? `${item.overdueHours}h` : "-"}
                    </div>
                    <div>Tratado por: {item.treatedBy || "-"}</div>
                    <div>
                      Data da tratativa:{" "}
                      {item.treatedAt
                        ? new Date(item.treatedAt).toLocaleString("pt-BR")
                        : "-"}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Observação da tratativa
                    </label>
                    <textarea
                      value={notes[item.id] ?? item.observacaoTratativa ?? ""}
                      onChange={(e) =>
                        setNotes((prev) => ({
                          ...prev,
                          [item.id]: e.target.value,
                        }))
                      }
                      className="min-h-[100px] w-full rounded-xl border px-3 py-2 outline-none"
                      disabled={item.status === "tratado"}
                    />
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-3">
                  {item.supplierId ? (
                    <Link
                      href={`/compras/fornecedores/${item.supplierId}`}
                      className="rounded-lg border px-3 py-1 text-sm font-medium hover:bg-gray-50"
                    >
                      Abrir fornecedor
                    </Link>
                  ) : null}

                  {item.purchaseOrderId ? (
                    <Link
                      href={`/compras/pedidos/${item.purchaseOrderId}`}
                      className="rounded-lg border px-3 py-1 text-sm font-medium hover:bg-gray-50"
                    >
                      Abrir pedido
                    </Link>
                  ) : null}

                  {item.status === "pendente" ? (
                    <button
                      type="button"
                      onClick={() => handleDone(item)}
                      className="rounded-lg bg-black px-3 py-1 text-sm font-medium text-white"
                    >
                      Marcar como tratado
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleReopen(item)}
                      className="rounded-lg border px-3 py-1 text-sm font-medium hover:bg-gray-50"
                    >
                      Reabrir
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}