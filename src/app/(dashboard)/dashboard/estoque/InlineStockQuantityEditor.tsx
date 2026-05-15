"use client";

import { useEffect, useRef } from "react";

import { updateInlineStockQuantity } from "./inline-quantity-actions";

type TableCacheItem = {
  row: HTMLTableRowElement;
  productId: string;
  name: string;
  sku: string;
  unit: string;
  quantity: number;
};

const NUMBER_FORMATTER = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

function normalizeSearchText(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseQuantityLabel(value: string | null | undefined) {
  const text = String(value ?? "").trim();
  const match = text.match(/^([\d.,]+)\s*(.*)$/);

  if (!match) {
    return { quantity: 0, unit: "UN" };
  }

  const quantity = Number(match[1].replace(/\./g, "").replace(",", "."));
  const unit = String(match[2] ?? "").trim().toUpperCase() || "UN";

  return {
    quantity: Number.isFinite(quantity) ? quantity : 0,
    unit,
  };
}

function formatQuantity(value: number) {
  return NUMBER_FORMATTER.format(value);
}

function getHeaderIndex(headers: HTMLTableCellElement[], label: string) {
  const normalizedLabel = normalizeSearchText(label);
  return headers.findIndex(
    (header) => normalizeSearchText(header.textContent) === normalizedLabel
  );
}

function getProductDataFromRow(row: HTMLTableRowElement) {
  const firstCell = row.cells.item(0);
  if (!firstCell) return null;

  const spans = Array.from(firstCell.querySelectorAll("span"));
  const name = String(spans[0]?.textContent ?? firstCell.textContent ?? "")
    .replace(/SKU:.*/i, "")
    .trim();
  const skuText = spans.find((span) => /SKU:/i.test(span.textContent ?? ""));
  const sku = String(skuText?.textContent ?? "")
    .replace(/SKU:/i, "")
    .trim();

  return { name, sku };
}

function buildTableCache(table: HTMLTableElement) {
  const headers = Array.from(table.querySelectorAll("thead th")) as HTMLTableCellElement[];
  const quantityIndex = getHeaderIndex(headers, "Qtd");
  const productIndex = getHeaderIndex(headers, "Produto");

  if (quantityIndex < 0 || productIndex !== 0) return [];

  const rows = Array.from(table.querySelectorAll("tbody tr")) as HTMLTableRowElement[];

  return rows
    .map((row) => {
      const product = getProductDataFromRow(row);
      const quantityCell = row.cells.item(quantityIndex);
      if (!product?.name || !quantityCell) return null;

      const { quantity, unit } = parseQuantityLabel(quantityCell.textContent);

      return {
        row,
        productId: "",
        name: product.name,
        sku: product.sku,
        unit,
        quantity,
      } satisfies TableCacheItem;
    })
    .filter(Boolean) as TableCacheItem[];
}

async function loadStockRows() {
  const response = await fetch("/api/products/catalog", { cache: "no-store" });
  if (!response.ok) return [];

  const json = await response.json();
  const rows = Array.isArray(json)
    ? json
    : Array.isArray(json?.data)
      ? json.data
      : Array.isArray(json?.items)
        ? json.items
        : Array.isArray(json?.products)
          ? json.products
          : [];

  return rows.map((item: any) => ({
    id: String(item.id ?? ""),
    name: String(item.name ?? ""),
    sku: String(item.sku ?? ""),
  }));
}

function findProductId(
  cacheItem: TableCacheItem,
  products: Array<{ id: string; name: string; sku: string }>
) {
  const sku = normalizeSearchText(cacheItem.sku);
  const name = normalizeSearchText(cacheItem.name);

  if (sku) {
    const bySku = products.find((product) => normalizeSearchText(product.sku) === sku);
    if (bySku?.id) return bySku.id;
  }

  const byName = products.find((product) => normalizeSearchText(product.name) === name);
  return byName?.id ?? "";
}

function showToast(message: string, variant: "success" | "error" = "success") {
  const event = new CustomEvent("gestao:inline-stock-toast", {
    detail: { message, variant },
  });
  window.dispatchEvent(event);
}

function makeQuantityInput(item: TableCacheItem) {
  const input = document.createElement("input");
  input.type = "number";
  input.min = "0";
  input.step = "0.001";
  input.value = String(item.quantity);
  input.dataset.inlineStockQty = "true";
  input.className =
    "h-8 w-24 rounded-md border border-input bg-background px-2 text-sm font-medium shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
  input.title = "Edite a quantidade e pressione Enter ou saia do campo para salvar";

  const unit = document.createElement("span");
  unit.textContent = item.unit;
  unit.className = "ml-1 text-xs text-muted-foreground";

  const status = document.createElement("span");
  status.className = "ml-2 text-[11px] text-muted-foreground";

  const wrapper = document.createElement("div");
  wrapper.className = "flex items-center whitespace-nowrap";
  wrapper.appendChild(input);
  wrapper.appendChild(unit);
  wrapper.appendChild(status);

  let lastSavedQuantity = item.quantity;
  let saving = false;

  const save = async () => {
    if (saving) return;

    const nextQuantity = Number(input.value);
    if (!Number.isFinite(nextQuantity) || nextQuantity < 0) {
      status.textContent = "inválido";
      status.className = "ml-2 text-[11px] text-red-600";
      input.value = String(lastSavedQuantity);
      return;
    }

    if (Math.abs(nextQuantity - lastSavedQuantity) < 0.000001) return;

    try {
      saving = true;
      input.disabled = true;
      status.textContent = "salvando...";
      status.className = "ml-2 text-[11px] text-muted-foreground";

      await updateInlineStockQuantity({
        productId: item.productId,
        quantity: nextQuantity,
      });

      lastSavedQuantity = nextQuantity;
      item.quantity = nextQuantity;
      input.value = String(nextQuantity);
      status.textContent = "salvo";
      status.className = "ml-2 text-[11px] text-emerald-600";
      showToast(`Quantidade de ${item.name} atualizada para ${formatQuantity(nextQuantity)} ${item.unit}.`);

      window.setTimeout(() => {
        status.textContent = "";
      }, 1800);
    } catch (error: any) {
      console.error("Erro ao atualizar quantidade inline:", error);
      input.value = String(lastSavedQuantity);
      status.textContent = "erro";
      status.className = "ml-2 text-[11px] text-red-600";
      showToast(
        error?.message ?? "Não foi possível atualizar a quantidade do estoque.",
        "error"
      );
    } finally {
      saving = false;
      input.disabled = false;
    }
  };

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      input.blur();
    }

    if (event.key === "Escape") {
      event.preventDefault();
      input.value = String(lastSavedQuantity);
      input.blur();
    }
  });

  input.addEventListener("blur", () => {
    void save();
  });

  return wrapper;
}

