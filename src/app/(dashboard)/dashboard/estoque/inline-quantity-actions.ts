"use server";

import {
  createStockMovementAction,
  listCurrentStock,
} from "./actions";

type StockRowForInlineEdit = {
  id: string;
  quantity: number;
  unit_label: string | null;
  product: {
    id: string;
    name: string;
    sku?: string | null;
    default_unit_label?: string | null;
  } | null;
};

function normalizeNumber(input: unknown) {
  const n = Number(String(input ?? "").trim().replace(",", "."));
  return Number.isFinite(n) ? n : Number.NaN;
}

function normalizeUnit(input: unknown) {
  const unit = String(input ?? "").trim().toUpperCase();
  return unit || "UN";
}

export async function updateInlineStockQuantity(input: {
  productId: string;
  quantity: number;
}) {
  const productId = String(input.productId ?? "").trim();
  const nextQuantity = normalizeNumber(input.quantity);

  if (!productId) {
    throw new Error("Produto inválido para atualizar quantidade.");
  }

  if (!Number.isFinite(nextQuantity) || nextQuantity < 0) {
    throw new Error("Informe uma quantidade válida maior ou igual a zero.");
  }

  const rows = (await listCurrentStock()) as StockRowForInlineEdit[];
  const row = rows.find((item) => item.product?.id === productId);

  if (!row?.product?.id) {
    throw new Error("Item de estoque não encontrado para este produto.");
  }

  const currentQuantity = Number(row.quantity ?? 0);
  const delta = nextQuantity - currentQuantity;

  if (Math.abs(delta) < 0.000001) {
    return {
      ok: true,
      previousQuantity: currentQuantity,
      newQuantity: nextQuantity,
      delta: 0,
    };
  }

  const unitLabel = normalizeUnit(
    row.product.default_unit_label ?? row.unit_label ?? "UN"
  );

  await createStockMovementAction({
    product_id: productId,
    unit_label: unitLabel,
    qty_delta: delta,
    reason: "EDICAO_DIRETA_QTD_ESTOQUE",
    source: "inline_quantity_edit",
  });

  return {
    ok: true,
    previousQuantity: currentQuantity,
    newQuantity: nextQuantity,
    delta,
  };
}
