"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { listSuppliers } from "@/lib/compras/suppliers";
import { listPurchaseOrders } from "@/lib/compras/orders";
import { listGoodsReceipts } from "@/lib/compras/receipts";
import { listDashboardInvoiceEntries } from "@/lib/compras/invoice-entries";
import { calculateSupplierScore } from "@/lib/compras/supplier-score";
import { isLegacyTableMissingError } from "@/lib/legacy/supabase";
import type {
  Supplier,
  PurchaseOrder,
  GoodsReceipt,
} from "@/types/compras";
import type { DashboardInvoiceEntry } from "@/lib/compras/invoice-entries";

function onlyDigits(value: string | null | undefined) {
  return String(value ?? "").replace(/\D/g, "");
}

function normalizeText(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function formatCurrency(value: number) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
  }).format(date);
}

function diffDays(from?: string, to?: string) {
  if (!from || !to) return null;

  const start = new Date(from);
  const end = new Date(to);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }

  const diffMs = end.getTime() - start.getTime();
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
}

type SupplierDashboardRow = {
  supplierId: string;
  supplierName: string;
  ativo: boolean;
  totalPedidos: number;
  totalEntradas: number;
  totalOperacoes: number;
  valorTotalComprado: number;
  totalRecebimentos: number;
  valorTotalRecebido: number;
  recebimentosComDivergencia: number;
  leadTimeMedio: number;
  ultimoPedidoEm: string;
  ultimaEntradaEm: string;
  score: number;
  selo: "excelente" | "bom" | "atencao" | "critico";
  scorePrazo: number;
  scoreDivergencia: number;
  scoreVolume: number;
  scoreRecorrencia: number;
  semHistorico: boolean;
};

function seloLabel(selo: SupplierDashboardRow["selo"]) {
  switch (selo) {
    case "excelente":
      return "Excelente";
    case "bom":
      return "Bom";
    case "atencao":
      return "Atenção";
    case "critico":
      return "Crítico";
    default:
      return selo;
  }
}