export function InlineStockQuantityEditor() {
  const mountedRef = useRef(false);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    let disposed = false;
    let running = false;

    const enhance = async () => {
      if (disposed || running) return;
      running = true;

      try {
        const tables = Array.from(document.querySelectorAll("table")) as HTMLTableElement[];
        const targetTable = tables.find((table) => {
          const headers = Array.from(table.querySelectorAll("thead th"));
          const labels = headers.map((header) => normalizeSearchText(header.textContent));
          return labels.includes("produto") && labels.includes("qtd") && labels.includes("min med max");
        });

        if (!targetTable) return;

        const cachedRows = buildTableCache(targetTable);
        if (cachedRows.length === 0) return;

        const products = await loadStockRows();

        for (const item of cachedRows) {
          if (disposed) return;

          const quantityCell = item.row.cells.item(getHeaderIndex(Array.from(targetTable.querySelectorAll("thead th")) as HTMLTableCellElement[], "Qtd"));
          if (!quantityCell || quantityCell.querySelector("[data-inline-stock-qty='true']")) continue;

          const productId = findProductId(item, products);
          if (!productId) continue;

          item.productId = productId;
          quantityCell.textContent = "";
          quantityCell.appendChild(makeQuantityInput(item));
        }
      } finally {
        running = false;
      }
    };

    const interval = window.setInterval(() => {
      void enhance();
    }, 1000);

    void enhance();

    const toastListener = (event: Event) => {
      const detail = (event as CustomEvent).detail as
        | { message?: string; variant?: "success" | "error" }
        | undefined;
      if (!detail?.message) return;

      const container = document.createElement("div");
      container.textContent = detail.message;
      container.className =
        detail.variant === "error"
          ? "fixed bottom-4 right-4 z-[9999] max-w-sm rounded-lg bg-red-600 px-4 py-3 text-sm font-medium text-white shadow-lg"
          : "fixed bottom-4 right-4 z-[9999] max-w-sm rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white shadow-lg";

      document.body.appendChild(container);
      window.setTimeout(() => container.remove(), 3000);
    };

    window.addEventListener("gestao:inline-stock-toast", toastListener);

    return () => {
      disposed = true;
      window.clearInterval(interval);
      window.removeEventListener("gestao:inline-stock-toast", toastListener);
    };
  }, []);

  return null;
}
