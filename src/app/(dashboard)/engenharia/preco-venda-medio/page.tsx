"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  deleteSalesPriceBenchmark,
  loadSalesPriceBenchmarks,
  saveSalesPriceBenchmark,
  type DishType,
  type ProductOption,
  type SalesPriceBenchmark,
} from "./actions";

const DISH_TYPES: DishType[] = ["Entrada", "Prato Principal", "Sobremesa"];
const RESTAURANT_FIELDS = [1, 2, 3, 4, 5] as const;

type RestaurantNumber = (typeof RESTAURANT_FIELDS)[number];

type FormState = {
  productId: string;
  dishType: DishType;
  manualSalePrice: string;
  restaurant1Name: string;
  restaurant2Name: string;
  restaurant3Name: string;
  restaurant4Name: string;
  restaurant5Name: string;
  restaurant1Price: string;
  restaurant2Price: string;
  restaurant3Price: string;
  restaurant4Price: string;
  restaurant5Price: string;
  notes: string;
};

type PrintExecutiveSummary = {
  avgManualPrice: number | null;
  avgCompetitorPrice: number | null;
  avgSuggestedPrice: number | null;
  avgMarginPercent: number | null;
  avgPositionPercent: number | null;
  securityScore: number;
  opportunityCount: number;
  premiumCount: number;
  alignedCount: number;
  belowMarketCount: number;
  topOpportunities: {
    productName: string;
    action: string;
    badge: string;
  }[];
  marketStatusLabel: string;
  marketStatusTone: "green" | "yellow" | "red";
  insight: string;
};

const EMPTY_FORM: FormState = {
  productId: "",
  dishType: "Prato Principal",
  manualSalePrice: "",
  restaurant1Name: "",
  restaurant2Name: "",
  restaurant3Name: "",
  restaurant4Name: "",
  restaurant5Name: "",
  restaurant1Price: "",
  restaurant2Price: "",
  restaurant3Price: "",
  restaurant4Price: "",
  restaurant5Price: "",
  notes: "",
};

