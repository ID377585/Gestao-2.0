"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { listSuppliers } from "@/lib/compras/suppliers";
import { listPurchaseOrders } from "@/lib/compras/orders";
import { listGoodsReceipts } from "@/lib/compras/receipts";
import {
  buildPurchaseAlerts,
  syncPurchaseAlertsToQueue,
  type PurchaseAlert,
} from "@/lib/compras/purchase-alerts";

function severityLabel(severity: PurchaseAlert["severity"]) {
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

function severityClass(severity: PurchaseAlert["severity"]) {
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

function typeLabel(type: PurchaseAlert["type"]) {
  switch (type) {
    case "fornecedor_critico":
      return "Fornecedor crítico";
    case "fornecedor_divergencia":
      return "Aumento de divergência";
    case "fornecedor_sem_compra":
      return "Fornecedor sem compra";
    case "pedido_atrasado":
      return "Pedido atrasado";
    default:
      return type;
  }
}

export default function ComprasAlertasPage() {
  const [alerts, setAlerts] = useState<PurchaseAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  const [severityFilter, setSeverityFilter] = useState<
    "todos" | "alta" | "media" | "baixa"
  >("todos");
  const [typeFilter, setTypeFilter] = useState<
    "todos"
    | "fornecedor_critico"
    | "fornecedor_divergencia"
    | "fornecedor_sem_compra"
    | "pedido_atrasado"
  >("todos");
  const [search, setSearch] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [suppliers, orders, receipts] = await Promise.all([
        listSuppliers(),
        listPurchaseOrders(),
        listGoodsReceipts(),
      ]);

      const builtAlerts = buildPurchaseAlerts({
        suppliers,
        orders,
        receipts,
      });

      setAlerts(builtAlerts);
    } catch (err) {
      console.error(err);
      setError("Não foi possível carregar os alertas.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSyncQueue() {
    try {
      setSyncing(true);
      await syncPurchaseAlertsToQueue(alerts);
      alert("Fila de ação atualizada com sucesso.");
    } catch (err) {
      console.error(err);
      alert("Não foi possível sincronizar a fila.");
    } finally {
      setSyncing(false);
    }
  }

  const filteredAlerts = useMemo(() => {
    return alerts.filter((item) => {
      const severityOk =
        severityFilter === "todos" || item.severity === severityFilter;

      const typeOk = typeFilter === "todos" || item.type === typeFilter;

      const searchOk =
        !search ||
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        item.description.toLowerCase().includes(search.toLowerCase()) ||
        (item.supplierName ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (item.purchaseOrderNumber ?? "").toLowerCase().includes(search.toLowerCase());

      return severityOk && typeOk && searchOk;
    });
  }, [alerts, severityFilter, typeFilter, search]);

  const metrics = useMemo(() => {
    return {
      total: filteredAlerts.length,
      alta: filteredAlerts.filter((item) => item.severity === "alta").length,
      media: filteredAlerts.filter((item) => item.severity === "media").length,
      baixa: filteredAlerts.filter((item) => item.severity === "baixa").length,
    };
  }, [filteredAlerts]);

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Alertas de Compras</h1>
          <p className="text-sm text-gray-500">
            Monitoramento inteligente de fornecedores, pedidos e recebimentos.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleSyncQueue}
            disabled={syncing || alerts.length === 0}
            className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
          >
            {syncing ? "Sincronizando..." : "Enviar para fila de ação"}
          </button>

          <Link
            href="/compras/fila-de-acao"
            className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Abrir fila de ação
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Carregando alertas...</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">Alertas</div>
              <div className="mt-2 text-2xl font-bold">{metrics.total}</div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">Alta</div>
              <div className="mt-2 text-2xl font-bold">{metrics.alta}</div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">Média</div>
              <div className="mt-2 text-2xl font-bold">{metrics.media}</div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">Baixa</div>
              <div className="mt-2 text-2xl font-bold">{metrics.baixa}</div>
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Severidade</label>
                <select
                  value={severityFilter}
                  onChange={(e) =>
                    setSeverityFilter(
                      e.target.value as "todos" | "alta" | "media" | "baixa"
                    )
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
                <label className="mb-1 block text-sm font-medium">Tipo</label>
                <select
                  value={typeFilter}
                  onChange={(e) =>
                    setTypeFilter(
                      e.target.value as
                        | "todos"
                        | "fornecedor_critico"
                        | "fornecedor_divergencia"
                        | "fornecedor_sem_compra"
                        | "pedido_atrasado"
                    )
                  }
                  className="w-full rounded-xl border px-3 py-2 outline-none"
                >
                  <option value="todos">Todos</option>
                  <option value="fornecedor_critico">Fornecedor crítico</option>
                  <option value="fornecedor_divergencia">Aumento de divergência</option>
                  <option value="fornecedor_sem_compra">Fornecedor sem compra</option>
                  <option value="pedido_atrasado">Pedido atrasado</option>
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
            {filteredAlerts.length === 0 ? (
              <p className="text-sm text-gray-500">
                Nenhum alerta encontrado para o filtro selecionado.
              </p>
            ) : (
              <div className="space-y-3">
                {filteredAlerts.map((item) => (
                  <div key={item.id} className="rounded-xl border p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="font-medium">{item.title}</div>
                        <div className="text-sm text-gray-500">
                          {typeLabel(item.type)}
                        </div>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${severityClass(
                          item.severity
                        )}`}
                      >
                        {severityLabel(item.severity)}
                      </span>
                    </div>

                    <div className="mt-2 text-sm text-gray-700">
                      {item.description}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-3 text-sm">
                      {item.supplierId ? (
                        <Link
                          href={`/compras/fornecedores/${item.supplierId}`}
                          className="underline"
                        >
                          Abrir fornecedor
                        </Link>
                      ) : null}

                      {item.purchaseOrderId ? (
                        <Link
                          href={`/compras/pedidos/${item.purchaseOrderId}`}
                          className="underline"
                        >
                          Abrir pedido
                        </Link>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}