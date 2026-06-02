"use client";

import { useEffect } from "react";

const STORAGE_PREFIX = "preco-venda-medio:";

function parseNumber(value: string) {
  const normalized = value
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "-";

  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatMoney(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "-";

  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "-";
  return `${formatNumber(value)}%`;
}

function formatMarkup(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "-";
  return `${formatNumber(value)}x`;
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

function normalizeKey(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function storageKey(productName: string) {
  return `${STORAGE_PREFIX}${normalizeKey(productName)}`;
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

function getMarkupCard(row: Element) {
  const explicitTitle = Array.from(row.querySelectorAll("p")).find(
    (element) => element.textContent?.trim() === "Markup menor concorrente",
  ) as HTMLParagraphElement | undefined;

  const percentTitles = Array.from(row.querySelectorAll("p")).filter((element) => element.textContent?.trim() === "%") as HTMLParagraphElement[];
  const title = explicitTitle ?? percentTitles[percentTitles.length - 1];
  const card = title?.parentElement as HTMLElement | null;
  const value = card?.querySelector("p:last-child") as HTMLParagraphElement | null;

  return { title, value, card };
}

function ensureDifferenceCard(row: Element) {
  const existingCard = row.querySelector<HTMLElement>('[data-markup-difference-card="true"]');
  if (existingCard) return existingCard;

  const { card: markupCard } = getMarkupCard(row);
  if (!markupCard) return null;

  const card = document.createElement("div");
  card.className = markupCard.className;
  card.setAttribute("data-markup-difference-card", "true");
  card.innerHTML = `
    <p class="text-xs font-bold text-blue-800">Diferença de</p>
    <p data-markup-difference-value="true" class="mt-2 text-xl font-black text-blue-900">-</p>
  `;

  markupCard.insertAdjacentElement("afterend", card);
  return card;
}

function hideSuggestedPriceCard(row: Element) {
  const title = Array.from(row.querySelectorAll("p")).find((element) => element.textContent?.trim() === "Preço médio sugerido");
  const card = title?.parentElement as HTMLElement | null;

  if (card) card.style.display = "none";
}

function getCompetitorPriceInputs(row: Element) {
  const cards = Array.from(row.querySelectorAll("div")).filter((card) => {
    const inputs = card.querySelectorAll("input");
    if (inputs.length !== 2) return false;
    return window.getComputedStyle(card).display !== "none";
  });

  return cards.slice(0, 3).map((card) => card.querySelectorAll("input")[1] as HTMLInputElement);
}

function getLowestCompetitorPrice(row: Element) {
  const competitorPrices = getCompetitorPriceInputs(row)
    .map((input) => parseNumber(input.value))
    .filter((price) => price > 0);

  if (competitorPrices.length === 0) return null;
  return Math.min(...competitorPrices);
}

function getXInput(row: Element) {
  return row.querySelector<HTMLInputElement>('[data-preco-x-input="true"]');
}

function getDefinedPriceInput(row: Element) {
  const definedPriceLabel = findLabel(row, "Nosso preço definido");
  const salePriceLabel = findLabel(row, "Preço Venda");

  return (
    (definedPriceLabel?.querySelector("input") as HTMLInputElement | null) ||
    (salePriceLabel?.querySelector("input") as HTMLInputElement | null)
  );
}

function getProductName(row: Element) {
  const firstSelect = row.querySelector("select") as HTMLSelectElement | null;
  const selectedText = firstSelect?.selectedOptions?.[0]?.textContent?.trim() ?? "";
  return selectedText || "produto-sem-nome";
}

function getFormSnapshot(row: Element) {
  const cost = getCostValue(row);
  const x = parseNumber(getXInput(row)?.value ?? "");
  const salePrice = parseNumber(findLabel(row, "Preço Venda")?.querySelector("input")?.value ?? "");
  const definedPrice = parseNumber(getDefinedPriceInput(row)?.value ?? "");
  const lowestCompetitorPrice = getLowestCompetitorPrice(row);
  const competitorMarkup = cost > 0 && lowestCompetitorPrice ? lowestCompetitorPrice / cost : null;
  const difference = competitorMarkup !== null && x > 0 ? competitorMarkup - x : null;
  const percent = definedPrice > 0 && lowestCompetitorPrice ? ((definedPrice - lowestCompetitorPrice) / lowestCompetitorPrice) * 100 : null;

  return {
    productName: getProductName(row),
    cost,
    x,
    salePrice,
    definedPrice,
    percent,
    competitorMarkup,
    difference,
    updatedAt: new Date().toISOString(),
  };
}

function saveFormSnapshot(row: Element) {
  try {
    const snapshot = getFormSnapshot(row);
    localStorage.setItem(storageKey(snapshot.productName), JSON.stringify(snapshot));
  } catch {
    // Ignora indisponibilidade de localStorage.
  }
}

function loadSnapshot(productName: string) {
  try {
    const raw = localStorage.getItem(storageKey(productName));
    return raw ? (JSON.parse(raw) as ReturnType<typeof getFormSnapshot>) : null;
  } catch {
    return null;
  }
}

function updateDifferenceCard(row: Element, competitorMarkup: number | null) {
  const card = ensureDifferenceCard(row);
  const value = card?.querySelector('[data-markup-difference-value="true"]') as HTMLParagraphElement | null;
  if (!value) return;

  const ourMarkup = parseNumber(getXInput(row)?.value ?? "");

  if (competitorMarkup === null || competitorMarkup <= 0 || ourMarkup <= 0) {
    value.textContent = "-";
    value.classList.remove("text-blue-900", "text-emerald-700", "text-red-700");
    value.classList.add("text-blue-900");
    return;
  }

  const difference = competitorMarkup - ourMarkup;
  value.textContent = formatNumber(difference);
  value.classList.remove("text-blue-900", "text-emerald-700", "text-red-700");
  value.classList.add(difference >= 0 ? "text-emerald-700" : "text-red-700");
}

function updateMarkupCard(row: Element) {
  const { title, value } = getMarkupCard(row);
  if (!title || !value) return;

  title.textContent = "Markup menor concorrente";

  const cost = getCostValue(row);
  const lowestCompetitorPrice = getLowestCompetitorPrice(row);

  if (cost <= 0 || lowestCompetitorPrice === null || lowestCompetitorPrice <= 0) {
    value.textContent = "-";
    updateDifferenceCard(row, null);
    return;
  }

  const competitorMarkup = lowestCompetitorPrice / cost;
  value.textContent = formatMarkup(competitorMarkup);
  updateDifferenceCard(row, competitorMarkup);
}

function updatePercentCard(row: Element) {
  const { title, value } = getPercentCard(row);
  if (!title || !value) return;

  title.textContent = "%";

  const definedPriceInput = getDefinedPriceInput(row);
  const definedPrice = parseNumber(definedPriceInput?.value ?? "");
  const lowestCompetitorPrice = getLowestCompetitorPrice(row);

  if (definedPrice <= 0 || lowestCompetitorPrice === null || lowestCompetitorPrice <= 0) {
    value.textContent = "-";
    value.classList.remove("text-blue-900", "text-emerald-700", "text-red-700");
    value.classList.add("text-blue-900");
    updateMarkupCard(row);
    hideSuggestedPriceCard(row);
    return;
  }

  const result = ((definedPrice - lowestCompetitorPrice) / lowestCompetitorPrice) * 100;

  value.textContent = formatPercent(result);
  value.classList.remove("text-blue-900", "text-emerald-700", "text-red-700");
  value.classList.add(result <= 0 ? "text-emerald-700" : "text-red-700");
  updateMarkupCard(row);
  hideSuggestedPriceCard(row);
}

function ensureXField(row: Element) {
  const saleLabel = findLabel(row, "Preço Venda");
  const saleInput = saleLabel?.querySelector("input") as HTMLInputElement | null;

  if (!saleLabel || !saleInput) return;

  let xInput = getXInput(row);

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
    saveFormSnapshot(row);
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
  const inputs = [...(definedInput ? [definedInput] : []), ...getCompetitorPriceInputs(row), ...(getXInput(row) ? [getXInput(row)!] : [])];

  inputs.forEach((input) => {
    if (input.dataset.percentCalcBound === "true") return;

    input.dataset.percentCalcBound = "true";
    input.addEventListener("input", () => updatePercentCard(row));
    input.addEventListener("change", () => updatePercentCard(row));
  });

  updatePercentCard(row);
}

function cell(text: string, tone: "default" | "green" | "red" = "default") {
  const td = document.createElement("td");
  td.className = tone === "green" ? "px-4 py-4 font-black text-emerald-700" : tone === "red" ? "px-4 py-4 font-black text-red-700" : "px-4 py-4 font-bold text-slate-900";
  td.textContent = text;
  return td;
}

function header(text: string) {
  const th = document.createElement("th");
  th.className = "px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500";
  th.textContent = text;
  return th;
}

function findHeaderIndex(headers: HTMLTableCellElement[], title: string) {
  return headers.findIndex((headerCell) => headerCell.textContent?.trim().toLowerCase() === title.toLowerCase());
}

function enhanceRegisteredTable(screen: Element) {
  const table = Array.from(screen.querySelectorAll("table")).find((table) =>
    Array.from(table.querySelectorAll("th")).some((th) => th.textContent?.trim().toLowerCase() === "nosso preço definido"),
  ) as HTMLTableElement | undefined;

  if (!table || table.dataset.extraBenchmarkColumns === "true") return;

  const headerRow = table.querySelector("thead tr");
  const bodyRows = Array.from(table.querySelectorAll("tbody tr"));
  if (!headerRow || bodyRows.length === 0) return;

  const headers = Array.from(headerRow.querySelectorAll("th"));
  const definedIndex = findHeaderIndex(headers, "Nosso Preço Definido");
  const actionsIndex = findHeaderIndex(headers, "Ações");

  if (definedIndex < 0 || actionsIndex < 0) return;

  headerRow.children[definedIndex].insertAdjacentElement("afterend", header("Preço Venda"));
  headerRow.children[definedIndex].insertAdjacentElement("afterend", header("X"));
  headerRow.children[actionsIndex + 2]?.insertAdjacentElement("beforebegin", header("Markup menor concorrente"));
  headerRow.children[actionsIndex + 2]?.insertAdjacentElement("beforebegin", header("Diferença de"));

  bodyRows.forEach((tr) => {
    const cells = Array.from(tr.children) as HTMLElement[];
    const productName = cells[0]?.textContent?.split("\n")?.[0]?.trim() ?? "";
    const snapshot = loadSnapshot(productName);
    const cost = parseNumber(cells[2]?.textContent ?? "");
    const defined = parseNumber(cells[3]?.textContent ?? "");
    const c1 = parseNumber(cells[4]?.textContent ?? "");
    const c2 = parseNumber(cells[5]?.textContent ?? "");
    const c3 = parseNumber(cells[6]?.textContent ?? "");
    const lowest = Math.min(...[c1, c2, c3].filter((value) => value > 0));
    const x = snapshot?.x && snapshot.x > 0 ? snapshot.x : cost > 0 && defined > 0 ? defined / cost : null;
    const salePrice = snapshot?.salePrice && snapshot.salePrice > 0 ? snapshot.salePrice : x && cost > 0 ? cost * x : null;
    const competitorMarkup = cost > 0 && Number.isFinite(lowest) ? lowest / cost : null;
    const difference = competitorMarkup !== null && x !== null ? competitorMarkup - x : null;

    tr.children[definedIndex].insertAdjacentElement("afterend", cell(formatMoney(salePrice)));
    tr.children[definedIndex].insertAdjacentElement("afterend", cell(formatMarkup(x)));
    tr.children[actionsIndex + 2]?.insertAdjacentElement("beforebegin", cell(formatMarkup(competitorMarkup), "green"));
    tr.children[actionsIndex + 2]?.insertAdjacentElement("beforebegin", cell(formatNumber(difference), difference !== null && difference >= 0 ? "green" : "red"));
  });

  table.dataset.extraBenchmarkColumns = "true";
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
    updateMarkupCard(row);
    hideSuggestedPriceCard(row);
    enhanceRegisteredTable(screen);
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
