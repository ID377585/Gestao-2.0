"use client";

import { useEffect } from "react";

function parseNumber(value: string) {
  const normalized = value
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "-";

  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function setReactInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
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

function getButtonByText(root: Element, text: string) {
  return Array.from(root.querySelectorAll("button")).find((button) => button.textContent?.trim() === text) as
    | HTMLButtonElement
    | undefined;
}

function getCostValue(row: Element) {
  const costTitle = getCardTitle(row, "Preço de custo");
  const costText = costTitle?.parentElement?.querySelector("p:last-child")?.textContent ?? "";
  return parseNumber(costText);
}

function getPercentCard(row: Element) {
  const title = Array.from(row.querySelectorAll("p")).find((element) => {
    const text = element.textContent?.trim();
    return text === "Média concorrência" || text === "%";
  }) as HTMLParagraphElement | undefined;

  const card = title?.parentElement as HTMLElement | null;
  const value = card?.querySelector("p:last-child") as HTMLParagraphElement | null;

  return { title, value };
}

function getCompetitorPriceInputs(row: Element) {
  const cards = Array.from(row.querySelectorAll("div")).filter((card) => {
    const inputs = card.querySelectorAll("input");
    if (inputs.length !== 2) return false;
    return window.getComputedStyle(card).display !== "none";
  });

  return cards.slice(0, 3).map((card) => card.querySelectorAll("input")[1] as HTMLInputElement);
}

function getDefinedPriceInput(row: Element) {
  const definedPriceLabel = findLabel(row, "Nosso preço definido");
  const salePriceLabel = findLabel(row, "Preço Venda");

  return (
    (definedPriceLabel?.querySelector("input") as HTMLInputElement | null) ||
    (salePriceLabel?.querySelector("input") as HTMLInputElement | null)
  );
}

function updatePercentCard(row: Element) {
  const { title, value } = getPercentCard(row);
  if (!title || !value) return;

  title.textContent = "%";

  const definedPriceInput = getDefinedPriceInput(row);
  const definedPrice = parseNumber(definedPriceInput?.value ?? "");
  const competitorPrices = getCompetitorPriceInputs(row)
    .map((input) => parseNumber(input.value))
    .filter((price) => price > 0);

  if (definedPrice <= 0 || competitorPrices.length === 0) {
    value.textContent = "-";
    value.classList.remove("text-blue-900", "text-emerald-700", "text-red-700");
    value.classList.add("text-blue-900");
    return;
  }

  const lowestCompetitorPrice = Math.min(...competitorPrices);
  const result = ((definedPrice - lowestCompetitorPrice) / lowestCompetitorPrice) * 100;

  value.textContent = formatPercent(result);
  value.classList.remove("text-blue-900", "text-emerald-700", "text-red-700");
  value.classList.add(result <= 0 ? "text-emerald-700" : "text-red-700");
}

function ensureXField(row: Element) {
  const saleLabel = findLabel(row, "Preço Venda");
  const saleInput = saleLabel?.querySelector("input") as HTMLInputElement | null;

  if (!saleLabel || !saleInput) return;

  let xInput = row.querySelector<HTMLInputElement>('[data-preco-x-input="true"]');

  if (!xInput) {
    const label = document.createElement("label");
    label.className = "w-[70px] shrink-0";
    label.setAttribute("data-preco-x-field", "true");
    label.innerHTML = `
      <span class="text-xs font-bold text-slate-700">X</span>
      <input data-preco-x-input="true" type="number" min="0" step="0.01" placeholder="X" class="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold outline-none ring-emerald-500 transition focus:ring-2" />
    `;
    saleLabel.insertAdjacentElement("beforebegin", label);
    xInput = label.querySelector<HTMLInputElement>('[data-preco-x-input="true"]');
  }

  if (!xInput || xInput.dataset.bound === "true") return;

  xInput.dataset.bound = "true";

  const calculateSalePrice = () => {
    const cost = getCostValue(row);
    const factor = parseNumber(xInput.value);

    if (cost <= 0 || factor <= 0) return;

    const result = Math.round(cost * factor * 100) / 100;
    setReactInputValue(saleInput, String(result));
    updatePercentCard(row);
  };

  xInput.addEventListener("input", calculateSalePrice);
  xInput.addEventListener("change", calculateSalePrice);
}

function ensureDefinedPriceField(row: Element, screen: Element) {
  const saleLabel = findLabel(row, "Preço Venda");
  const saleInput = saleLabel?.querySelector("input") as HTMLInputElement | null;

  if (!saleLabel || !saleInput) return;

  let definedInput = row.querySelector<HTMLInputElement>('[data-defined-price-input="true"]');

  if (!definedInput) {
    const label = document.createElement("label");
    label.className = "w-[135px] shrink-0";
    label.setAttribute("data-defined-price-field", "true");
    label.innerHTML = `
      <span class="text-xs font-bold text-slate-700">Nosso preço definido</span>
      <input data-defined-price-input="true" type="number" min="0" step="0.01" placeholder="Definido" class="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold outline-none ring-emerald-500 transition focus:ring-2" />
    `;
    saleLabel.insertAdjacentElement("afterend", label);
    definedInput = label.querySelector<HTMLInputElement>('[data-defined-price-input="true"]');
  }

  if (!definedInput) return;

  if (definedInput.dataset.definedBound !== "true") {
    definedInput.dataset.definedBound = "true";
    definedInput.addEventListener("input", () => updatePercentCard(row));
    definedInput.addEventListener("change", () => updatePercentCard(row));
  }

  const syncDefinedPriceToSavedField = () => {
    const definedValue = definedInput?.value.trim() ?? "";
    if (!definedValue) return;
    setReactInputValue(saleInput, definedValue);
  };

  const saveButton = getButtonByText(screen, "Salvar comparação");
  if (saveButton && saveButton.dataset.definedPriceSaveBound !== "true") {
    saveButton.dataset.definedPriceSaveBound = "true";
    saveButton.addEventListener("pointerdown", syncDefinedPriceToSavedField, true);
    saveButton.addEventListener("mousedown", syncDefinedPriceToSavedField, true);
    saveButton.addEventListener("click", syncDefinedPriceToSavedField, true);
  }
}

function bindPercentCalculation(row: Element) {
  const definedInput = getDefinedPriceInput(row);
  const inputs = [...(definedInput ? [definedInput] : []), ...getCompetitorPriceInputs(row)];

  inputs.forEach((input) => {
    if (input.dataset.percentCalcBound === "true") return;

    input.dataset.percentCalcBound = "true";
    input.addEventListener("input", () => updatePercentCard(row));
    input.addEventListener("change", () => updatePercentCard(row));
  });

  updatePercentCard(row);
}

function runEnhancer() {
  try {
    if (!window.location.pathname.includes("/engenharia/preco-venda-medio")) return;

    const screen = document.querySelector(".benchmark-screen-area");
    const row = screen?.querySelector(".flex.min-w-max.items-end");
    if (!screen || !row) return;

    ensureXField(row);
    ensureDefinedPriceField(row, screen);
    bindPercentCalculation(row);
  } catch (error) {
    console.error("Erro ao aplicar melhorias no Preço Venda Médio:", error);
  }
}

export function PrecoVendaMedioEnhancer() {
  useEffect(() => {
    runEnhancer();

    const interval = window.setInterval(runEnhancer, 500);
    const timeout = window.setTimeout(() => window.clearInterval(interval), 15000);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, []);

  return null;
}