const REPORT_STYLES = `
  .preco-report-overlay {
    position: fixed;
    inset: 0;
    z-index: 99999;
    background: #e2e8f0;
    overflow: auto;
    padding: 18px;
  }

  .preco-report-toolbar {
    max-width: 1280px;
    margin: 0 auto 14px auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border: 1px solid #cbd5e1;
    background: #ffffff;
    border-radius: 18px;
    padding: 14px;
    box-shadow: 0 12px 32px rgba(15, 23, 42, 0.12);
  }

  .preco-report-toolbar-title {
    font-size: 14px;
    font-weight: 900;
    color: #0f172a;
  }

  .preco-report-toolbar-subtitle {
    margin-top: 2px;
    font-size: 12px;
    color: #64748b;
  }

  .preco-report-toolbar-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .preco-report-button {
    border: 0;
    border-radius: 14px;
    padding: 10px 14px;
    font-size: 13px;
    font-weight: 900;
    cursor: pointer;
  }

  .preco-report-button-primary {
    background: #0f766e;
    color: #ffffff;
  }

  .preco-report-button-secondary {
    background: #f1f5f9;
    color: #0f172a;
  }

  .preco-report-button-dark {
    background: #0f172a;
    color: #ffffff;
  }

  .preco-report-paper {
    max-width: 1280px;
    margin: 0 auto;
    background: #ffffff;
    color: #0f172a;
    border-radius: 18px;
    padding: 18px;
    box-shadow: 0 18px 50px rgba(15, 23, 42, 0.16);
    font-family: Arial, Helvetica, sans-serif;
  }

  .preco-report-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 18px;
    border: 1px solid #d1fae5;
    background: #ecfdf5;
    border-radius: 14px;
    padding: 16px;
    margin-bottom: 12px;
  }

  .preco-report-kicker {
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #047857;
  }

  .preco-report-title {
    margin: 4px 0 0 0;
    font-size: 28px;
    line-height: 1.05;
    font-weight: 900;
    color: #064e3b;
  }

  .preco-report-description {
    margin: 8px 0 0 0;
    max-width: 760px;
    font-size: 12px;
    line-height: 1.45;
    color: #334155;
  }

  .preco-report-meta {
    min-width: 190px;
    text-align: right;
    font-size: 11px;
    line-height: 1.45;
    color: #475569;
    font-weight: 700;
  }

  .preco-report-meta strong {
    display: block;
    color: #064e3b;
    font-size: 14px;
    font-weight: 900;
  }

  .preco-report-summary {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-bottom: 12px;
  }

  .preco-report-summary-card,
  .preco-report-kpi-card,
  .preco-report-panel {
    border: 1px solid #e2e8f0;
    background: #f8fafc;
    border-radius: 14px;
  }

  .preco-report-summary-card {
    padding: 12px;
  }

  .preco-report-summary-card span,
  .preco-report-kpi-card span {
    display: block;
    color: #64748b;
    font-size: 10px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .preco-report-summary-card strong {
    display: block;
    margin-top: 4px;
    color: #0f172a;
    font-size: 20px;
    font-weight: 900;
  }

  .preco-report-table-wrapper {
    overflow: auto;
    border: 1px solid #cbd5e1;
    border-radius: 14px;
    margin-bottom: 12px;
  }

  .preco-report-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    min-width: 1180px;
    font-size: 11px;
    line-height: 1.25;
  }

  .preco-report-table th {
    background: #0f766e;
    color: #ffffff;
    font-weight: 900;
    text-transform: uppercase;
    text-align: center;
    padding: 9px 7px;
    border-right: 1px solid #115e59;
    border-bottom: 1px solid #115e59;
    vertical-align: middle;
  }

  .preco-report-table td {
    padding: 8px 7px;
    border-right: 1px solid #e2e8f0;
    border-bottom: 1px solid #e2e8f0;
    vertical-align: top;
  }

  .preco-report-table th:last-child,
  .preco-report-table td:last-child {
    border-right: 0;
  }

  .preco-report-table tbody tr:nth-child(even) td {
    background: #f8fafc;
  }

  .preco-report-table tbody tr:nth-child(odd) td {
    background: #ffffff;
  }

  .preco-report-product {
    font-weight: 900;
    color: #0f172a;
  }

  .preco-report-muted {
    display: block;
    margin-top: 2px;
    font-size: 10px;
    color: #64748b;
    font-weight: 700;
  }

  .preco-report-money,
  .preco-report-percent {
    text-align: right;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  .preco-report-money-main {
    color: #047857;
    font-weight: 900;
  }

  .preco-report-money-average {
    color: #1d4ed8;
    font-weight: 900;
  }

  .preco-report-kpis {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    margin-bottom: 10px;
  }

  .preco-report-kpi-card {
    min-height: 82px;
    padding: 12px;
  }

  .preco-report-kpi-card strong {
    display: block;
    margin-top: 6px;
    color: #0f172a;
    font-size: 22px;
    line-height: 1;
    font-weight: 900;
  }

  .preco-report-kpi-card small {
    display: block;
    margin-top: 5px;
    color: #64748b;
    font-size: 10px;
    line-height: 1.25;
    font-weight: 700;
  }

  .preco-report-grid {
    display: grid;
    grid-template-columns: 1.1fr 0.9fr;
    gap: 10px;
  }

  .preco-report-panel {
    background: #ffffff;
    padding: 12px;
  }

  .preco-report-panel-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 10px;
    font-size: 13px;
    color: #0f172a;
    font-weight: 900;
  }

  .preco-report-status {
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    padding: 4px 8px;
    font-size: 10px;
    font-weight: 900;
    white-space: nowrap;
  }

  .preco-report-status-green {
    background: #dcfce7;
    color: #166534;
  }

  .preco-report-status-yellow {
    background: #fef9c3;
    color: #854d0e;
  }

  .preco-report-status-red {
    background: #fee2e2;
    color: #991b1b;
  }

  .preco-report-bars {
    display: grid;
    gap: 8px;
  }

  .preco-report-bar-row {
    display: grid;
    grid-template-columns: 112px 1fr 90px;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: #475569;
    font-weight: 900;
  }

  .preco-report-bar-track {
    height: 12px;
    border-radius: 999px;
    background: #e2e8f0;
    overflow: hidden;
  }

  .preco-report-bar-fill {
    height: 100%;
    border-radius: 999px;
    background: #0f766e;
  }

  .preco-report-bar-fill-blue {
    background: #2563eb;
  }

  .preco-report-bar-fill-emerald {
    background: #059669;
  }

  .preco-report-insight {
    margin-top: 10px;
    border: 1px solid #bbf7d0;
    background: #ecfdf5;
    border-radius: 12px;
    padding: 10px;
    color: #064e3b;
    font-size: 11px;
    line-height: 1.4;
    font-weight: 800;
  }

  .preco-report-opportunities {
    display: grid;
    gap: 6px;
  }

  .preco-report-opportunity-row {
    display: grid;
    grid-template-columns: 1fr 86px;
    align-items: center;
    gap: 8px;
    padding: 7px 0;
    border-bottom: 1px solid #f1f5f9;
    font-size: 11px;
  }

  .preco-report-opportunity-row:last-child {
    border-bottom: 0;
  }

  .preco-report-opportunity-name {
    color: #0f172a;
    font-weight: 900;
  }

  .preco-report-opportunity-badge {
    display: block;
    margin-top: 2px;
    color: #64748b;
    font-size: 10px;
    font-weight: 700;
  }

  .preco-report-opportunity-action {
    text-align: right;
    color: #047857;
    font-weight: 900;
  }

  .preco-report-mini-summary {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
    margin-top: 10px;
  }

  .preco-report-mini-summary div {
    border: 1px solid #e2e8f0;
    background: #f8fafc;
    border-radius: 10px;
    padding: 8px;
  }

  .preco-report-mini-summary span {
    display: block;
    font-size: 9px;
    color: #64748b;
    font-weight: 900;
    text-transform: uppercase;
  }

  .preco-report-mini-summary strong {
    display: block;
    margin-top: 3px;
    font-size: 15px;
    color: #0f172a;
    font-weight: 900;
  }

  .preco-report-footer {
    margin-top: 12px;
    padding-top: 8px;
    border-top: 1px solid #e2e8f0;
    color: #64748b;
    font-size: 10px;
    text-align: right;
    font-weight: 700;
  }

  @media print {
    @page {
      size: A4 landscape;
      margin: 7mm;
    }

    html,
    body {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      overflow: visible !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body * {
      visibility: hidden !important;
    }

    .preco-report-overlay,
    .preco-report-overlay * {
      visibility: visible !important;
    }

    .preco-report-overlay {
      position: absolute !important;
      inset: 0 auto auto 0 !important;
      width: 100% !important;
      min-height: auto !important;
      overflow: visible !important;
      background: #ffffff !important;
      padding: 0 !important;
      z-index: 999999 !important;
    }

    .preco-report-no-print {
      display: none !important;
    }

    .preco-report-paper {
      width: 100% !important;
      max-width: none !important;
      margin: 0 !important;
      padding: 0 !important;
      box-shadow: none !important;
      border-radius: 0 !important;
      font-size: 7px !important;
    }

    .preco-report-header {
      padding: 8px 10px !important;
      border-radius: 8px !important;
      margin-bottom: 7px !important;
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }

    .preco-report-kicker {
      font-size: 6px !important;
    }

    .preco-report-title {
      font-size: 16px !important;
    }

    .preco-report-description {
      font-size: 6.5px !important;
      line-height: 1.25 !important;
      margin-top: 4px !important;
    }

    .preco-report-meta {
      min-width: 120px !important;
      font-size: 6.5px !important;
    }

    .preco-report-meta strong {
      font-size: 8px !important;
    }

    .preco-report-summary {
      gap: 5px !important;
      margin-bottom: 7px !important;
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }

    .preco-report-summary-card {
      padding: 5px 7px !important;
      border-radius: 6px !important;
    }

    .preco-report-summary-card span,
    .preco-report-kpi-card span {
      font-size: 5.2px !important;
    }

    .preco-report-summary-card strong {
      font-size: 9px !important;
      margin-top: 1px !important;
    }

    .preco-report-table-wrapper {
      overflow: visible !important;
      border-radius: 7px !important;
      margin-bottom: 7px !important;
    }

    .preco-report-table {
      min-width: 0 !important;
      table-layout: fixed !important;
      font-size: 5.6px !important;
      line-height: 1.12 !important;
    }

    .preco-report-table th {
      padding: 3px 2px !important;
      font-size: 5px !important;
    }

    .preco-report-table td {
      padding: 3px 2px !important;
      font-size: 5.4px !important;
      overflow-wrap: break-word !important;
    }

    .preco-report-muted {
      font-size: 4.8px !important;
    }

    .preco-report-kpis {
      gap: 5px !important;
      margin-bottom: 6px !important;
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }

    .preco-report-kpi-card {
      min-height: 34px !important;
      padding: 5px 6px !important;
      border-radius: 7px !important;
    }

    .preco-report-kpi-card strong {
      font-size: 8.5px !important;
      margin-top: 2px !important;
    }

    .preco-report-kpi-card small {
      font-size: 5px !important;
      margin-top: 1px !important;
    }

    .preco-report-grid {
      gap: 6px !important;
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }

    .preco-report-panel {
      padding: 6px !important;
      border-radius: 7px !important;
    }

    .preco-report-panel-title {
      font-size: 6.2px !important;
      margin-bottom: 5px !important;
    }

    .preco-report-status {
      font-size: 5px !important;
      padding: 2px 5px !important;
    }

    .preco-report-bar-row {
      grid-template-columns: 58px 1fr 48px !important;
      gap: 5px !important;
      font-size: 5.5px !important;
    }

    .preco-report-bar-track {
      height: 7px !important;
    }

    .preco-report-insight {
      margin-top: 6px !important;
      padding: 5px 6px !important;
      border-radius: 7px !important;
      font-size: 5.7px !important;
      line-height: 1.25 !important;
    }

    .preco-report-opportunity-row {
      grid-template-columns: 1fr 50px !important;
      gap: 5px !important;
      padding: 3px 0 !important;
      font-size: 5.5px !important;
    }

    .preco-report-opportunity-badge {
      font-size: 4.8px !important;
    }

    .preco-report-mini-summary {
      gap: 4px !important;
      margin-top: 5px !important;
    }

    .preco-report-mini-summary div {
      padding: 4px !important;
      border-radius: 6px !important;
    }

    .preco-report-mini-summary span {
      font-size: 4.8px !important;
    }

    .preco-report-mini-summary strong {
      font-size: 7px !important;
    }

    .preco-report-footer {
      margin-top: 6px !important;
      padding-top: 4px !important;
      font-size: 5.6px !important;
    }
  }
`;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function keepRestaurantNames(form: FormState): FormState {
  return {
    ...EMPTY_FORM,
    restaurant1Name: form.restaurant1Name,
    restaurant2Name: form.restaurant2Name,
    restaurant3Name: form.restaurant3Name,
    restaurant4Name: form.restaurant4Name,
    restaurant5Name: form.restaurant5Name,
  };
}

