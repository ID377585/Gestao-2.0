"use client";

import { useEffect } from "react";
import { saveSalesPriceBenchmarkExtras } from "@/app/(dashboard)/engenharia/preco-venda-medio/extended-actions";

function parseNumber(value: string) {
  const normalized = value
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function findLabel(root: Element, text: string) {
  return Array.from(root.querySelectorAll("label")).find((label) =>
    Array.from(label.querySelectorAll("span")).some((span) => span.textContent?.trim() === text),
  ) as HTMLLabelElement | undefined;
}

function getCardTitle(root: Element, title: string) {
  return Array.from(root.querySelectorAll("p")).find((element) => element.textContent?.trim() === title) as
    | HTMLParagraphElement
    | undefined;
}

function getCostValue(row: Element) {
  const costTitle = getCardTitle(row, "Preço de custo");
  const costText = costTitle?.parentElement?.querySelector("p:last-child")?.textContent ?? "";
  return parseNumber(costText);
}

function getInputValue(row: Element, label: string) {
  return parseNumber(findLabel(row, label)?.querySelector("input")?.value ?? "");
}

function getXValue(row: Element) {
  return parseNumber(row.querySelector<HTMLInputElement>('[data-preco-x-input="true"]')?.value ?? "");
}

function getDefinedValue(row: Element) {
  return parseNumber(row.querySelector<HTMLInputElement>('[data-defined-price-input="true"]')?.value ?? "") || getInputValue(row, "Preço Venda");
}

function getCompetitorPrices(row: Element) {
  const cards = Array.from(row.querySelectorAll("div")).filter((card) => {
    const inputs = card.querySelectorAll("input");
    if (inputs.length !== 2) return false;
    return window.getComputedStyle(card).display !== "none";
  });

  return cards
    .slice(0, 3)
    .map((card) => parseNumber(card.querySelectorAll("input")[1]?.value ?? ""))
    .filter((price) => price > 0);
}

function getSnapshot(row: Element) {
  const productSelect = row.querySelector("select") as HTMLSelectElement | null;
  const dishTypeSelects = Array.from(row.querySelectorAll("select")) as HTMLSelectElement[];
  const dishTypeSelect = dishTypeSelects[1] ?? null;
  const productId = productSelect?.value ?? "";
  const dishType = dishTypeSelect?.value ?? "Prato Principal";
  const cost = getCostValue(row);
  const xFactor = getXValue(row);
  const calculatedSalePrice = getInputValue(row, "Preço Venda");
  const definedSalePrice = getDefinedValue(row);
  const competitorPrices = getCompetitorPrices(row);
  const lowestCompetitorPrice = competitorPrices.length > 0 ? Math.min(...competitorPrices) : null;
  const lowestCompetitorMarkup = cost > 0 && lowestCompetitorPrice !== null ? lowestCompetitorPrice / cost : null;
  const markupDifference = lowestCompetitorMarkup !== null && xFactor > 0 ? lowestCompetitorMarkup - xFactor : null;
  const percentVsLowestCompetitor =
    definedSalePrice > 0 && lowestCompetitorPrice !== null && lowestCompetitorPrice > 0
      ? ((definedSalePrice - lowestCompetitorPrice) / lowestCompetitorPrice) * 100
      : null;

  return {
    productId,
    dishType,
    xFactor: xFactor || null,
    calculatedSalePrice: calculatedSalePrice || null,
    definedSalePrice: definedSalePrice || null,
    percentVsLowestCompetitor,
    lowestCompetitorMarkup,
    markupDifference,
  };
}

function bindPersistentExtras() {
  if (!window.location.pathname.includes("/engenharia/preco-venda-medio")) return;

  const screen = document.querySelector(".benchmark-screen-area");
  const row = screen?.querySelector(".flex.min-w-max.items-end");
  const saveButton = Array.from(screen?.querySelectorAll("button") ?? []).find(
    (button) => button.textContent?.trim() === "Salvar comparação",
  ) as HTMLButtonElement | undefined;

  if (!row || !saveButton || saveButton.dataset.persistentExtrasBound === "true") return;

  saveButton.dataset.persistentExtrasBound = "true";
  const saveExtras = () => {
    const snapshot = getSnapshot(row);
    if (!snapshot.productId) return;

    window.setTimeout(() => {
      void saveSalesPriceBenchmarkExtras(snapshot);
    }, 800);
  };

  saveButton.addEventListener("pointerdown", saveExtras, true);
  saveButton.addEventListener("click", saveExtras, true);
}

export function PrecoVendaMedioPersistentExtras() {
  useEffect(() => {
    bindPersistentExtras();
    const interval = window.setInterval(bindPersistentExtras, 500);
    const timeout = window.setTimeout(() => window.clearInterval(interval), 15000);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, []);

  return null;
}
