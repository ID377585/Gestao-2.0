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
  } catch (error) {
    console.error("Erro ao aplicar coluna X no Preço Venda Médio:", error);
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
