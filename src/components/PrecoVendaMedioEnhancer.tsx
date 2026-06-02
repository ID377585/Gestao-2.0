"use client";

import { useEffect } from "react";

function parseCurrency(value: string) {
  const normalized = value
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const number = Number(normalized);

  return Number.isFinite(number) ? number : 0;
}

function formatRatioAsPercent(value: number | null) {
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

function findLabelByText(root: ParentNode, text: string) {
  return Array.from(root.querySelectorAll("label")).find((label) =>
    Array.from(label.querySelectorAll("span")).some((span) => span.textContent?.trim() === text),
  ) as HTMLLabelElement | undefined;
}

function getCostValue(container: ParentNode) {
  const costLabel = Array.from(container.querySelectorAll("p")).find(
    (element) => element.textContent?.trim() === "Preço de custo",
  );

  const costValue = costLabel?.parentElement?.querySelector("p:last-child")?.textContent ?? "";

  return parseCurrency(costValue);
}

function getButtonByText(root: ParentNode, text: string) {
  return Array.from(root.querySelectorAll("button")).find((button) => button.textContent?.trim() === text) as
    | HTMLButtonElement
    | undefined;
}

function getVisibleCompetitorPriceInputs(comparisonFormRow: Element) {
  return Array.from(comparisonFormRow.querySelectorAll("div input + input"))
    .filter((input) => {
      const element = input as HTMLInputElement;
      const card = element.closest("div");
      return card ? window.getComputedStyle(card).display !== "none" : true;
    })
    .slice(0, 3) as HTMLInputElement[];
}

function getPercentCard(comparisonFormRow: Element) {
  const title = Array.from(comparisonFormRow.querySelectorAll("p")).find((element) => {
    const text = element.textContent?.trim();
    return text === "Média concorrência" || text === "%";
  }) as HTMLParagraphElement | undefined;

  const card = title?.parentElement as HTMLElement | null;
  const value = card?.querySelector("p:last-child") as HTMLParagraphElement | null;

  return { title, value };
}

function calculateDefinedPriceVsLowestCompetitor(comparisonFormRow: Element, definedPriceInput: HTMLInputElement) {
  const definedPrice = parseCurrency(definedPriceInput.value);
  const competitorPrices = getVisibleCompetitorPriceInputs(comparisonFormRow)
    .map((input) => parseCurrency(input.value))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (definedPrice <= 0 || competitorPrices.length === 0) return null;

  const lowestCompetitorPrice = Math.min(...competitorPrices);

  if (lowestCompetitorPrice <= 0) return null;

  return definedPrice / lowestCompetitorPrice - 1;
}

function updatePercentCard(comparisonFormRow: Element, definedPriceInput: HTMLInputElement) {
  const { title, value } = getPercentCard(comparisonFormRow);
  if (!title || !value) return;

  title.textContent = "%";

  const percent = calculateDefinedPriceVsLowestCompetitor(comparisonFormRow, definedPriceInput);
  value.textContent = formatRatioAsPercent(percent);

  value.classList.remove("text-blue-900");
  value.classList.add((percent ?? 0) <= 0 ? "text-emerald-700" : "text-red-700");
}

function bindDefinedPriceInput(
  definedPriceInput: HTMLInputElement,
  manualPriceInput: HTMLInputElement,
  screen: Element,
  comparisonFormRow: Element,
) {
  const updatePercent = () => updatePercentCard(comparisonFormRow, definedPriceInput);

  const syncDefinedPriceToReactState = () => {
    const definedPrice = definedPriceInput.value.trim();

    if (!definedPrice) return;

    setReactInputValue(manualPriceInput, definedPrice);
    updatePercent();
  };

  if (definedPriceInput.dataset.definedPriceBound !== "true") {
    definedPriceInput.dataset.definedPriceBound = "true";
    definedPriceInput.addEventListener("input", () => {
      definedPriceInput.dataset.userEditedDefinedPrice = "true";
      updatePercent();
    });
    definedPriceInput.addEventListener("change", () => {
      definedPriceInput.dataset.userEditedDefinedPrice = "true";
      updatePercent();
    });
  }

  getVisibleCompetitorPriceInputs(comparisonFormRow).forEach((input) => {
    if (input.dataset.percentBound === "true") return;

    input.dataset.percentBound = "true";
    input.addEventListener("input", updatePercent);
    input.addEventListener("change", updatePercent);
  });

  const saveButton = getButtonByText(screen, "Salvar comparação");

  if (saveButton && saveButton.dataset.definedPriceSaveBound !== "true") {
    saveButton.dataset.definedPriceSaveBound = "true";
    saveButton.addEventListener("pointerdown", syncDefinedPriceToReactState, true);
    saveButton.addEventListener("mousedown", syncDefinedPriceToReactState, true);
    saveButton.addEventListener("click", syncDefinedPriceToReactState, true);
  }

  updatePercent();
}

function bindXInput(xInput: HTMLInputElement, comparisonFormRow: Element, manualPriceInput: HTMLInputElement) {
  const calculateSalePrice = () => {
    const factor = Number(xInput.value ?? "");
    const cost = getCostValue(comparisonFormRow);

    if (!Number.isFinite(factor) || factor <= 0 || cost <= 0) return;

    const result = Math.round(cost * factor * 100) / 100;
    setReactInputValue(manualPriceInput, String(result));
  };

  if (xInput.dataset.precoXBound !== "true") {
    xInput.dataset.precoXBound = "true";
    xInput.addEventListener("input", calculateSalePrice);
    xInput.addEventListener("change", calculateSalePrice);
  }

  calculateSalePrice();
}

function applyEnhancements() {
  if (!window.location.pathname.includes("/engenharia/preco-venda-medio")) return;

  const screen = document.querySelector(".benchmark-screen-area");
  if (!screen) return;

  const comparisonFormRow = screen.querySelector(".flex.min-w-max.items-end");
  if (!comparisonFormRow) return;

  const manualPriceLabel = findLabelByText(comparisonFormRow, "Preço Venda");
  const manualPriceInput = manualPriceLabel?.querySelector("input") as HTMLInputElement | null;

  if (!manualPriceLabel || !manualPriceInput) return;

  let xInput = comparisonFormRow.querySelector<HTMLInputElement>("[data-preco-x-input]");

  if (!xInput) {
    const xLabel = document.createElement("label");
    xLabel.className = "w-[110px] shrink-0";
    xLabel.setAttribute("data-preco-x-field", "true");
    xLabel.style.display = "block";
    xLabel.style.visibility = "visible";
    xLabel.style.opacity = "1";
    xLabel.innerHTML = `
      <span class="text-xs font-bold text-slate-700">X</span>
      <input data-preco-x-input="true" type="number" min="0" step="0.01" placeholder="X" class="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none ring-emerald-500 transition focus:ring-2" />
    `;

    manualPriceLabel.insertAdjacentElement("beforebegin", xLabel);
    xInput = xLabel.querySelector<HTMLInputElement>("[data-preco-x-input]");
  }

  let definedPriceInput = comparisonFormRow.querySelector<HTMLInputElement>("[data-defined-price-input]");

  if (!definedPriceInput) {
    const definedPriceLabel = document.createElement("label");
    definedPriceLabel.className = "w-[145px] shrink-0";
    definedPriceLabel.setAttribute("data-defined-price-field", "true");
    definedPriceLabel.style.display = "block";
    definedPriceLabel.style.visibility = "visible";
    definedPriceLabel.style.opacity = "1";
    definedPriceLabel.innerHTML = `
      <span class="text-xs font-bold text-slate-700">Nosso preço definido</span>
      <input data-defined-price-input="true" type="number" min="0" step="0.01" placeholder="Definido" class="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none ring-emerald-500 transition focus:ring-2" />
    `;

    manualPriceLabel.insertAdjacentElement("afterend", definedPriceLabel);
    definedPriceInput = definedPriceLabel.querySelector<HTMLInputElement>("[data-defined-price-input]");
  }

  if (!xInput || !definedPriceInput) return;

  bindXInput(xInput, comparisonFormRow, manualPriceInput);
  bindDefinedPriceInput(definedPriceInput, manualPriceInput, screen, comparisonFormRow);
}

export function PrecoVendaMedioEnhancer() {
  useEffect(() => {
    const interval = window.setInterval(applyEnhancements, 250);
    applyEnhancements();

    const observer = new MutationObserver(() => applyEnhancements());
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => {
      window.clearInterval(interval);
      observer.disconnect();
    };
  }, []);

  return null;
}