function seloClass(selo: SupplierDashboardRow["selo"]) {
  switch (selo) {
    case "excelente":
      return "bg-green-100 text-green-800";
    case "bom":
      return "bg-blue-100 text-blue-800";
    case "atencao":
      return "bg-yellow-100 text-yellow-800";
    case "critico":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function historicoClass() {
  return "bg-gray-100 text-gray-700";
}

function supplierMatchesInvoiceEntry(
  supplier: Supplier,
  entry: DashboardInvoiceEntry
) {
  const supplierName = normalizeText(supplier.razaoSocial);
  const supplierFantasyName = normalizeText(
    "nomeFantasia" in supplier ? String((supplier as any).nomeFantasia ?? "") : ""
  );
  const entryName = normalizeText(entry.supplier_name);

  const supplierDocument = onlyDigits(
    "cnpj" in supplier ? String((supplier as any).cnpj ?? "") : ""
  );
  const entryDocument = onlyDigits(entry.supplier_document);

  const documentMatches =
    supplierDocument.length > 0 &&
    entryDocument.length > 0 &&
    supplierDocument === entryDocument;

  const nameMatches =
    entryName.length > 0 &&
    (entryName === supplierName ||
      entryName === supplierFantasyName ||
      supplierName.includes(entryName) ||
      entryName.includes(supplierName));

  return documentMatches || nameMatches;
}

export default function DashboardFornecedoresPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [receipts, setReceipts] = useState<GoodsReceipt[]>([]);
  const [invoiceEntries, setInvoiceEntries] = useState<DashboardInvoiceEntry[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [safeMode, setSafeMode] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "todos" | "ativos" | "inativos"
  >("todos");
  const [sealFilter, setSealFilter] = useState<
    "todos" | "excelente" | "bom" | "atencao" | "critico" | "sem_historico"
  >("todos");

  const loadListWithFallback = useCallback(
    async <T,>(loader: () => Promise<T[]>, label: string) => {
      try {
        return {
          data: await loader(),
          usedFallback: false,
        };
      } catch (err) {
        if (!isLegacyTableMissingError(err)) {
          throw err;
        }

        console.warn(
          `[fornecedores.dashboard] tabela legada ausente para ${label}; usando fallback vazio.`,
          err
        );

        return {
          data: [] as T[],
          usedFallback: true,
        };
      }
    },
    []
  );

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setSafeMode(false);

      const [suppliersResult, ordersResult, receiptsResult, entriesResult] =
        await Promise.all([
          loadListWithFallback(listSuppliers, "fornecedores"),
          loadListWithFallback(listPurchaseOrders, "pedidos"),
          loadListWithFallback(listGoodsReceipts, "recebimentos"),
          loadListWithFallback(listDashboardInvoiceEntries, "entradas"),
        ]);

      setSuppliers(suppliersResult.data);
      setOrders(ordersResult.data);
      setReceipts(receiptsResult.data);
      setInvoiceEntries(entriesResult.data);

      setSafeMode(
        suppliersResult.usedFallback ||
          ordersResult.usedFallback ||
          receiptsResult.usedFallback ||
          entriesResult.usedFallback
      );
    } catch (err) {
      console.error(err);
      setError("Não foi possível carregar o dashboard de fornecedores.");
    } finally {
      setLoading(false);
    }
  }, [loadListWithFallback]);

  const dashboardRows = useMemo(() => {
    return suppliers.map((supplier) => {
      const supplierOrders = orders.filter(
        (order) => order.supplierId === supplier.id
      );

      const orderIds = supplierOrders.map((order) => order.id);

      const supplierReceipts = receipts.filter((receipt) =>
        orderIds.includes(receipt.purchaseOrderId)
      );

      const supplierEntries = invoiceEntries.filter(
        (entry) =>
          entry.status !== "cancelled" &&
          supplierMatchesInvoiceEntry(supplier, entry)
      );

      const leadTimes: number[] = [];

      for (const order of supplierOrders) {
        const relatedReceipts = supplierReceipts
          .filter((receipt) => receipt.purchaseOrderId === order.id)
          .sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));

        const firstReceipt = relatedReceipts[0];
        const diff = diffDays(order.createdAt, firstReceipt?.createdAt);

        if (diff !== null) {
          leadTimes.push(diff);
        }
      }

      for (const entry of supplierEntries) {
        const diff = diffDays(entry.issue_date, entry.entry_date ?? undefined);

        if (diff !== null) {
          leadTimes.push(diff);
        }
      }

      const totalPedidos = supplierOrders.length;
      const totalEntradas = supplierEntries.length;
      const totalOperacoes = totalPedidos + totalEntradas;

      const valorTotalPedidos = supplierOrders.reduce(
        (acc, item) => acc + Number(item.valorTotal || 0),
        0
      );

      const valorTotalEntradas = supplierEntries.reduce(
        (acc, item) => acc + Number(item.total_amount || 0),
        0
      );

      const totalRecebimentos = supplierReceipts.length + supplierEntries.length;

      const valorTotalRecebido =
        supplierReceipts.reduce(
          (acc, item) => acc + Number(item.valorTotalRecebido || 0),
          0
        ) + valorTotalEntradas;

      const valorTotalComprado = valorTotalPedidos + valorTotalEntradas;

      const recebimentosComDivergencia = supplierReceipts.filter(
        (item) => item.status === "divergencia"
      ).length;

      const leadTimeMedio =
        leadTimes.length > 0
          ? Math.round(
              leadTimes.reduce((acc, item) => acc + item, 0) / leadTimes.length
            )
          : 0;

      const ultimoPedido =
        supplierOrders
          .map((item) => item.createdAt || "")
          .sort((a, b) => b.localeCompare(a))[0] || "";

      const ultimaEntrada =
        supplierEntries
          .map((item) => item.entry_date || item.created_at || "")
          .sort((a, b) => b.localeCompare(a))[0] || "";

      const scoreResult = calculateSupplierScore({
        totalPedidos,
        totalEntradas,
        valorTotalComprado,
        recebimentosComDivergencia,
        totalRecebimentos,
        leadTimeMedio,
      });

      return {
        supplierId: supplier.id,
        supplierName: supplier.razaoSocial,
        ativo: Boolean(supplier.ativo),
        totalPedidos,
        totalEntradas,
        totalOperacoes,
        valorTotalComprado,
        totalRecebimentos,
        valorTotalRecebido,
        recebimentosComDivergencia,
        leadTimeMedio,
        ultimoPedidoEm: ultimoPedido,
        ultimaEntradaEm: ultimaEntrada,
        score: scoreResult.score,
        selo: scoreResult.selo,
        scorePrazo: scoreResult.scorePrazo,
        scoreDivergencia: scoreResult.scoreDivergencia,
        scoreVolume: scoreResult.scoreVolume,
        scoreRecorrencia: scoreResult.scoreRecorrencia,
        semHistorico: scoreResult.semHistorico,
      } as SupplierDashboardRow;
    });
  }, [suppliers, orders, receipts, invoiceEntries]);

  const filteredRows = useMemo(() => {
    return dashboardRows
      .filter((item) => {
        const searchOk =
          !search ||
          item.supplierName.toLowerCase().includes(search.toLowerCase());

        const statusOk =
          statusFilter === "todos" ||
          (statusFilter === "ativos" && item.ativo) ||
          (statusFilter === "inativos" && !item.ativo);

        const sealOk =
          sealFilter === "todos" ||
          (sealFilter === "sem_historico" && item.semHistorico) ||
          (!item.semHistorico && item.selo === sealFilter);

        return searchOk && statusOk && sealOk;
      })
      .sort((a, b) => {
        if (a.semHistorico && !b.semHistorico) return 1;
        if (!a.semHistorico && b.semHistorico) return -1;
        return b.score - a.score;
      });
  }, [dashboardRows, search, statusFilter, sealFilter]);

  const rowsWithHistory = useMemo(() => {
    return filteredRows.filter((item) => !item.semHistorico);
  }, [filteredRows]);

  const metrics = useMemo(() => {
    return {
      totalFornecedores: filteredRows.length,
      ativos: filteredRows.filter((item) => item.ativo).length,
      excelentes: filteredRows.filter(
        (item) => !item.semHistorico && item.selo === "excelente"
      ).length,
      criticos: filteredRows.filter(
        (item) => !item.semHistorico && item.selo === "critico"
      ).length,
      semHistorico: filteredRows.filter((item) => item.semHistorico).length,
      comHistorico: filteredRows.filter((item) => !item.semHistorico).length,
      totalEntradas: filteredRows.reduce(
        (acc, item) => acc + item.totalEntradas,
        0
      ),
      valorTotalComprado: filteredRows.reduce(
        (acc, item) => acc + item.valorTotalComprado,
        0
      ),
    };
  }, [filteredRows]);

  const topByScore = useMemo(() => {
    if (rowsWithHistory.length > 0) {
      return rowsWithHistory.slice(0, 10);
    }

    return filteredRows.slice(0, 10);
  }, [rowsWithHistory, filteredRows]);

  const criticalSuppliers = useMemo(() => {
    return filteredRows
      .filter(
        (item) =>
          !item.semHistorico &&
          (item.selo === "critico" || item.selo === "atencao")
      )
      .sort((a, b) => a.score - b.score)
      .slice(0, 10);
  }, [filteredRows]);

  const melhorScore = useMemo(() => {
    if (rowsWithHistory.length === 0) return 0;
    return rowsWithHistory[0]?.score ?? 0;
  }, [rowsWithHistory]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard de Fornecedores</h1>
          <p className="text-sm text-gray-500">
            Score e desempenho executivo dos fornecedores.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/compras/fornecedores"
            className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Ver fornecedores
          </Link>

          <Link
            href="/compras/pedidos"
            className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Ver pedidos
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Carregando dashboard...</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      ) : (
        <>
          {safeMode ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
              <p className="text-sm text-amber-900">
                O dashboard foi carregado em modo seguro porque alguma tabela
                ligada a fornecedores, pedidos, recebimentos ou entradas ainda
                não está totalmente provisionada neste banco.
              </p>
            </div>
          ) : null}

          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
            <p className="text-sm text-blue-900">
              O histórico agora considera também as notas lançadas na sessão de
              Entradas. Fornecedores com notas registradas deixam de aparecer
              como sem histórico e passam a compor o score.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">Fornecedores</div>
              <div className="mt-2 text-2xl font-bold">
                {metrics.totalFornecedores}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                {metrics.ativos} ativos
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">Com histórico</div>
              <div className="mt-2 text-2xl font-bold">
                {metrics.comHistorico}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                Pedidos ou entradas
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">Entradas</div>
              <div className="mt-2 text-2xl font-bold">
                {metrics.totalEntradas}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                Notas lançadas
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">Excelentes</div>
              <div className="mt-2 text-2xl font-bold">
                {metrics.excelentes}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                Apenas com histórico
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">Críticos</div>
              <div className="mt-2 text-2xl font-bold">{metrics.criticos}</div>
              <div className="mt-1 text-xs text-gray-500">
                Apenas com histórico
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">Melhor score</div>
              <div className="mt-2 text-2xl font-bold">{melhorScore}</div>
              <div className="mt-1 text-xs text-gray-500">
                Com histórico real
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="text-sm text-gray-500">Valor total registrado</div>
            <div className="mt-2 text-2xl font-bold">
              {formatCurrency(metrics.valorTotalComprado)}
            </div>
            <div className="mt-1 text-xs text-gray-500">
              Pedidos + entradas de notas fiscais
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Buscar fornecedor
                </label>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border px-3 py-2 outline-none"
                  placeholder="Nome do fornecedor"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(
                      e.target.value as "todos" | "ativos" | "inativos"
                    )
                  }
                  className="w-full rounded-xl border px-3 py-2 outline-none"
                >
                  <option value="todos">Todos</option>
                  <option value="ativos">Ativos</option>
                  <option value="inativos">Inativos</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Selo</label>
                <select
                  value={sealFilter}
                  onChange={(e) =>
                    setSealFilter(
                      e.target.value as
                        | "todos"
                        | "excelente"
                        | "bom"
                        | "atencao"
                        | "critico"
                        | "sem_historico"
                    )
                  }
                  className="w-full rounded-xl border px-3 py-2 outline-none"
                >
                  <option value="todos">Todos</option>
                  <option value="excelente">Excelente</option>
                  <option value="bom">Bom</option>
                  <option value="atencao">Atenção</option>
                  <option value="critico">Crítico</option>
                  <option value="sem_historico">Sem histórico</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">
                Top fornecedores por score
              </h2>

              {topByScore.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhum dado encontrado.</p>
              ) : rowsWithHistory.length === 0 ? (
                <div className="space-y-3">
                  <p className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                    Ainda não existem entradas, pedidos ou recebimentos
                    vinculados aos fornecedores listados.
                  </p>

                  {topByScore.map((item) => (
                    <div
                      key={item.supplierId}
                      className="rounded-xl border px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="font-medium">{item.supplierName}</div>
                          <div className="mt-1">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-medium ${historicoClass()}`}
                            >
                              Sem histórico
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-xl font-bold">—</div>
                          <div className="text-xs text-gray-500">
                            sem entradas vinculadas
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {topByScore.map((item) => (
                    <div
                      key={item.supplierId}
                      className="rounded-xl border px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="font-medium">{item.supplierName}</div>
                          <div className="mt-1 flex flex-wrap gap-2">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-medium ${
                                item.semHistorico
                                  ? historicoClass()
                                  : seloClass(item.selo)
                              }`}
                            >
                              {item.semHistorico
                                ? "Sem histórico"
                                : seloLabel(item.selo)}
                            </span>

                            {!item.semHistorico ? (
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                                {item.totalEntradas} entradas
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-xl font-bold">
                            {item.semHistorico ? "—" : item.score}
                          </div>
                          <div className="text-xs text-gray-500">
                            {item.semHistorico
                              ? "sem entradas vinculadas"
                              : "score final"}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">
                Fornecedores que exigem atenção
              </h2>

              {criticalSuppliers.length === 0 ? (
                <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                  <p className="text-sm font-medium text-green-900">
                    Nenhum fornecedor crítico ou em atenção.
                  </p>
                  <p className="mt-1 text-sm text-green-800">
                    As entradas registradas foram consideradas no histórico. No
                    momento, nenhum fornecedor com histórico real está em
                    situação crítica ou de atenção.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {criticalSuppliers.map((item) => (
                    <div
                      key={item.supplierId}
                      className="rounded-xl border px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="font-medium">{item.supplierName}</div>
                          <div className="text-xs text-gray-500">
                            Divergências: {item.recebimentosComDivergencia} •
                            Lead time: {item.leadTimeMedio} dias • Entradas:{" "}
                            {item.totalEntradas} • Operações:{" "}
                            {item.totalOperacoes}
                          </div>
                        </div>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${seloClass(
                            item.selo
                          )}`}
                        >
                          {seloLabel(item.selo)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">
              Resumo geral por fornecedor
            </h2>

            {filteredRows.length === 0 ? (
              <p className="text-sm text-gray-500">
                Nenhum fornecedor encontrado.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-left">
                      <th className="px-4 py-3 font-medium">Fornecedor</th>
                      <th className="px-4 py-3 font-medium">Score</th>
                      <th className="px-4 py-3 font-medium">Selo</th>
                      <th className="px-4 py-3 font-medium">Prazo</th>
                      <th className="px-4 py-3 font-medium">Divergência</th>
                      <th className="px-4 py-3 font-medium">Volume</th>
                      <th className="px-4 py-3 font-medium">Recorrência</th>
                      <th className="px-4 py-3 font-medium">Entradas</th>
                      <th className="px-4 py-3 font-medium">Pedidos</th>
                      <th className="px-4 py-3 font-medium">Última entrada</th>
                      <th className="px-4 py-3 font-medium">Valor</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredRows.map((item) => (
                      <tr key={item.supplierId} className="border-b">
                        <td className="px-4 py-3 font-medium">
                          <Link
                            href={`/compras/fornecedores/${item.supplierId}`}
                            className="underline"
                          >
                            {item.supplierName}
                          </Link>
                        </td>

                        <td className="px-4 py-3 font-bold">
                          {item.semHistorico ? "—" : item.score}
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium ${
                              item.semHistorico
                                ? historicoClass()
                                : seloClass(item.selo)
                            }`}
                          >
                            {item.semHistorico
                              ? "Sem histórico"
                              : seloLabel(item.selo)}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          {item.semHistorico ? "—" : item.scorePrazo}
                        </td>

                        <td className="px-4 py-3">
                          {item.semHistorico ? "—" : item.scoreDivergencia}
                        </td>

                        <td className="px-4 py-3">
                          {item.semHistorico ? "—" : item.scoreVolume}
                        </td>

                        <td className="px-4 py-3">
                          {item.semHistorico ? "—" : item.scoreRecorrencia}
                        </td>

                        <td className="px-4 py-3">{item.totalEntradas}</td>

                        <td className="px-4 py-3">{item.totalPedidos}</td>

                        <td className="px-4 py-3">
                          {formatDate(item.ultimaEntradaEm)}
                        </td>

                        <td className="px-4 py-3">
                          {formatCurrency(item.valorTotalComprado)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}