function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "R$ 0,00";

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "-";

  return `${Number(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function toInputValue(value: number | null | undefined) {
  if (value === null || value === undefined) return "";

  return String(value);
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function toNullableNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return null;

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function average(values: number[]) {
  if (values.length === 0) return null;

  return roundMoney(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function getPrintGeneratedAt() {
  return new Date().toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function getRestaurantName(item: SalesPriceBenchmark, number: RestaurantNumber) {
  return (item[`restaurant${number}Name` as keyof SalesPriceBenchmark] as string | null | undefined) ?? null;
}

function getRestaurantPrice(item: SalesPriceBenchmark, number: RestaurantNumber) {
  return (item[`restaurant${number}Price` as keyof SalesPriceBenchmark] as number | null | undefined) ?? null;
}

function getPrintRestaurantHeader(items: SalesPriceBenchmark[], number: RestaurantNumber) {
  const counts = new Map<string, number>();

  items.forEach((item) => {
    const name = getRestaurantName(item, number)?.trim();

    if (!name) return;

    counts.set(name, (counts.get(name) ?? 0) + 1);
  });

  const mostUsed = Array.from(counts.entries()).sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"),
  )[0];

  return mostUsed?.[0] || `Conc. ${number}`;
}

function benchmarkToForm(item: SalesPriceBenchmark): FormState {
  return {
    productId: item.productId,
    dishType: item.dishType,
    manualSalePrice: toInputValue(item.manualSalePrice),
    restaurant1Name: item.restaurant1Name ?? "",
    restaurant2Name: item.restaurant2Name ?? "",
    restaurant3Name: item.restaurant3Name ?? "",
    restaurant4Name: item.restaurant4Name ?? "",
    restaurant5Name: item.restaurant5Name ?? "",
    restaurant1Price: toInputValue(item.restaurant1Price),
    restaurant2Price: toInputValue(item.restaurant2Price),
    restaurant3Price: toInputValue(item.restaurant3Price),
    restaurant4Price: toInputValue(item.restaurant4Price),
    restaurant5Price: toInputValue(item.restaurant5Price),
    notes: item.notes ?? "",
  };
}

function computeCompetitorAverage(form: FormState) {
  const prices = [
    form.restaurant1Price,
    form.restaurant2Price,
    form.restaurant3Price,
    form.restaurant4Price,
    form.restaurant5Price,
  ]
    .map(toNullableNumber)
    .filter((value): value is number => value !== null && value > 0);

  return prices.length > 0 ? roundMoney(prices.reduce((sum, price) => sum + price, 0) / prices.length) : null;
}

function roundSuggestedAboveAverage(averageValue: number) {
  let suggested = Math.ceil(averageValue);

  if (suggested <= averageValue) suggested += 1;

  return suggested;
}

function computeSuggestedAverage(competitorAverage: number | null) {
  return competitorAverage !== null ? roundSuggestedAboveAverage(competitorAverage) : null;
}

function computePercentageIncrease(competitorAverage: number | null, suggestedAverage: number | null) {
  if (competitorAverage === null || suggestedAverage === null || competitorAverage <= 0) return null;

  return roundMoney(((suggestedAverage - competitorAverage) / competitorAverage) * 100);
}

function computeMarginPercent(price: number | null | undefined, cost: number | null | undefined) {
  if (!price || price <= 0 || cost === null || cost === undefined || cost < 0) return null;

  return roundMoney(((price - cost) / price) * 100);
}

function computePricePositionPercent(
  manualPrice: number | null | undefined,
  competitorAverage: number | null | undefined,
) {
  if (!manualPrice || !competitorAverage || competitorAverage <= 0) return null;

  return roundMoney(((manualPrice - competitorAverage) / competitorAverage) * 100);
}

function getOpportunityAction(item: SalesPriceBenchmark) {
  const manual = item.manualSalePrice;
  const competitorAverage = item.competitorAveragePrice;
  const suggested = item.suggestedAveragePrice;

  if (!competitorAverage || competitorAverage <= 0 || !suggested) {
    return {
      action: "Coletar preço",
      badge: "Base insuficiente",
      priority: 4,
    };
  }

  if (!manual || manual <= 0) {
    return {
      action: "Definir preço",
      badge: "Sem preço",
      priority: 1,
    };
  }

  const position = computePricePositionPercent(manual, competitorAverage) ?? 0;

  if (manual < suggested) {
    return {
      action: "Aumentar",
      badge: "Subvalorizado",
      priority: 1,
    };
  }

  if (position >= 12) {
    return {
      action: "Revisar",
      badge: "Acima do mercado",
      priority: 2,
    };
  }

  if (position >= -5 && position <= 8) {
    return {
      action: "Manter",
      badge: "Competitivo",
      priority: 3,
    };
  }

  return {
    action: "Reposicionar",
    badge: "Atenção",
    priority: 2,
  };
}

function buildPrintExecutiveSummary(items: SalesPriceBenchmark[]): PrintExecutiveSummary {
  const withManual = items
    .map((item) => item.manualSalePrice)
    .filter((value): value is number => value !== null && value !== undefined && value > 0);

  const withCompetitorAverage = items
    .map((item) => item.competitorAveragePrice)
    .filter((value): value is number => value !== null && value !== undefined && value > 0);

  const withSuggested = items
    .map((item) => item.suggestedAveragePrice)
    .filter((value): value is number => value !== null && value !== undefined && value > 0);

  const margins = items
    .map((item) => computeMarginPercent(item.manualSalePrice, item.catalogSuggestedPrice))
    .filter((value): value is number => value !== null);

  const positions = items
    .map((item) => computePricePositionPercent(item.manualSalePrice, item.competitorAveragePrice))
    .filter((value): value is number => value !== null);

  const avgManualPrice = average(withManual);
  const avgCompetitorPrice = average(withCompetitorAverage);
  const avgSuggestedPrice = average(withSuggested);
  const avgMarginPercent = average(margins);
  const avgPositionPercent = average(positions);

  const opportunityCount = items.filter((item) => {
    if (!item.suggestedAveragePrice || !item.manualSalePrice) return false;

    return item.manualSalePrice < item.suggestedAveragePrice;
  }).length;

  const premiumCount = positions.filter((value) => value > 8).length;
  const alignedCount = positions.filter((value) => value >= -5 && value <= 8).length;
  const belowMarketCount = positions.filter((value) => value < -5).length;

  const securityScore = clamp(
    Math.round(
      72 +
        (avgMarginPercent !== null ? Math.min(avgMarginPercent, 80) * 0.12 : 0) -
        Math.abs(avgPositionPercent ?? 0) * 0.9 +
        Math.min(withCompetitorAverage.length, 10) * 1.2,
    ),
    45,
    96,
  );

  let marketStatusLabel = "Competitivo";
  let marketStatusTone: PrintExecutiveSummary["marketStatusTone"] = "green";

  if ((avgPositionPercent ?? 0) > 12) {
    marketStatusLabel = "Acima da média";
    marketStatusTone = "yellow";
  } else if ((avgPositionPercent ?? 0) < -8) {
    marketStatusLabel = "Abaixo do mercado";
    marketStatusTone = "red";
  } else if (withCompetitorAverage.length === 0) {
    marketStatusLabel = "Base insuficiente";
    marketStatusTone = "yellow";
  }

  const topOpportunities = items
    .map((item) => {
      const opportunity = getOpportunityAction(item);

      return {
        productName: item.productName,
        action: opportunity.action,
        badge: opportunity.badge,
        priority: opportunity.priority,
      };
    })
    .sort((a, b) => a.priority - b.priority || a.productName.localeCompare(b.productName, "pt-BR"))
    .slice(0, 3)
    .map(({ productName, action, badge }) => ({ productName, action, badge }));

  const insight =
    withCompetitorAverage.length === 0
      ? "Inclua preços de concorrentes para gerar leitura estratégica de posicionamento, segurança e oportunidade."
      : opportunityCount > 0
        ? `Há ${opportunityCount} item(ns) com espaço para reajuste ou reposicionamento sem perder a referência da média de mercado.`
        : "Os preços analisados estão próximos da média de mercado, com boa leitura de competitividade para tomada de decisão.";

  return {
    avgManualPrice,
    avgCompetitorPrice,
    avgSuggestedPrice,
    avgMarginPercent,
    avgPositionPercent,
    securityScore,
    opportunityCount,
    premiumCount,
    alignedCount,
    belowMarketCount,
    topOpportunities,
    marketStatusLabel,
    marketStatusTone,
    insight,
  };
}

function buildReportHtml(params: {
  generatedAt: string;
  items: SalesPriceBenchmark[];
  competitorHeaders: string[];
  competitorsCount: number;
  executiveSummary: PrintExecutiveSummary;
  chartMaxValue: number;
}) {
  const { generatedAt, items, competitorHeaders, competitorsCount, executiveSummary, chartMaxValue } = params;

  const manualWidth = clamp(((executiveSummary.avgManualPrice ?? 0) / chartMaxValue) * 100, 0, 100);
  const competitorWidth = clamp(((executiveSummary.avgCompetitorPrice ?? 0) / chartMaxValue) * 100, 0, 100);
  const suggestedWidth = clamp(((executiveSummary.avgSuggestedPrice ?? 0) / chartMaxValue) * 100, 0, 100);

  const rows = items
    .map((item) => {
      const competitors = RESTAURANT_FIELDS.map(
        (number) => `<td class="preco-report-money">${escapeHtml(formatCurrency(getRestaurantPrice(item, number)))}</td>`,
      ).join("");

      return `
        <tr>
          <td>
            <div class="preco-report-product">${escapeHtml(item.productName)}</div>
            <span class="preco-report-muted">${escapeHtml(item.brand || item.category || "Sem categoria")}</span>
          </td>
          <td>${escapeHtml(item.dishType)}</td>
          <td class="preco-report-money">${escapeHtml(formatCurrency(item.catalogSuggestedPrice))}</td>
          <td class="preco-report-money preco-report-money-main">${escapeHtml(formatCurrency(item.manualSalePrice))}</td>
          ${competitors}
          <td class="preco-report-money preco-report-money-average">${escapeHtml(formatCurrency(item.competitorAveragePrice))}</td>
          <td class="preco-report-money preco-report-money-main">${escapeHtml(formatCurrency(item.suggestedAveragePrice))}</td>
          <td class="preco-report-percent">${escapeHtml(formatPercent(item.percentageVsSuggested))}</td>
        </tr>
      `;
    })
    .join("");

  const opportunities =
    executiveSummary.topOpportunities.length > 0
      ? executiveSummary.topOpportunities
          .map(
            (item) => `
              <div class="preco-report-opportunity-row">
                <div>
                  <div class="preco-report-opportunity-name">${escapeHtml(item.productName)}</div>
                  <span class="preco-report-opportunity-badge">${escapeHtml(item.badge)}</span>
                </div>
                <div class="preco-report-opportunity-action">${escapeHtml(item.action)}</div>
              </div>
            `,
          )
          .join("")
      : `
        <div class="preco-report-opportunity-row">
          <div>
            <div class="preco-report-opportunity-name">Sem dados suficientes</div>
            <span class="preco-report-opportunity-badge">Inclua preços de concorrentes</span>
          </div>
          <div class="preco-report-opportunity-action">Analisar</div>
        </div>
      `;

  return `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Preço Venda Médio - Relatório</title>
        <style>
          ${REPORT_STYLES}

          body {
            margin: 0;
            background: #e2e8f0;
            padding: 18px;
            font-family: Arial, Helvetica, sans-serif;
            color: #0f172a;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          @media screen {
            .preco-report-print-page-toolbar {
              max-width: 1280px;
              margin: 0 auto 14px auto;
              display: flex;
              justify-content: space-between;
              align-items: center;
              gap: 12px;
              border: 1px solid #cbd5e1;
              background: #ffffff;
              border-radius: 18px;
              padding: 14px;
              box-shadow: 0 12px 32px rgba(15, 23, 42, 0.12);
            }

            .preco-report-print-page-toolbar strong {
              display: block;
              font-size: 14px;
            }

            .preco-report-print-page-toolbar span {
              display: block;
              margin-top: 2px;
              font-size: 12px;
              color: #64748b;
            }

            .preco-report-print-page-toolbar button {
              border: 0;
              border-radius: 14px;
              background: #0f766e;
              color: #ffffff;
              padding: 10px 14px;
              font-size: 13px;
              font-weight: 900;
              cursor: pointer;
            }
          }

          @media print {
            body {
              padding: 0 !important;
              background: #ffffff !important;
            }

            .preco-report-print-page-toolbar {
              display: none !important;
            }

            .preco-report-paper {
              max-width: none !important;
              width: 100% !important;
              margin: 0 !important;
              box-shadow: none !important;
              border-radius: 0 !important;
            }

            body * {
              visibility: visible !important;
            }
          }
        </style>
      </head>

      <body>
        <div class="preco-report-print-page-toolbar">
          <div>
            <strong>Relatório pronto para impressão</strong>
            <span>Clique em imprimir ou use Command + P. No destino, escolha “Salvar como PDF”.</span>
          </div>

          <button type="button" onclick="window.print()">Imprimir / Salvar PDF</button>
        </div>

        <div class="preco-report-paper">
          <div class="preco-report-header">
            <div>
              <div class="preco-report-kicker">Engenharia</div>
              <h1 class="preco-report-title">Preço Venda Médio</h1>
              <p class="preco-report-description">
                Comparativo de preços da concorrência para análise de cardápio, posicionamento de venda e definição de preço sugerido.
              </p>
            </div>

            <div class="preco-report-meta">
              <strong>Relatório</strong>
              Gerado em ${escapeHtml(generatedAt)}
              <br />
              ${items.length} comparação(ões)
            </div>
          </div>

          <div class="preco-report-summary">
            <div class="preco-report-summary-card">
              <span>Pratos listados</span>
              <strong>${items.length}</strong>
            </div>

            <div class="preco-report-summary-card">
              <span>Concorrentes</span>
              <strong>${competitorsCount}</strong>
            </div>

            <div class="preco-report-summary-card">
              <span>Tipo de análise</span>
              <strong>Preço médio</strong>
            </div>
          </div>

          <div class="preco-report-table-wrapper">
            <table class="preco-report-table">
              <thead>
                <tr>
                  <th>Prato</th>
                  <th>Tipo</th>
                  <th>Preço de custo</th>
                  <th>Nosso preço</th>
                  ${RESTAURANT_FIELDS.map(
                    (number, index) => `<th>${escapeHtml(competitorHeaders[index] || `Conc. ${number}`)}</th>`,
                  ).join("")}
                  <th>Média conc.</th>
                  <th>Preço sugerido</th>
                  <th>%</th>
                </tr>
              </thead>

              <tbody>
                ${rows}
              </tbody>
            </table>
          </div>

          <div class="preco-report-kpis">
            <div class="preco-report-kpi-card">
              <span>Posicionamento</span>
              <strong>${escapeHtml(formatPercent(executiveSummary.avgPositionPercent))}</strong>
              <small>${escapeHtml(executiveSummary.marketStatusLabel)}</small>
            </div>

            <div class="preco-report-kpi-card">
              <span>Margem média</span>
              <strong>${escapeHtml(formatPercent(executiveSummary.avgMarginPercent))}</strong>
              <small>Base: nosso preço x custo</small>
            </div>

            <div class="preco-report-kpi-card">
              <span>Segurança de preço</span>
              <strong>${executiveSummary.securityScore}%</strong>
              <small>Confiança para decisão</small>
            </div>

            <div class="preco-report-kpi-card">
              <span>Potencial</span>
              <strong>${executiveSummary.opportunityCount}</strong>
              <small>Item(ns) com oportunidade</small>
            </div>
          </div>

          <div class="preco-report-grid">
            <div class="preco-report-panel">
              <div class="preco-report-panel-title">
                <span>Mini gráfico comparativo</span>
                <span class="preco-report-status preco-report-status-${executiveSummary.marketStatusTone}">
                  ${escapeHtml(executiveSummary.marketStatusLabel)}
                </span>
              </div>

              <div class="preco-report-bars">
                <div class="preco-report-bar-row">
                  <span>Nosso preço</span>
                  <div class="preco-report-bar-track">
                    <div class="preco-report-bar-fill" style="width: ${manualWidth}%"></div>
                  </div>
                  <strong>${escapeHtml(formatCurrency(executiveSummary.avgManualPrice))}</strong>
                </div>

                <div class="preco-report-bar-row">
                  <span>Média mercado</span>
                  <div class="preco-report-bar-track">
                    <div class="preco-report-bar-fill preco-report-bar-fill-blue" style="width: ${competitorWidth}%"></div>
                  </div>
                  <strong>${escapeHtml(formatCurrency(executiveSummary.avgCompetitorPrice))}</strong>
                </div>

                <div class="preco-report-bar-row">
                  <span>Preço sugerido</span>
                  <div class="preco-report-bar-track">
                    <div class="preco-report-bar-fill preco-report-bar-fill-emerald" style="width: ${suggestedWidth}%"></div>
                  </div>
                  <strong>${escapeHtml(formatCurrency(executiveSummary.avgSuggestedPrice))}</strong>
                </div>
              </div>

              <div class="preco-report-insight">
                Resumo executivo: ${escapeHtml(executiveSummary.insight)}
              </div>
            </div>

            <div class="preco-report-panel">
              <div class="preco-report-panel-title">
                <span>Top oportunidades</span>
                <span class="preco-report-status preco-report-status-green">Ação sugerida</span>
              </div>

              <div class="preco-report-opportunities">
                ${opportunities}
              </div>

              <div class="preco-report-mini-summary">
                <div>
                  <span>Premium</span>
                  <strong>${executiveSummary.premiumCount}</strong>
                </div>

                <div>
                  <span>Alinhados</span>
                  <strong>${executiveSummary.alignedCount}</strong>
                </div>

                <div>
                  <span>Abaixo</span>
                  <strong>${executiveSummary.belowMarketCount}</strong>
                </div>
              </div>
            </div>
          </div>

          <div class="preco-report-footer">
            Relatório gerado pelo módulo Engenharia - GESTIFY &gt; Preço Venda Médio.
          </div>
        </div>

        <script>
          setTimeout(function () {
            try {
              window.focus();
              window.print();
            } catch (error) {
              console.error(error);
            }
          }, 700);
        </script>
      </body>
    </html>
  `;
}

function openPrintableReport(html: string) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.download = "preco-venda-medio-relatorio.html";

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 60000);
}

function downloadPrintableReport(html: string) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "preco-venda-medio-relatorio.html";

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 60000);
}

function ReportView({
  generatedAt,
  items,
  competitorHeaders,
  competitorsCount,
  executiveSummary,
  chartMaxValue,
}: {
  generatedAt: string;
  items: SalesPriceBenchmark[];
  competitorHeaders: string[];
  competitorsCount: number;
  executiveSummary: PrintExecutiveSummary;
  chartMaxValue: number;
}) {
  const manualWidth = clamp(((executiveSummary.avgManualPrice ?? 0) / chartMaxValue) * 100, 0, 100);
  const competitorWidth = clamp(((executiveSummary.avgCompetitorPrice ?? 0) / chartMaxValue) * 100, 0, 100);
  const suggestedWidth = clamp(((executiveSummary.avgSuggestedPrice ?? 0) / chartMaxValue) * 100, 0, 100);

  return (
    <div className="preco-report-paper">
      <div className="preco-report-header">
        <div>
          <div className="preco-report-kicker">Engenharia</div>

          <h1 className="preco-report-title">Preço Venda Médio</h1>

          <p className="preco-report-description">
            Comparativo de preços da concorrência para análise de cardápio, posicionamento de venda e definição de preço
            sugerido.
          </p>
        </div>

        <div className="preco-report-meta">
          <strong>Relatório</strong>
          Gerado em {generatedAt}
          <br />
          {items.length} comparação(ões)
        </div>
      </div>

      <div className="preco-report-summary">
        <div className="preco-report-summary-card">
          <span>Pratos listados</span>
          <strong>{items.length}</strong>
        </div>

        <div className="preco-report-summary-card">
          <span>Concorrentes</span>
          <strong>{competitorsCount}</strong>
        </div>

        <div className="preco-report-summary-card">
          <span>Tipo de análise</span>
          <strong>Preço médio</strong>
        </div>
      </div>

      <div className="preco-report-table-wrapper">
        <table className="preco-report-table">
          <thead>
            <tr>
              <th>Prato</th>
              <th>Tipo</th>
              <th>Preço de custo</th>
              <th>Nosso preço</th>

              {RESTAURANT_FIELDS.map((number, index) => (
                <th key={number}>{competitorHeaders[index] || `Conc. ${number}`}</th>
              ))}

              <th>Média conc.</th>
              <th>Preço sugerido</th>
              <th>%</th>
            </tr>
          </thead>

          <tbody>
            {items.map((item) => (
              <tr key={item.id ?? item.productId}>
                <td>
                  <div className="preco-report-product">{item.productName}</div>
                  <span className="preco-report-muted">{item.brand || item.category || "Sem categoria"}</span>
                </td>

                <td>{item.dishType}</td>

                <td className="preco-report-money">{formatCurrency(item.catalogSuggestedPrice)}</td>

                <td className="preco-report-money preco-report-money-main">
                  {formatCurrency(item.manualSalePrice)}
                </td>

                {RESTAURANT_FIELDS.map((number) => (
                  <td key={number} className="preco-report-money">
                    {formatCurrency(getRestaurantPrice(item, number))}
                  </td>
                ))}

                <td className="preco-report-money preco-report-money-average">
                  {formatCurrency(item.competitorAveragePrice)}
                </td>

                <td className="preco-report-money preco-report-money-main">
                  {formatCurrency(item.suggestedAveragePrice)}
                </td>

                <td className="preco-report-percent">{formatPercent(item.percentageVsSuggested)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="preco-report-kpis">
        <div className="preco-report-kpi-card">
          <span>Posicionamento</span>
          <strong>{formatPercent(executiveSummary.avgPositionPercent)}</strong>
          <small>{executiveSummary.marketStatusLabel}</small>
        </div>

        <div className="preco-report-kpi-card">
          <span>Margem média</span>
          <strong>{formatPercent(executiveSummary.avgMarginPercent)}</strong>
          <small>Base: nosso preço x custo</small>
        </div>

        <div className="preco-report-kpi-card">
          <span>Segurança de preço</span>
          <strong>{executiveSummary.securityScore}%</strong>
          <small>Confiança para decisão</small>
        </div>

        <div className="preco-report-kpi-card">
          <span>Potencial</span>
          <strong>{executiveSummary.opportunityCount}</strong>
          <small>Item(ns) com oportunidade</small>
        </div>
      </div>

      <div className="preco-report-grid">
        <div className="preco-report-panel">
          <div className="preco-report-panel-title">
            <span>Mini gráfico comparativo</span>

            <span className={`preco-report-status preco-report-status-${executiveSummary.marketStatusTone}`}>
              {executiveSummary.marketStatusLabel}
            </span>
          </div>

          <div className="preco-report-bars">
            <div className="preco-report-bar-row">
              <span>Nosso preço</span>

              <div className="preco-report-bar-track">
                <div className="preco-report-bar-fill" style={{ width: `${manualWidth}%` }} />
              </div>

              <strong>{formatCurrency(executiveSummary.avgManualPrice)}</strong>
            </div>

            <div className="preco-report-bar-row">
              <span>Média mercado</span>

              <div className="preco-report-bar-track">
                <div
                  className="preco-report-bar-fill preco-report-bar-fill-blue"
                  style={{ width: `${competitorWidth}%` }}
                />
              </div>

              <strong>{formatCurrency(executiveSummary.avgCompetitorPrice)}</strong>
            </div>

            <div className="preco-report-bar-row">
              <span>Preço sugerido</span>

              <div className="preco-report-bar-track">
                <div
                  className="preco-report-bar-fill preco-report-bar-fill-emerald"
                  style={{ width: `${suggestedWidth}%` }}
                />
              </div>

              <strong>{formatCurrency(executiveSummary.avgSuggestedPrice)}</strong>
            </div>
          </div>

          <div className="preco-report-insight">Resumo executivo: {executiveSummary.insight}</div>
        </div>

        <div className="preco-report-panel">
          <div className="preco-report-panel-title">
            <span>Top oportunidades</span>
            <span className="preco-report-status preco-report-status-green">Ação sugerida</span>
          </div>

          <div className="preco-report-opportunities">
            {executiveSummary.topOpportunities.length > 0 ? (
              executiveSummary.topOpportunities.map((item) => (
                <div key={`${item.productName}-${item.action}`} className="preco-report-opportunity-row">
                  <div>
                    <div className="preco-report-opportunity-name">{item.productName}</div>
                    <span className="preco-report-opportunity-badge">{item.badge}</span>
                  </div>

                  <div className="preco-report-opportunity-action">{item.action}</div>
                </div>
              ))
            ) : (
              <div className="preco-report-opportunity-row">
                <div>
                  <div className="preco-report-opportunity-name">Sem dados suficientes</div>
                  <span className="preco-report-opportunity-badge">Inclua preços de concorrentes</span>
                </div>

                <div className="preco-report-opportunity-action">Analisar</div>
              </div>
            )}
          </div>

          <div className="preco-report-mini-summary">
            <div>
              <span>Premium</span>
              <strong>{executiveSummary.premiumCount}</strong>
            </div>

            <div>
              <span>Alinhados</span>
              <strong>{executiveSummary.alignedCount}</strong>
            </div>

            <div>
              <span>Abaixo</span>
              <strong>{executiveSummary.belowMarketCount}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="preco-report-footer">Relatório gerado pelo módulo Engenharia - GESTIFY &gt; Preço Venda Médio.</div>
    </div>
  );
}

export default function PrecoVendaMedioPage() {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [benchmarks, setBenchmarks] = useState<SalesPriceBenchmark[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [reportMode, setReportMode] = useState(false);
  const [reportGeneratedAt, setReportGeneratedAt] = useState(getPrintGeneratedAt);

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const data = await loadSalesPriceBenchmarks();

      setProducts(data.products);
      setBenchmarks(data.benchmarks);

      if (data.error) setError(data.error);
    } catch (err) {
      console.error(err);
      setError((err as Error)?.message || "Não foi possível carregar a página.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const selectedProduct = useMemo(() => {
    return products.find((product) => product.id === form.productId) ?? null;
  }, [products, form.productId]);

  const catalogSuggestedPrice = selectedProduct?.suggestedPrice ?? 0;

  const formCompetitorAverage = useMemo(() => computeCompetitorAverage(form), [form]);

  const formSuggestedAverage = useMemo(
    () => computeSuggestedAverage(formCompetitorAverage),
    [formCompetitorAverage],
  );

  const formPercentageVsSuggested = useMemo(
    () => computePercentageIncrease(formCompetitorAverage, formSuggestedAverage),
    [formCompetitorAverage, formSuggestedAverage],
  );

  const filteredBenchmarks = useMemo(() => {
    const q = normalizeSearch(search);

    if (!q) return benchmarks;

    return benchmarks.filter((item) =>
      normalizeSearch(
        [
          item.productName,
          item.brand,
          item.category,
          item.dishType,
          item.restaurant1Name,
          item.restaurant2Name,
          item.restaurant3Name,
          item.restaurant4Name,
          item.restaurant5Name,
        ]
          .filter(Boolean)
          .join(" "),
      ).includes(q),
    );
  }, [benchmarks, search]);

  const printCompetitorHeaders = useMemo(
    () => RESTAURANT_FIELDS.map((number) => getPrintRestaurantHeader(filteredBenchmarks, number)),
    [filteredBenchmarks],
  );

  const printCompetitorsCount = useMemo(
    () => printCompetitorHeaders.filter((name) => !name.startsWith("Conc.")).length,
    [printCompetitorHeaders],
  );

  const printExecutiveSummary = useMemo(
    () => buildPrintExecutiveSummary(filteredBenchmarks),
    [filteredBenchmarks],
  );

  const printChartMaxValue = useMemo(() => {
    const values = [
      printExecutiveSummary.avgManualPrice,
      printExecutiveSummary.avgCompetitorPrice,
      printExecutiveSummary.avgSuggestedPrice,
    ].filter((value): value is number => value !== null && value > 0);

    return values.length > 0 ? Math.max(...values) : 1;
  }, [printExecutiveSummary]);

  const metrics = useMemo(() => {
    const withCompetitors = benchmarks.filter((item) => item.competitorAveragePrice !== null);

    return {
      total: benchmarks.length,
      withCompetitors: withCompetitors.length,
    };
  }, [benchmarks]);

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function editBenchmark(item: SalesPriceBenchmark) {
    setForm(benchmarkToForm(item));
    setStatus("");
    setError("");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleSave() {
    setStatus("");
    setError("");

    const namesToKeep = keepRestaurantNames(form);

    startTransition(async () => {
      const result = await saveSalesPriceBenchmark({
        productId: form.productId,
        dishType: form.dishType,
        manualSalePrice: form.manualSalePrice ? Number(form.manualSalePrice) : null,
        restaurant1Name: form.restaurant1Name,
        restaurant2Name: form.restaurant2Name,
        restaurant3Name: form.restaurant3Name,
        restaurant4Name: form.restaurant4Name,
        restaurant5Name: form.restaurant5Name,
        restaurant1Price: form.restaurant1Price ? Number(form.restaurant1Price) : null,
        restaurant2Price: form.restaurant2Price ? Number(form.restaurant2Price) : null,
        restaurant3Price: form.restaurant3Price ? Number(form.restaurant3Price) : null,
        restaurant4Price: form.restaurant4Price ? Number(form.restaurant4Price) : null,
        restaurant5Price: form.restaurant5Price ? Number(form.restaurant5Price) : null,
        notes: form.notes,
      });

      if (!result.ok) {
        setError(result.error || "Não foi possível salvar.");
        return;
      }

      setStatus("Preço Venda Médio salvo com sucesso.");
      setForm(namesToKeep);

      await loadData();
    });
  }

  function handleDelete(item: SalesPriceBenchmark) {
    const confirmed = window.confirm(`Excluir a comparação de ${item.productName}?`);

    if (!confirmed) return;

    setStatus("");
    setError("");

    startTransition(async () => {
      const result = await deleteSalesPriceBenchmark(item.productId);

      if (!result.ok) {
        setError(result.error || "Não foi possível excluir.");
        return;
      }

      if (form.productId === item.productId) {
        setForm(keepRestaurantNames(form));
      }

      setStatus("Comparação excluída com sucesso.");

      await loadData();
    });
  }

  function handleOpenReport() {
    if (filteredBenchmarks.length === 0) {
      window.alert("Nenhuma comparação disponível para visualizar.");
      return;
    }

    setReportGeneratedAt(getPrintGeneratedAt());
    setReportMode(true);
  }

  function getCurrentReportHtml() {
    return buildReportHtml({
      generatedAt: reportGeneratedAt,
      items: filteredBenchmarks,
      competitorHeaders: printCompetitorHeaders,
      competitorsCount: printCompetitorsCount,
      executiveSummary: printExecutiveSummary,
      chartMaxValue: printChartMaxValue,
    });
  }

  function handleOpenPrintableReport() {
    const html = getCurrentReportHtml();

    openPrintableReport(html);
  }

  function handleDownloadReport() {
    const html = getCurrentReportHtml();

    downloadPrintableReport(html);
  }

  return (
    <>
      <style>{REPORT_STYLES}</style>

      {reportMode ? (
        <div className="preco-report-overlay">
          <div className="preco-report-toolbar preco-report-no-print">
            <div>
              <div className="preco-report-toolbar-title">Pré-visualização do relatório</div>
              <div className="preco-report-toolbar-subtitle">
                Clique em “Imprimir / Salvar PDF”. Será aberta uma página de impressão independente.
              </div>
            </div>

            <div className="preco-report-toolbar-actions">
              <button
                type="button"
                onClick={() => setReportMode(false)}
                className="preco-report-button preco-report-button-secondary"
              >
                Voltar
              </button>

              <button
                type="button"
                onClick={handleDownloadReport}
                className="preco-report-button preco-report-button-dark"
              >
                Baixar HTML
              </button>

              <button
                type="button"
                onClick={handleOpenPrintableReport}
                className="preco-report-button preco-report-button-primary"
              >
                Imprimir / Salvar PDF
              </button>
            </div>
          </div>

          <ReportView
            generatedAt={reportGeneratedAt}
            items={filteredBenchmarks}
            competitorHeaders={printCompetitorHeaders}
            competitorsCount={printCompetitorsCount}
            executiveSummary={printExecutiveSummary}
            chartMaxValue={printChartMaxValue}
          />
        </div>
      ) : null}

      <div className="benchmark-screen-area min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-sky-100 p-6 text-slate-950">
        <div className="mx-auto max-w-[1700px] space-y-6">
          <header className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-xl shadow-slate-900/10 backdrop-blur">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-700">Engenharia</p>

            <h1 className="mt-2 text-3xl font-black tracking-tight">Preço Venda Médio</h1>

            <p className="mt-2 max-w-4xl text-sm text-slate-600">
              Compare o preço atual do catálogo com preços anotados da concorrência. O preço sugerido é arredondado
              para um número inteiro acima da média dos concorrentes.
            </p>
          </header>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white shadow-lg">
              <p className="text-xs text-slate-300">Pratos monitorados</p>
              <p className="mt-2 text-3xl font-black">{metrics.total}</p>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900 shadow-sm">
              <p className="text-xs">Com concorrentes</p>
              <p className="mt-2 text-3xl font-black">{metrics.withCompetitors}</p>
            </div>
          </section>

          <section className="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-xl shadow-slate-900/10 backdrop-blur">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">Cadastro da comparação</h2>

                <p className="text-xs text-slate-500">
                  Digite o nome de cada concorrente e o preço encontrado. Os nomes ficam salvos junto com a comparação
                  e permanecem após salvar.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto pb-2">
              <div className="flex min-w-max items-end gap-3">
                <label className="w-[320px] shrink-0">
                  <span className="text-xs font-bold text-slate-700">Nome do prato</span>

                  <select
                    value={form.productId}
                    onChange={(event) => updateForm("productId", event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none ring-emerald-500 transition focus:ring-2"
                  >
                    <option value="">Selecione um produto do catálogo</option>

                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} {product.brand ? ` • ${product.brand}` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="w-[180px] shrink-0">
                  <span className="text-xs font-bold text-slate-700">Tipo</span>

                  <select
                    value={form.dishType}
                    onChange={(event) => updateForm("dishType", event.target.value as DishType)}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none ring-emerald-500 transition focus:ring-2"
                  >
                    {DISH_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="w-[190px] shrink-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[11px] font-bold text-slate-600">Preço de custo</p>
                  <p className="mt-1 text-lg font-black">{formatCurrency(catalogSuggestedPrice)}</p>
                </div>

                <label className="w-[160px] shrink-0">
                  <span className="text-xs font-bold text-slate-700">Preço Venda</span>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.manualSalePrice}
                    onChange={(event) => updateForm("manualSalePrice", event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none ring-emerald-500 transition focus:ring-2"
                  />
                </label>

                {RESTAURANT_FIELDS.map((number) => {
                  const nameKey = `restaurant${number}Name` as keyof FormState;
                  const priceKey = `restaurant${number}Price` as keyof FormState;

                  return (
                    <div key={number} className="w-[190px] shrink-0 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <input
                        value={form[nameKey]}
                        onChange={(event) => updateForm(nameKey, event.target.value as never)}
                        placeholder={`Nome restaurante ${number}`}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold outline-none ring-emerald-500 transition focus:ring-2"
                      />

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form[priceKey]}
                        onChange={(event) => updateForm(priceKey, event.target.value as never)}
                        placeholder="Preço"
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none ring-emerald-500 transition focus:ring-2"
                      />
                    </div>
                  );
                })}

                <div className="w-[190px] shrink-0 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
                  <p className="text-[11px] font-bold text-blue-800">Média concorrência</p>
                  <p className="mt-1 text-lg font-black text-blue-900">{formatCurrency(formCompetitorAverage)}</p>
                </div>

                <div className="w-[190px] shrink-0 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <p className="text-[11px] font-bold text-emerald-800">Preço médio sugerido</p>
                  <p className="mt-1 text-lg font-black text-emerald-900">{formatCurrency(formSuggestedAverage)}</p>
                </div>

                <div className="w-[110px] shrink-0 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
                  <p className="text-[11px] font-bold text-blue-800">%</p>

                  <p
                    className={`mt-1 text-lg font-black ${
                      (formPercentageVsSuggested ?? 0) >= 0 ? "text-emerald-700" : "text-red-700"
                    }`}
                  >
                    {formatPercent(formPercentageVsSuggested)}
                  </p>
                </div>
              </div>
            </div>

            <label className="mt-4 block">
              <span className="text-xs font-bold text-slate-700">Observações</span>

              <textarea
                rows={3}
                value={form.notes}
                onChange={(event) => updateForm("notes", event.target.value)}
                placeholder="Ex.: restaurante referência, bairro, porção semelhante, data da cotação..."
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-emerald-500 transition focus:ring-2"
              />
            </label>

            {error ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}

            {status ? (
              <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{status}</p>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={isPending}
                className="rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-900/20 transition hover:-translate-y-0.5 hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "Salvando..." : "Salvar comparação"}
              </button>

              <button
                type="button"
                onClick={() => setForm(EMPTY_FORM)}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Limpar tudo
              </button>
            </div>
          </section>

          <section className="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-xl shadow-slate-900/10 backdrop-blur">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-black">Comparações registradas</h2>

                <p className="mt-1 text-sm text-slate-500">
                  Use Editar para carregar os valores no formulário ou Excluir para remover a comparação.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar prato, restaurante, marca, categoria..."
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-emerald-500 transition focus:ring-2 md:w-80"
                />

                <button
                  type="button"
                  onClick={handleOpenReport}
                  disabled={filteredBenchmarks.length === 0}
                  className="rounded-2xl border border-slate-200 bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Visualizar relatório
                </button>
              </div>
            </div>

            {loading ? (
              <p className="mt-6 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">Carregando...</p>
            ) : filteredBenchmarks.length === 0 ? (
              <p className="mt-6 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">
                Nenhuma comparação registrada ainda.
              </p>
            ) : (
              <div className="mt-6 overflow-x-auto">
                <table className="min-w-[1750px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="sticky left-0 z-10 bg-white px-3 py-3">Prato</th>
                      <th className="px-3 py-3">Tipo</th>
                      <th className="px-3 py-3">Preço de custo</th>
                      <th className="px-3 py-3">Nosso preço definido</th>

                      {RESTAURANT_FIELDS.map((number) => (
                        <th key={number} className="px-3 py-3">
                          Concorrente {number}
                        </th>
                      ))}

                      <th className="px-3 py-3">Média concorrência</th>
                      <th className="px-3 py-3">Preço médio sugerido</th>
                      <th className="px-3 py-3">%</th>
                      <th className="px-3 py-3">Ações</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredBenchmarks.map((item) => (
                      <tr key={item.id ?? item.productId} className="border-t border-slate-100 transition hover:bg-emerald-50/70">
                        <td className="sticky left-0 z-10 bg-white px-3 py-4 font-bold text-slate-900">
                          {item.productName}

                          <div className="text-xs font-medium text-slate-500">
                            {item.brand || item.category || "Sem categoria"}
                          </div>
                        </td>

                        <td className="px-3 py-4">{item.dishType}</td>

                        <td className="px-3 py-4 font-semibold">{formatCurrency(item.catalogSuggestedPrice)}</td>

                        <td className="px-3 py-4 font-semibold text-slate-900">
                          {formatCurrency(item.manualSalePrice)}
                        </td>

                        {RESTAURANT_FIELDS.map((number) => {
                          const name = getRestaurantName(item, number);
                          const price = getRestaurantPrice(item, number);

                          return (
                            <td key={number} className="px-3 py-4">
                              <div className="font-bold text-slate-800">{name || `Concorrente ${number}`}</div>
                              <div className="text-slate-600">{formatCurrency(price)}</div>
                            </td>
                          );
                        })}

                        <td className="px-3 py-4 font-semibold text-blue-800">
                          {formatCurrency(item.competitorAveragePrice)}
                        </td>

                        <td className="px-3 py-4 font-black text-emerald-700">
                          {formatCurrency(item.suggestedAveragePrice)}
                        </td>

                        <td
                          className={`px-3 py-4 font-bold ${
                            (item.percentageVsSuggested ?? 0) >= 0 ? "text-emerald-700" : "text-red-700"
                          }`}
                        >
                          {formatPercent(item.percentageVsSuggested)}
                        </td>

                        <td className="px-3 py-4">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => editBenchmark(item)}
                              className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800 transition hover:bg-blue-100"
                            >
                              Editar
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDelete(item)}
                              disabled={isPending}
                              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}