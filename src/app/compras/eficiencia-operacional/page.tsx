"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { listPurchaseActionQueue } from "@/lib/compras/purchase-action-queue";
import { getPurchaseActionSlaInfo } from "@/lib/compras/purchase-action-sla";
import type { PurchaseAlertActionItem } from "@/types/compras";

type QueueRow = PurchaseAlertActionItem & {
  slaHours: number;
  openHours: number;
  overdue: boolean;
  overdueHours: number;
  slaStatusLabel: "no_prazo" | "vencido" | "tratado";
};

function severityLabel(severity: QueueRow["severity"]) {
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

export default function ComprasEficienciaOperacionalPage() {
  const [items, setItems] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

      setItems(enriched);
    } catch (err) {
      console.error(err);
      setError("Não foi possível carregar a eficiência operacional.");
    } finally {
      setLoading(false);
    }
  }

  const metrics = useMemo(() => {
    const pendentes = items.filter((item) => item.status === "pendente");
    const tratados = items.filter((item) => item.status === "tratado");
    const vencidos = pendentes.filter((item) => item.overdue);

    const avgOpenHours =
      pendentes.length > 0
        ? Math.round(
            pendentes.reduce((acc, item) => acc + item.openHours, 0) /
              pendentes.length
          )
        : 0;

    const avgResolutionHours =
      tratados.length > 0
        ? Math.round(
            tratados.reduce((acc, item) => acc + item.openHours, 0) /
              tratados.length
          )
        : 0;

    const compliance =
      pendentes.length > 0
        ? Math.max(
            0,
            Math.round(((pendentes.length - vencidos.length) / pendentes.length) * 100)
          )
        : 100;

    return {
      total: items.length,
      pendentes: pendentes.length,
      tratados: tratados.length,
      vencidos: vencidos.length,
      avgOpenHours,
      avgResolutionHours,
      compliance,
    };
  }, [items]);

  const oldestPendencies = useMemo(() => {
    return items
      .filter((item) => item.status === "pendente")
      .sort((a, b) => b.openHours - a.openHours)
      .slice(0, 10);
  }, [items]);

  const overdueBySeverity = useMemo(() => {
    return {
      alta: items.filter((item) => item.status === "pendente" && item.overdue && item.severity === "alta").length,
      media: items.filter((item) => item.status === "pendente" && item.overdue && item.severity === "media").length,
      baixa: items.filter((item) => item.status === "pendente" && item.overdue && item.severity === "baixa").length,
    };
  }, [items]);

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Eficiência Operacional</h1>
          <p className="text-sm text-gray-500">
            Monitoramento de SLA e performance da tratativa dos alertas de compras.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/compras/fila-de-acao"
            className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Abrir fila de ação
          </Link>

          <Link
            href="/compras/alertas"
            className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Ver alertas
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Carregando indicadores...</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
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
              <div className="mt-2 text-2xl font-bold">{metrics.avgOpenHours}h</div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">Compliance SLA</div>
              <div className="mt-2 text-2xl font-bold">{metrics.compliance}%</div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">Vencidos por severidade</h2>

              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl border px-4 py-3">
                  <div className="font-medium">Alta</div>
                  <div className="font-semibold">{overdueBySeverity.alta}</div>
                </div>

                <div className="flex items-center justify-between rounded-xl border px-4 py-3">
                  <div className="font-medium">Média</div>
                  <div className="font-semibold">{overdueBySeverity.media}</div>
                </div>

                <div className="flex items-center justify-between rounded-xl border px-4 py-3">
                  <div className="font-medium">Baixa</div>
                  <div className="font-semibold">{overdueBySeverity.baixa}</div>
                </div>
              </div>

              <div className="mt-6 rounded-xl border bg-gray-50 p-4 text-sm text-gray-600">
                Tempo médio de resolução dos tratados: <strong>{metrics.avgResolutionHours}h</strong>
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">Pendências mais antigas</h2>

              {oldestPendencies.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhuma pendência em aberto.</p>
              ) : (
                <div className="space-y-3">
                  {oldestPendencies.map((item) => (
                    <div key={item.id} className="rounded-xl border px-4 py-3">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="font-medium">{item.title}</div>
                          <div className="text-xs text-gray-500">
                            {item.supplierName || item.purchaseOrderNumber || "-"}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-semibold">{item.openHours}h</div>
                          <div className="text-xs text-gray-500">
                            {severityLabel(item.severity)}
                          </div>
                        </div>
                      </div>

                      <div className="mt-2">
                        <Link
                          href="/compras/fila-de-acao"
                          className="text-sm font-medium underline"
                        >
                          Abrir fila
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}