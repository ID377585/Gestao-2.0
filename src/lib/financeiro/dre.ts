"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/tenant/get-current-tenant";
import { classifyDreBucket } from "@/lib/financeiro/dre-classification";
import { listLosses, type LossEntry } from "@/lib/financeiro/losses";
import {
  listProductCosts,
  type ProductCostInfo,
} from "@/lib/financeiro/product-costs";
import { getTechnicalSheetMetricsSummary } from "@/lib/financeiro/technical-sheet-metrics";
import { getTechnicalSheetVarianceSummary } from "@/lib/financeiro/technical-sheet-variance";
import type { AccountPayable, AccountReceivable } from "@/types/compras";

export type DreFilters = {
  dateFrom?: string;
  dateTo?: string;
};

export type DreLine = {
  key: string;
  label: string;
  value: number;
};

export type DreAlertLevel = "info" | "warning" | "danger";

export type DreAlert = {
  key: string;
  title: string;
  description: string;
  level: DreAlertLevel;
};

export type DreInsight = {
  key: string;
  label: string;
};

export type DreSummary = {
  receitaBruta: number;
  deducoesImpostos: number;
  receitaLiquida: number;
  cmv: number;
  cmvComPerdasValorizadas: number;
  perdasValorizadas: number;
  perdasNaoValorizadasQuantidade: number;
  lucroBruto: number;
  lucroBrutoAjustado: number;
  despesasOperacionais: number;
  ebitda: number;
  resultadoFinanceiro: number;
  impostosResultado: number;
  lucroLiquido: number;
  lucroLiquidoAjustado: number;
};

export type DreLossCostSourceSummary = {
  goodsReceipt: number;
  productFallback: number;
  semCusto: number;
};

export type DreLossesSummary = {
  totalRegistros: number;
  totalQuantidade: number;
  totalQuantidadeValorizada: number;
  totalValorEstimado: number;
  principaisMotivos: { name: string; value: number }[];
  fontesCusto: DreLossCostSourceSummary;
};

export type DreTechnicalSheetsSummary = {
  totalSheets: number;
  averageCostPerPortion: number;
  averageSalePrice: number;
  averageTheoreticalCmvPercent: number;
  highestTheoreticalCmv?: {
    id: string;
    name: string;
    value: number;
  };
  lowestMargin?: {
    id: string;
    name: string;
    value: number;
  };
  topCriticalSheets: Array<{
    id: string;
    name: string;
    cmvPercent: number;
    salePrice: number;
    costPerPortion: number;
    marginValue: number;
  }>;
};

export type DreTechnicalSheetVarianceSummary = {
  totalIngredientsLinked: number;
  totalIngredientsWithRealCost: number;
  averageVariancePercent: number;
  totalPositiveVarianceValue: number;
  totalNegativeVarianceValue: number;
  topIngredientsAboveTheoretical: Array<{
    name: string;
    value: number;
  }>;
  topSheetsByExposure: Array<{
    name: string;
    value: number;
  }>;
};

export type DreDashboardData = {
  summary: DreSummary;
  lines: DreLine[];
  cards: {
    margemLiquida: number;
    margemLiquidaAjustada: number;
    margemBruta: number;
    margemBrutaAjustada: number;
    cmvPercentual: number;
    cmvAjustadoPercentual: number;
    cmvTeoricoPercentual: number;
    despesasPercentual: number;
    perdasQuantidade: number;
    perdasRegistros: number;
    perdasValorEstimado: number;
    fichasTecnicasQuantidade: number;
    variacaoMediaIngredientesPercentual: number;
  };
  alerts: DreAlert[];
  insights: DreInsight[];
  losses: DreLossesSummary;
  technicalSheets: DreTechnicalSheetsSummary;
  technicalSheetVariance: DreTechnicalSheetVarianceSummary;
  charts: {
    composicaoDre: { name: string; value: number }[];
    receitasVsDespesas: {
      periodo: string;
      receitas: number;
      despesas: number;
      lucro: number;
      lucroAjustado: number;
    }[];
    despesasPorCategoria: { name: string; value: number }[];
    despesasPorCentroCusto: { name: string; value: number }[];
    topDespesas: { name: string; value: number }[];
    perdasPorMotivo: { name: string; value: number }[];
    perdasPorFonteCusto: { name: string; value: number }[];
    topFichasCriticas: { name: string; value: number }[];
    comparativoCmv: { name: string; value: number }[];
    ingredientesAcimaTeorico: { name: string; value: number }[];
    fichasPorExposicao: { name: string; value: number }[];
  };
};

type InvoiceEntry = {
  id: string;
  supplier_name: string;
  supplier_document: string | null;
  invoice_number: string;
  issue_date: string;
  entry_date: string;
  total_amount: number;
  status: string;
  created_at: string;
};

const CMV_TARGET_PERCENT = 35;
const DESPESAS_TARGET_PERCENT = 20;
const LOSS_COUNT_WARNING = 5;
const LOSS_QTY_WARNING = 20;

const emptyTechnicalSheetSummary: DreTechnicalSheetsSummary = {
  totalSheets: 0,
  averageCostPerPortion: 0,
  averageSalePrice: 0,
  averageTheoreticalCmvPercent: 0,
  topCriticalSheets: [],
};

