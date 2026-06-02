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
    xLabel.className = "preco-x-field";
    xLabel.setAttribute("data-preco-x-field", "true");
    xLabel.innerHTML = `
      <span>X</span>
      <input data-preco-x-input="true" type="number" min="0" step="0.01" placeholder="X" />
    `;

    manualPriceLabel.parentElement?.insertBefore(xLabel, manualPriceLabel);
    xInput = xLabel.querySelector<HTMLInputElement>("[data-preco-x-input]");
  }

  if (!xInput) return;

  const calculateSalePrice = () => {
    const factor = Number(xInput?.value ?? "");
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

export function PrecoVendaMedioEnhancer() {
  useEffect(() => {
    applyEnhancements();

    const observer = new MutationObserver(() => applyEnhancements());
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => observer.disconnect();
  }, []);

  return null;
}
