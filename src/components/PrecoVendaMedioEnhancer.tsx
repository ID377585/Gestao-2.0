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

function getCostValue(row: Element) {
  const costTitle = Array.from(row.querySelectorAll("p")).find((element) => element.textContent?.trim() === "Preço de custo");
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
  return Array.from(row.querySelectorAll("div input + input"))
    .filter((input) => {
      const inputElement = input as HTMLInputElement;
      const card = inputElement.closest("div");

      return card ? window.getComputedStyle(card).display !== "none" : true;
    })
    .slice(0, 3) as HTMLInputElement[];
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
    return;
  }

  const lowestCompetitorPrice = Math.min(...competitorPrices);
  const result = definedPrice / lowestCompetitorPrice - 1;

  value.textContent = formatPercent(result);
  value.classList.remove("text-blue-900", "text-emerald-700", "text-red-700");
  value.classList.add(result <= 0 ? "text-emerald-700" : "text-red-700");
}

function bindPercentCalculation(row: Element) {
  const definedPriceInput = getDefinedPriceInput(row);
  const competitorInputs = getCompetitorPriceInputs(row);

  [...(definedPriceInput ? [definedPriceInput] : []), ...competitorInputs].forEach((input) => {
    if (input.dataset.percentCalcBound === "true") return;

    input.dataset.percentCalcBound = "true";
    input.addEventListener("input", () => updatePercentCard(row));
    input.addEventListener("change", () => updatePercentCard(row));
  });

  updatePercentCard(row);
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
  const calculate = () => {
    const cost = getCostValue(row);
    const factor = parseNumber(xInput.value);

    if (cost <= 0 || factor <= 0) return;

    const result = Math.round(cost * factor * 100) / 100;
    setReactInputValue(saleInput, String(result));
    window.setTimeout(() => updatePercentCard(row), 0);
  };

  xInput.addEventListener("input", calculate);
  xInput.addEventListener("change", calculate);
}

function runEnhancer() {
  try {
    if (!window.location.pathname.includes("/engenharia/preco-venda-medio")) return;

    const row = document.querySelector(".benchmark-screen-area .flex.min-w-max.items-end");
    if (!row) return;

    ensureXField(row);
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

    const observer = new MutationObserver(runEnhancer);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
      observer.disconnect();
    };
  }, []);

  return null;
}