const emptyTechnicalSheetVarianceSummary: DreTechnicalSheetVarianceSummary = {
  totalIngredientsLinked: 0,
  totalIngredientsWithRealCost: 0,
  averageVariancePercent: 0,
  totalPositiveVarianceValue: 0,
  totalNegativeVarianceValue: 0,
  topIngredientsAboveTheoretical: [],
  topSheetsByExposure: [],
};

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toText(value: unknown, fallback = "") {
  if (typeof value === "string") return value;
  if (value == null) return fallback;
  return String(value);
}

function inRange(date: string | undefined, filters: DreFilters) {
  if (!date) return false;

  const normalizedDate = String(date).slice(0, 10);

  if (filters.dateFrom && normalizedDate < filters.dateFrom) return false;
  if (filters.dateTo && normalizedDate > filters.dateTo) return false;

  return true;
}

function monthKey(date?: string) {
  if (!date) return "Sem data";
  return String(date).slice(0, 7);
}

function sum(items: number[]) {
  return items.reduce((acc, value) => acc + Number(value || 0), 0);
}

function percent(value: number, base: number) {
  if (!base) return 0;
  return (value / base) * 100;
}

function isReceivableActive(item: AccountReceivable) {
  return item.statusRecebimento !== "cancelado";
}

function isPayableActive(item: AccountPayable) {
  return item.statusPagamento !== "cancelado";
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function isGoodsReceiptSource(cost: ProductCostInfo | undefined) {
  return cost?.sourceField === "goods_receipt";
}

function isMissingTableError(error: unknown) {
  const message =
    error instanceof Error ? error.message : String(error ?? "");

  return (
    message.includes("does not exist") ||
    message.includes("Could not find the table") ||
    message.includes("Could not find") ||
    message.includes("relation") ||
    message.includes("schema cache") ||
    message.includes("column")
  );
}

function buildLossReasonMap(losses: LossEntry[]) {
  const reasonMap = new Map<string, number>();

  for (const loss of losses) {
    const reason = loss.reason || "Sem motivo";
    reasonMap.set(reason, (reasonMap.get(reason) ?? 0) + Number(loss.qty || 0));
  }

  return Array.from(reasonMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function normalizeInvoiceEntry(raw: any): InvoiceEntry {
  return {
    id: String(raw.id ?? ""),
    supplier_name: String(
      raw.supplier_name ??
        raw.supplierName ??
        raw.fornecedor_nome ??
        raw.fornecedor ??
        ""
    ),
    supplier_document:
      raw.supplier_document ||
      raw.supplierDocument ||
      raw.fornecedor_documento ||
      raw.cnpj
        ? String(
            raw.supplier_document ??
              raw.supplierDocument ??
              raw.fornecedor_documento ??
              raw.cnpj
          )
        : null,
    invoice_number: String(
      raw.invoice_number ??
        raw.invoiceNumber ??
        raw.numero_nota ??
        raw.nota ??
        ""
    ),
    issue_date: String(
      raw.issue_date ??
        raw.issueDate ??
        raw.data_emissao ??
        raw.created_at ??
        ""
    ),
    entry_date: String(
      raw.entry_date ??
        raw.entryDate ??
        raw.data_entrada ??
        raw.created_at ??
        ""
    ),
    total_amount: toNumber(
      raw.total_amount ?? raw.totalAmount ?? raw.valor_total ?? raw.total ?? 0
    ),
    status: String(raw.status ?? "active"),
    created_at: String(raw.created_at ?? raw.createdAt ?? ""),
  };
}

async function readTableSafely(tableName: string) {
  try {
    const tenant = await getCurrentTenant();

    if (!tenant?.establishmentId) {
      return [];
    }

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .eq("establishment_id", tenant.establishmentId)
      .limit(5000);

    if (error) {
      throw error;
    }

    return Array.isArray(data) ? data : [];
  } catch (error) {
    if (isMissingTableError(error)) {
      return [];
    }

    console.warn(`[dre] Não foi possível ler a tabela ${tableName}.`, error);
    return [];
  }
}

function normalizeDrePayable(row: Record<string, unknown>): AccountPayable {
  return {
    id: toText(row.id),
    origem: toText(row.origem, "compra") as AccountPayable["origem"],
    origemId: toText(row.origem_id),
    supplierId: toText(row.supplier_id),
    supplierName: toText(row.supplier_name),
    descricao: toText(row.descricao),
    valor: toNumber(row.valor),
    vencimento: toText(row.vencimento),
    statusPagamento: toText(
      row.status_pagamento,
      "pendente"
    ) as AccountPayable["statusPagamento"],
    dataPagamento: toText(row.data_pagamento),
    formaPagamento: toText(row.forma_pagamento),
    bankAccountId: toText(row.bank_account_id),
    bankAccountName: toText(row.bank_account_name),
    numeroDocumento: toText(row.numero_documento),
    categoriaId: toText(row.categoria_id),
    categoria: toText(row.categoria),
    centroCustoId: toText(row.centro_custo_id),
    centroCusto: toText(row.centro_custo),
    observacoes: toText(row.observacoes),
    createdAt: toText(row.created_at),
    updatedAt: toText(row.updated_at),
  };
}

function normalizeDreReceivable(row: Record<string, unknown>): AccountReceivable {
  return {
    id: toText(row.id),
    origem: toText(row.origem, "manual") as AccountReceivable["origem"],
    origemId: toText(row.origem_id),
    customerId: toText(row.customer_id),
    customerName: toText(row.customer_name),
    descricao: toText(row.descricao),
    valor: toNumber(row.valor),
    vencimento: toText(row.vencimento),
    statusRecebimento: toText(
      row.status_recebimento,
      "pendente"
    ) as AccountReceivable["statusRecebimento"],
    dataRecebimento: toText(row.data_recebimento),
    formaRecebimento: toText(row.forma_recebimento),
    bankAccountId: toText(row.bank_account_id),
    bankAccountName: toText(row.bank_account_name),
    observacoes: toText(row.observacoes),
    categoriaId: toText(row.categoria_id),
    categoria: toText(row.categoria),
    createdAt: toText(row.created_at),
    updatedAt: toText(row.updated_at),
  };
}

async function loadInvoiceEntries(filters: DreFilters): Promise<InvoiceEntry[]> {
  const possibleTables = [
    "invoice_entries",
    "compras_invoice_entries",
    "purchase_invoice_entries",
    "entrada_notas",
    "entradas_notas",
    "invoice_entry",
    "invoice_entries_v3",
  ];

  for (const tableName of possibleTables) {
    const rows = await readTableSafely(tableName);

    if (rows.length > 0) {
      return rows
        .map(normalizeInvoiceEntry)
        .filter((item) => item.status !== "cancelled")
        .filter((item) =>
          inRange(item.entry_date || item.issue_date || item.created_at, filters)
        );
    }
  }

  return [];
}

async function safeListAccountsPayable() {
  try {
    const rows = await readTableSafely("accounts_payable");
    return rows.map((row) =>
      normalizeDrePayable(row as Record<string, unknown>)
    );
  } catch (error) {
    if (isMissingTableError(error)) {
      return [] as AccountPayable[];
    }

    console.warn("[dre] Não foi possível carregar contas a pagar.", error);
    return [] as AccountPayable[];
  }
}

async function safeListAccountsReceivable() {
  try {
    const rows = await readTableSafely("accounts_receivable");
    return rows.map((row) =>
      normalizeDreReceivable(row as Record<string, unknown>)
    );
  } catch (error) {
    if (isMissingTableError(error)) {
      return [] as AccountReceivable[];
    }

    console.warn("[dre] Não foi possível carregar contas a receber.", error);
    return [] as AccountReceivable[];
  }
}

async function safeListLosses(filters: DreFilters) {
  try {
    return await listLosses(filters);
  } catch (error) {
    if (isMissingTableError(error)) {
      return [] as LossEntry[];
    }

    console.warn("[dre] Não foi possível carregar perdas.", error);
    return [] as LossEntry[];
  }
}

async function safeListProductCosts() {
  try {
    return await listProductCosts();
  } catch (error) {
    if (isMissingTableError(error)) {
      return new Map<string, ProductCostInfo>();
    }

    console.warn("[dre] Não foi possível carregar custos dos produtos.", error);
    return new Map<string, ProductCostInfo>();
  }
}

async function safeGetTechnicalSheetMetricsSummary() {
  try {
    return await getTechnicalSheetMetricsSummary();
  } catch (error) {
    if (isMissingTableError(error)) {
      return emptyTechnicalSheetSummary;
    }

    console.warn("[dre] Não foi possível carregar métricas de fichas técnicas.", error);
    return emptyTechnicalSheetSummary;
  }
}

async function safeGetTechnicalSheetVarianceSummary() {
  try {
    return await getTechnicalSheetVarianceSummary();
  } catch (error) {
    if (isMissingTableError(error)) {
      return emptyTechnicalSheetVarianceSummary;
    }

    console.warn("[dre] Não foi possível carregar variação de fichas técnicas.", error);
    return emptyTechnicalSheetVarianceSummary;
  }
}

function buildAlerts(params: {
  receitaLiquida: number;
  lucroLiquido: number;
  lucroLiquidoAjustado: number;
  cmvPercentual: number;
  cmvAjustadoPercentual: number;
  cmvTeoricoPercentual: number;
  despesasPercentual: number;
  totalLosses: number;
  totalLossQty: number;
  perdasValorizadas: number;
  perdasNaoValorizadasQuantidade: number;
  goodsReceiptLossQty: number;
  technicalSheetsCount: number;
  technicalSheetHighestCmv?: { name: string; value: number };
  technicalSheetLowestMargin?: { name: string; value: number };
  varianceAveragePercent: number;
  variancePositiveValue: number;
  varianceTopIngredient?: { name: string; value: number };
  varianceTopSheet?: { name: string; value: number };
  topLossReason?: { name: string; value: number };
  lucroSerie: { periodo: string; lucro: number; lucroAjustado: number }[];
  entradasCount: number;
}): DreAlert[] {
  const alerts: DreAlert[] = [];

  if (params.entradasCount > 0) {
    alerts.push({
      key: "entradas-consideradas-dre",
      title: "Entradas consideradas na DRE gerencial",
      description:
        "As notas lançadas em Entradas foram consideradas como custo/CMV enquanto o financeiro formal não estiver totalmente provisionado.",
      level: "info",
    });
  }

  if (params.receitaLiquida <= 0 && params.entradasCount > 0) {
    alerts.push({
      key: "sem-receita-com-entradas",
      title: "Há custos de entrada, mas nenhuma receita no período",
      description:
        "Foram encontradas notas de entrada no período, porém nenhuma conta a receber/receita. Para completar a DRE, registre receitas ou contas a receber.",
      level: "warning",
    });
  }

  if (params.cmvPercentual > CMV_TARGET_PERCENT) {
    alerts.push({
      key: "cmv-acima-meta",
      title: "CMV acima da meta",
      description: `O CMV está em ${formatPercent(
        params.cmvPercentual
      )}, acima da meta de ${formatPercent(CMV_TARGET_PERCENT)}.`,
      level:
        params.cmvPercentual >= CMV_TARGET_PERCENT + 5 ? "danger" : "warning",
    });
  }

  if (params.cmvAjustadoPercentual > CMV_TARGET_PERCENT) {
    alerts.push({
      key: "cmv-ajustado-acima-meta",
      title: "CMV ajustado com perdas acima da meta",
      description: `Considerando perdas valorizadas, o CMV ajustado está em ${formatPercent(
        params.cmvAjustadoPercentual
      )}.`,
      level:
        params.cmvAjustadoPercentual >= CMV_TARGET_PERCENT + 5
          ? "danger"
          : "warning",
    });
  }

  if (params.cmvTeoricoPercentual > CMV_TARGET_PERCENT) {
    alerts.push({
      key: "cmv-teorico-acima-meta",
      title: "CMV teórico das fichas acima da meta",
      description: `A média de CMV teórico das fichas está em ${formatPercent(
        params.cmvTeoricoPercentual
      )}.`,
      level:
        params.cmvTeoricoPercentual >= CMV_TARGET_PERCENT + 5
          ? "danger"
          : "warning",
    });
  }

  if (params.despesasPercentual > DESPESAS_TARGET_PERCENT) {
    alerts.push({
      key: "despesas-acima-meta",
      title: "Despesas operacionais acima do orçamento",
      description: `As despesas operacionais estão em ${formatPercent(
        params.despesasPercentual
      )}, acima da referência de ${formatPercent(DESPESAS_TARGET_PERCENT)}.`,
      level:
        params.despesasPercentual >= DESPESAS_TARGET_PERCENT + 5
          ? "danger"
          : "warning",
    });
  }

  const ordered = [...params.lucroSerie].sort((a, b) =>
    a.periodo.localeCompare(b.periodo)
  );

  if (ordered.length >= 2) {
    const last = ordered[ordered.length - 1];
    const prev = ordered[ordered.length - 2];

    if ((last?.lucro ?? 0) < (prev?.lucro ?? 0)) {
      alerts.push({
        key: "queda-lucro",
        title: "Lucro líquido em queda",
        description: "O lucro do último período ficou abaixo do período anterior.",
        level: "warning",
      });
    }

    if ((last?.lucroAjustado ?? 0) < (prev?.lucroAjustado ?? 0)) {
      alerts.push({
        key: "queda-lucro-ajustado",
        title: "Lucro ajustado em queda",
        description:
          "O lucro ajustado por perdas valorizadas caiu em relação ao período anterior.",
        level: "warning",
      });
    }
  }

  if (params.receitaLiquida > 0 && params.lucroLiquido < 0) {
    alerts.push({
      key: "prejuizo",
      title: "Resultado líquido negativo",
      description: "A operação fechou o período com prejuízo líquido.",
      level: "danger",
    });
  }

  if (params.receitaLiquida > 0 && params.lucroLiquidoAjustado < 0) {
    alerts.push({
      key: "prejuizo-ajustado",
      title: "Resultado ajustado negativo",
      description:
        "Considerando as perdas valorizadas, o resultado líquido ajustado fica negativo.",
      level: "danger",
    });
  }

  if (params.totalLosses >= LOSS_COUNT_WARNING || params.totalLossQty >= LOSS_QTY_WARNING) {
    const lossReasonText = params.topLossReason
      ? ` Principal motivo: ${params.topLossReason.name}.`
      : "";

    alerts.push({
      key: "perdas-operacionais",
      title: "Perdas operacionais relevantes",
      description: `Foram registradas ${params.totalLosses} perdas, totalizando ${params.totalLossQty} unidades no período.${lossReasonText}`,
      level: params.totalLossQty >= LOSS_QTY_WARNING * 2 ? "danger" : "warning",
    });
  }

  if (params.perdasValorizadas > 0) {
    alerts.push({
      key: "perdas-valorizadas",
      title: "Perdas com impacto financeiro identificado",
      description: `Foi estimado impacto financeiro nas perdas de ${params.perdasValorizadas.toLocaleString(
        "pt-BR",
        {
          style: "currency",
          currency: "BRL",
        }
      )}.`,
      level: "info",
    });
  }

  if (params.goodsReceiptLossQty > 0) {
    alerts.push({
      key: "perdas-com-custo-real",
      title: "Parte das perdas já usa custo real",
      description: `${params.goodsReceiptLossQty} unidades perdidas foram valorizadas com base em recebimentos reais.`,
      level: "info",
    });
  }

  if (params.perdasNaoValorizadasQuantidade > 0) {
    alerts.push({
      key: "perdas-sem-custo",
      title: "Há perdas sem custo associado",
      description: `${params.perdasNaoValorizadasQuantidade} unidades perdidas ainda estão sem custo de referência para valorização.`,
      level: "warning",
    });
  }

  if (params.technicalSheetsCount === 0) {
    alerts.push({
      key: "sem-fichas-tecnicas",
      title: "Sem fichas técnicas consolidadas",
      description:
        "A DRE não encontrou fichas técnicas suficientes para calcular CMV teórico.",
      level: "warning",
    });
  }

  if (
    params.technicalSheetHighestCmv &&
    params.technicalSheetHighestCmv.value > CMV_TARGET_PERCENT
  ) {
    alerts.push({
      key: "ficha-cmv-critico",
      title: "Ficha técnica com CMV teórico crítico",
      description: `${
        params.technicalSheetHighestCmv.name
      } está com CMV teórico de ${formatPercent(
        params.technicalSheetHighestCmv.value
      )}.`,
      level:
        params.technicalSheetHighestCmv.value >= CMV_TARGET_PERCENT + 10
          ? "danger"
          : "warning",
    });
  }

  if (
    params.technicalSheetLowestMargin &&
    params.technicalSheetLowestMargin.value <= 0
  ) {
    alerts.push({
      key: "ficha-sem-margem",
      title: "Ficha com margem unitária zerada ou negativa",
      description: `${
        params.technicalSheetLowestMargin.name
      } está com margem unitária de ${params.technicalSheetLowestMargin.value.toLocaleString(
        "pt-BR",
        {
          style: "currency",
          currency: "BRL",
        }
      )}.`,
      level: "danger",
    });
  }

  if (params.varianceAveragePercent > 10) {
    alerts.push({
      key: "variacao-media-acima-teorico",
      title: "Custo real acima do teórico em ingredientes",
      description: `A variação média dos ingredientes com custo real está em ${formatPercent(
        params.varianceAveragePercent
      )} acima do teórico.`,
      level: params.varianceAveragePercent >= 20 ? "danger" : "warning",
    });
  }

  if (params.varianceTopIngredient && params.varianceTopIngredient.value > 0) {
    alerts.push({
      key: "ingrediente-acima-teorico",
      title: "Ingrediente pressionando o custo",
      description: `${
        params.varianceTopIngredient.name
      } acumula desvio positivo de ${params.varianceTopIngredient.value.toLocaleString(
        "pt-BR",
        {
          style: "currency",
          currency: "BRL",
        }
      )} sobre o teórico.`,
      level: "warning",
    });
  }

  if (params.varianceTopSheet && params.varianceTopSheet.value > 0) {
    alerts.push({
      key: "ficha-exposta-custo-real",
      title: "Ficha com maior exposição a custo real",
      description: `${
        params.varianceTopSheet.name
      } concentra desvio positivo de ${params.varianceTopSheet.value.toLocaleString(
        "pt-BR",
        {
          style: "currency",
          currency: "BRL",
        }
      )} frente ao custo teórico.`,
      level: "warning",
    });
  }

  return alerts;
}

function buildInsights(params: {
  cmvPercentual: number;
  cmvAjustadoPercentual: number;
  cmvTeoricoPercentual: number;
  maiorCentroCusto?: { name: string; value: number };
  receitaLiquida: number;
  totalLosses: number;
  totalLossQty: number;
  perdasValorizadas: number;
  perdasNaoValorizadasQuantidade: number;
  goodsReceiptLossQty: number;
  technicalSheetsCount: number;
  technicalSheetHighestCmv?: { name: string; value: number };
  technicalSheetLowestMargin?: { name: string; value: number };
  varianceAveragePercent: number;
  varianceTopIngredient?: { name: string; value: number };
  varianceTopSheet?: { name: string; value: number };
  topLossReason?: { name: string; value: number };
  entradasCount: number;
  entradasTotal: number;
}): DreInsight[] {
  const insights: DreInsight[] = [];

  if (params.entradasCount > 0) {
    insights.push({
      key: "entradas-dre",
      label: `${params.entradasCount} notas de entrada foram consideradas na DRE gerencial, somando ${params.entradasTotal.toLocaleString(
        "pt-BR",
        {
          style: "currency",
          currency: "BRL",
        }
      )}.`,
    });
  }

  insights.push({
    key: "cmv",
    label: `CMV atual em ${formatPercent(params.cmvPercentual)} da receita líquida.`,
  });

  insights.push({
    key: "cmv-ajustado",
    label: `CMV ajustado com perdas valorizadas em ${formatPercent(
      params.cmvAjustadoPercentual
    )} da receita líquida.`,
  });

  insights.push({
    key: "cmv-teorico",
    label: `CMV teórico médio das fichas técnicas em ${formatPercent(
      params.cmvTeoricoPercentual
    )}.`,
  });

  insights.push({
    key: "variacao-media",
    label: `A variação média entre custo real e teórico dos ingredientes está em ${formatPercent(
      params.varianceAveragePercent
    )}.`,
  });

  insights.push({
    key: "perdas-operacionais",
    label: `Foram registradas ${params.totalLosses} perdas com ${params.totalLossQty} unidades descartadas no período.`,
  });

  if (params.receitaLiquida <= 0 && params.entradasCount > 0) {
    insights.push({
      key: "registrar-receitas",
      label:
        "Existem custos de entrada no período, mas não há receitas. Registre contas a receber/vendas para completar margem, EBITDA e lucro líquido.",
    });
  }

  if (params.perdasValorizadas > 0) {
    insights.push({
      key: "perdas-valor",
      label: `As perdas valorizadas somam ${params.perdasValorizadas.toLocaleString(
        "pt-BR",
        {
          style: "currency",
          currency: "BRL",
        }
      )}.`,
    });
  }

  if (params.goodsReceiptLossQty > 0) {
    insights.push({
      key: "perdas-custo-real",
      label: `${params.goodsReceiptLossQty} unidades perdidas já foram valorizadas com custo real de recebimento.`,
    });
  }

  if (params.perdasNaoValorizadasQuantidade > 0) {
    insights.push({
      key: "perdas-sem-custo",
      label: `${params.perdasNaoValorizadasQuantidade} unidades perdidas ainda dependem de custo cadastrado para valorização completa.`,
    });
  }

  if (params.technicalSheetsCount > 0) {
    insights.push({
      key: "fichas-ativas",
      label: `${params.technicalSheetsCount} fichas técnicas estão contribuindo para o monitoramento teórico do CMV.`,
    });
  }

  if (params.technicalSheetHighestCmv) {
    insights.push({
      key: "ficha-cmv-alto",
      label: `${
        params.technicalSheetHighestCmv.name
      } lidera o maior CMV teórico, com ${formatPercent(
        params.technicalSheetHighestCmv.value
      )}.`,
    });
  }

  if (params.technicalSheetLowestMargin) {
    insights.push({
      key: "ficha-menor-margem",
      label: `${params.technicalSheetLowestMargin.name} apresenta a menor margem unitária entre as fichas monitoradas.`,
    });
  }

  if (params.varianceTopIngredient) {
    insights.push({
      key: "ingrediente-critico",
      label: `${params.varianceTopIngredient.name} é o ingrediente com maior sobrecusto real sobre o teórico.`,
    });
  }

  if (params.varianceTopSheet) {
    insights.push({
      key: "ficha-critica-real",
      label: `${params.varianceTopSheet.name} é a ficha mais exposta ao desvio entre custo real e teórico.`,
    });
  }

  if (params.topLossReason) {
    insights.push({
      key: "motivo-perda",
      label: `${params.topLossReason.name} é o principal motivo de perda, com ${params.topLossReason.value} unidades.`,
    });
  }

  if (params.maiorCentroCusto && params.receitaLiquida > 0) {
    const percentual =
      (params.maiorCentroCusto.value / params.receitaLiquida) * 100;

    insights.push({
      key: "centro-custo",
      label: `${params.maiorCentroCusto.name} concentra ${formatPercent(
        percentual
      )} da receita líquida em despesas.`,
    });
  }

  return insights;
}

export async function getDreDashboardData(
  filters: DreFilters = {}
): Promise<DreDashboardData> {
  const [
    payables,
    receivables,
    losses,
    productCosts,
    technicalSheetSummary,
    technicalSheetVarianceSummary,
    invoiceEntries,
  ] = await Promise.all([
    safeListAccountsPayable(),
    safeListAccountsReceivable(),
    safeListLosses(filters),
    safeListProductCosts(),
    safeGetTechnicalSheetMetricsSummary(),
    safeGetTechnicalSheetVarianceSummary(),
    loadInvoiceEntries(filters),
  ]);

  const filteredPayables = payables.filter(
    (item) => isPayableActive(item) && inRange(item.vencimento, filters)
  );

  const filteredReceivables = receivables.filter(
    (item) => isReceivableActive(item) && inRange(item.vencimento, filters)
  );

  const receitaBruta = sum(filteredReceivables.map((item) => Number(item.valor)));

  const deducoesImpostos = sum(
    filteredReceivables
      .filter((item) => classifyDreBucket(item.categoria) === "deducoes_impostos")
      .map((item) => Number(item.valor))
  );

  const receitaLiquida = receitaBruta - deducoesImpostos;

  const cmvFinanceiro = sum(
    filteredPayables
      .filter((item) => classifyDreBucket(item.categoria) === "cmv")
      .map((item) => Number(item.valor))
  );

  const cmvEntradas = invoiceEntries.reduce(
    (acc, item) => acc + Number(item.total_amount || 0),
    0
  );

  const cmv = cmvFinanceiro + cmvEntradas;

  const perdasPorMotivo = buildLossReasonMap(losses);
  const totalLosses = losses.length;
  const totalLossQty = sum(losses.map((item) => Number(item.qty || 0)));

  let perdasValorizadas = 0;
  let totalQuantidadeValorizada = 0;
  let perdasNaoValorizadasQuantidade = 0;
  let goodsReceiptLossQty = 0;
  let productFallbackLossQty = 0;

  for (const loss of losses) {
    const qty = Number(loss.qty || 0);
    const costInfo = productCosts.get(String(loss.product_id));
    const unitCost = costInfo?.unitCost ?? null;

    if (unitCost == null) {
      perdasNaoValorizadasQuantidade += qty;
      continue;
    }

    perdasValorizadas += qty * unitCost;
    totalQuantidadeValorizada += qty;

    if (isGoodsReceiptSource(costInfo)) {
      goodsReceiptLossQty += qty;
    } else {
      productFallbackLossQty += qty;
    }
  }

  const cmvComPerdasValorizadas = cmv + perdasValorizadas;
  const lucroBruto = receitaLiquida - cmv;
  const lucroBrutoAjustado = receitaLiquida - cmvComPerdasValorizadas;

  const despesasOperacionais = sum(
    filteredPayables
      .filter((item) => classifyDreBucket(item.categoria) === "despesa_operacional")
      .map((item) => Number(item.valor))
  );

  const ebitda = lucroBruto - despesasOperacionais;

  const resultadoFinanceiro =
    -sum(
      filteredPayables
        .filter((item) => classifyDreBucket(item.categoria) === "resultado_financeiro")
        .map((item) => Number(item.valor))
    );

  const impostosResultado = sum(
    filteredPayables
      .filter((item) => classifyDreBucket(item.categoria) === "impostos_resultado")
      .map((item) => Number(item.valor))
  );

  const lucroLiquido = ebitda + resultadoFinanceiro - impostosResultado;
  const lucroLiquidoAjustado =
    lucroBrutoAjustado -
    despesasOperacionais +
    resultadoFinanceiro -
    impostosResultado;

  const byMonth = new Map<
    string,
    { receitas: number; despesas: number; perdasValorizadas: number }
  >();

  for (const receivable of filteredReceivables) {
    const key = monthKey(receivable.vencimento);
    const current = byMonth.get(key) ?? {
      receitas: 0,
      despesas: 0,
      perdasValorizadas: 0,
    };
    current.receitas += Number(receivable.valor || 0);
    byMonth.set(key, current);
  }

  for (const payable of filteredPayables) {
    const key = monthKey(payable.vencimento);
    const current = byMonth.get(key) ?? {
      receitas: 0,
      despesas: 0,
      perdasValorizadas: 0,
    };
    current.despesas += Number(payable.valor || 0);
    byMonth.set(key, current);
  }

  for (const entry of invoiceEntries) {
    const key = monthKey(entry.entry_date || entry.issue_date || entry.created_at);
    const current = byMonth.get(key) ?? {
      receitas: 0,
      despesas: 0,
      perdasValorizadas: 0,
    };
    current.despesas += Number(entry.total_amount || 0);
    byMonth.set(key, current);
  }

  for (const loss of losses) {
    const key = monthKey(loss.created_at);
    const current = byMonth.get(key) ?? {
      receitas: 0,
      despesas: 0,
      perdasValorizadas: 0,
    };

    const costInfo = productCosts.get(String(loss.product_id));
    const unitCost = costInfo?.unitCost ?? null;

    if (unitCost != null) {
      current.perdasValorizadas += Number(loss.qty || 0) * unitCost;
    }

    byMonth.set(key, current);
  }

  const receitasVsDespesas = Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([periodo, values]) => ({
      periodo,
      receitas: values.receitas,
      despesas: values.despesas,
      lucro: values.receitas - values.despesas,
      lucroAjustado:
        values.receitas - values.despesas - values.perdasValorizadas,
    }));

  const categoryMap = new Map<string, number>();
  const centerMap = new Map<string, number>();

  for (const payable of filteredPayables) {
    const categoria = payable.categoria || "Sem categoria";
    const centro = payable.centroCusto || "Sem centro de custo";

    categoryMap.set(
      categoria,
      (categoryMap.get(categoria) ?? 0) + Number(payable.valor || 0)
    );

    centerMap.set(
      centro,
      (centerMap.get(centro) ?? 0) + Number(payable.valor || 0)
    );
  }

  if (cmvEntradas > 0) {
    categoryMap.set(
      "Entradas / Notas fiscais",
      (categoryMap.get("Entradas / Notas fiscais") ?? 0) + cmvEntradas
    );

    centerMap.set(
      "Compras / Estoque",
      (centerMap.get("Compras / Estoque") ?? 0) + cmvEntradas
    );
  }

  const despesasPorCategoria = Array.from(categoryMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const despesasPorCentroCusto = Array.from(centerMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const cmvPercentual = percent(cmv, receitaLiquida);
  const cmvAjustadoPercentual = percent(
    cmvComPerdasValorizadas,
    receitaLiquida
  );
  const cmvTeoricoPercentual =
    technicalSheetSummary.averageTheoreticalCmvPercent;
  const despesasPercentual = percent(despesasOperacionais, receitaLiquida);
  const margemBruta = percent(lucroBruto, receitaLiquida);
  const margemBrutaAjustada = percent(lucroBrutoAjustado, receitaLiquida);
  const margemLiquida = percent(lucroLiquido, receitaLiquida);
  const margemLiquidaAjustada = percent(lucroLiquidoAjustado, receitaLiquida);

  const maiorCentroCusto = despesasPorCentroCusto[0];
  const topLossReason = perdasPorMotivo[0];
  const varianceTopIngredient =
    technicalSheetVarianceSummary.topIngredientsAboveTheoretical[0];
  const varianceTopSheet =
    technicalSheetVarianceSummary.topSheetsByExposure[0];

  const alerts = buildAlerts({
    receitaLiquida,
    lucroLiquido,
    lucroLiquidoAjustado,
    cmvPercentual,
    cmvAjustadoPercentual,
    cmvTeoricoPercentual,
    despesasPercentual,
    totalLosses,
    totalLossQty,
    perdasValorizadas,
    perdasNaoValorizadasQuantidade,
    goodsReceiptLossQty,
    technicalSheetsCount: technicalSheetSummary.totalSheets,
    technicalSheetHighestCmv: technicalSheetSummary.highestTheoreticalCmv,
    technicalSheetLowestMargin: technicalSheetSummary.lowestMargin,
    varianceAveragePercent: technicalSheetVarianceSummary.averageVariancePercent,
    variancePositiveValue:
      technicalSheetVarianceSummary.totalPositiveVarianceValue,
    varianceTopIngredient,
    varianceTopSheet,
    topLossReason,
    lucroSerie: receitasVsDespesas.map((item) => ({
      periodo: item.periodo,
      lucro: item.lucro,
      lucroAjustado: item.lucroAjustado,
    })),
    entradasCount: invoiceEntries.length,
  });

  const insights = buildInsights({
    cmvPercentual,
    cmvAjustadoPercentual,
    cmvTeoricoPercentual,
    maiorCentroCusto,
    receitaLiquida,
    totalLosses,
    totalLossQty,
    perdasValorizadas,
    perdasNaoValorizadasQuantidade,
    goodsReceiptLossQty,
    technicalSheetsCount: technicalSheetSummary.totalSheets,
    technicalSheetHighestCmv: technicalSheetSummary.highestTheoreticalCmv,
    technicalSheetLowestMargin: technicalSheetSummary.lowestMargin,
    varianceAveragePercent: technicalSheetVarianceSummary.averageVariancePercent,
    varianceTopIngredient,
    varianceTopSheet,
    topLossReason,
    entradasCount: invoiceEntries.length,
    entradasTotal: cmvEntradas,
  });

  return {
    summary: {
      receitaBruta,
      deducoesImpostos,
      receitaLiquida,
      cmv,
      cmvComPerdasValorizadas,
      perdasValorizadas,
      perdasNaoValorizadasQuantidade,
      lucroBruto,
      lucroBrutoAjustado,
      despesasOperacionais,
      ebitda,
      resultadoFinanceiro,
      impostosResultado,
      lucroLiquido,
      lucroLiquidoAjustado,
    },
    lines: [
      { key: "receitaBruta", label: "Receita Bruta", value: receitaBruta },
      {
        key: "deducoesImpostos",
        label: "(-) Deduções e impostos",
        value: -deducoesImpostos,
      },
      {
        key: "receitaLiquida",
        label: "Receita Líquida",
        value: receitaLiquida,
      },
      {
        key: "cmv",
        label: "(-) CMV / Entradas / Serviços",
        value: -cmv,
      },
      {
        key: "perdasValorizadas",
        label: "(-) Perdas valorizadas",
        value: -perdasValorizadas,
      },
      {
        key: "cmvComPerdasValorizadas",
        label: "CMV ajustado",
        value: -cmvComPerdasValorizadas,
      },
      { key: "lucroBruto", label: "Lucro Bruto", value: lucroBruto },
      {
        key: "lucroBrutoAjustado",
        label: "Lucro Bruto Ajustado",
        value: lucroBrutoAjustado,
      },
      {
        key: "despesasOperacionais",
        label: "(-) Despesas Operacionais",
        value: -despesasOperacionais,
      },
      { key: "ebitda", label: "EBITDA", value: ebitda },
      {
        key: "resultadoFinanceiro",
        label: "Resultado Financeiro",
        value: resultadoFinanceiro,
      },
      {
        key: "impostosResultado",
        label: "(-) Impostos",
        value: -impostosResultado,
      },
      { key: "lucroLiquido", label: "Lucro Líquido", value: lucroLiquido },
      {
        key: "lucroLiquidoAjustado",
        label: "Lucro Líquido Ajustado",
        value: lucroLiquidoAjustado,
      },
    ],
    cards: {
      margemLiquida,
      margemLiquidaAjustada,
      margemBruta,
      margemBrutaAjustada,
      cmvPercentual,
      cmvAjustadoPercentual,
      cmvTeoricoPercentual,
      despesasPercentual,
      perdasQuantidade: totalLossQty,
      perdasRegistros: totalLosses,
      perdasValorEstimado: perdasValorizadas,
      fichasTecnicasQuantidade: technicalSheetSummary.totalSheets,
      variacaoMediaIngredientesPercentual:
        technicalSheetVarianceSummary.averageVariancePercent,
    },
    alerts,
    insights,
    losses: {
      totalRegistros: totalLosses,
      totalQuantidade: totalLossQty,
      totalQuantidadeValorizada,
      totalValorEstimado: perdasValorizadas,
      principaisMotivos: perdasPorMotivo.slice(0, 8),
      fontesCusto: {
        goodsReceipt: goodsReceiptLossQty,
        productFallback: productFallbackLossQty,
        semCusto: perdasNaoValorizadasQuantidade,
      },
    },
    technicalSheets: technicalSheetSummary,
    technicalSheetVariance: technicalSheetVarianceSummary,
    charts: {
      composicaoDre: [
        { name: "Receita líquida", value: Math.max(receitaLiquida, 0) },
        { name: "CMV / Entradas", value: Math.max(cmv, 0) },
        { name: "Perdas valorizadas", value: Math.max(perdasValorizadas, 0) },
        {
          name: "Despesas operacionais",
          value: Math.max(despesasOperacionais, 0),
        },
        { name: "Impostos", value: Math.max(impostosResultado, 0) },
      ].filter((item) => item.value > 0),
      receitasVsDespesas,
      despesasPorCategoria,
      despesasPorCentroCusto,
      topDespesas: despesasPorCategoria.slice(0, 8),
      perdasPorMotivo: perdasPorMotivo.slice(0, 8),
      perdasPorFonteCusto: [
        { name: "Custo real de recebimento", value: goodsReceiptLossQty },
        { name: "Fallback cadastro produto", value: productFallbackLossQty },
        { name: "Sem custo", value: perdasNaoValorizadasQuantidade },
      ],
      topFichasCriticas: technicalSheetSummary.topCriticalSheets.map((item) => ({
        name: item.name,
        value: item.cmvPercent,
      })),
      comparativoCmv: [
        { name: "CMV financeiro", value: percent(cmvFinanceiro, receitaLiquida) },
        { name: "Entradas", value: percent(cmvEntradas, receitaLiquida) },
        { name: "CMV ajustado", value: cmvAjustadoPercentual },
        { name: "CMV teórico", value: cmvTeoricoPercentual },
      ],
      ingredientesAcimaTeorico:
        technicalSheetVarianceSummary.topIngredientsAboveTheoretical,
      fichasPorExposicao:
        technicalSheetVarianceSummary.topSheetsByExposure.length > 0
          ? technicalSheetVarianceSummary.topSheetsByExposure
          : invoiceEntries
              .sort((a, b) => b.total_amount - a.total_amount)
              .slice(0, 10)
              .map((entry) => ({
                name: entry.supplier_name || entry.invoice_number || "Entrada",
                value: entry.total_amount,
              })),
    },
  };
}
