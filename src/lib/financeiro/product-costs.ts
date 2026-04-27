import { supabase } from "@/lib/supabase/client";
import { listLatestRealProductCosts } from "@/lib/financeiro/real-product-costs";

export type ProductCostSource =
  | "goods_receipt"
  | "product.average_cost"
  | "product.avg_cost"
  | "product.unit_cost"
  | "product.cost_price"
  | "product.last_cost"
  | "product.current_cost"
  | "product.purchase_cost"
  | "product.custo_medio"
  | "product.custo_unitario"
  | "product.custo_atual"
  | "product.preco_custo"
  | "product.preco_de_custo"
  | "unknown";

export type ProductCostInfo = {
  productId: string;
  productName: string;
  unitCost: number | null;
  sourceField: ProductCostSource;
  referenceDate: string | null;
  referenceId: string | null;
  referenceLabel: string | null;
};

function toNumberOrNull(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function pickUnitCost(product: Record<string, unknown>) {
  const candidates: Array<{
    field: string;
    source: ProductCostSource;
  }> = [
    { field: "average_cost", source: "product.average_cost" },
    { field: "avg_cost", source: "product.avg_cost" },
    { field: "unit_cost", source: "product.unit_cost" },
    { field: "cost_price", source: "product.cost_price" },
    { field: "last_cost", source: "product.last_cost" },
    { field: "current_cost", source: "product.current_cost" },
    { field: "purchase_cost", source: "product.purchase_cost" },
    { field: "custo_medio", source: "product.custo_medio" },
    { field: "custo_unitario", source: "product.custo_unitario" },
    { field: "custo_atual", source: "product.custo_atual" },
    { field: "preco_custo", source: "product.preco_custo" },
    { field: "preco_de_custo", source: "product.preco_de_custo" },
  ];

  for (const candidate of candidates) {
    const value = toNumberOrNull(product[candidate.field]);
    if (value != null && value >= 0) {
      return {
        unitCost: value,
        sourceField: candidate.source,
      };
    }
  }

  return {
    unitCost: null,
    sourceField: "unknown" as ProductCostSource,
  };
}

export async function listProductCosts(): Promise<Map<string, ProductCostInfo>> {
  const [realCostMap] = await Promise.all([listLatestRealProductCosts()]);


  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Não autenticado.");
  }

  const { data, error } = await supabase.from("products").select("*");

  if (error) {
    throw new Error(error.message || "Erro ao carregar custos dos produtos.");
  }

  const map = new Map<string, ProductCostInfo>();

  for (const raw of data ?? []) {
    const product = raw as Record<string, unknown>;
    const productId = String(product.id ?? "");
    const productName = String(
      product.name ?? product.product_name ?? product.description ?? ""
    );

    if (!productId) continue;

    const realCost = realCostMap.get(productId);
    if (realCost) {
      map.set(productId, {
        productId,
        productName,
        unitCost: realCost.unitCost,
        sourceField: "goods_receipt",
        referenceDate: realCost.receiptDate || null,
        referenceId: realCost.receiptId,
        referenceLabel: realCost.receiptNumber,
      });
      continue;
    }

    const resolved = pickUnitCost(product);

    map.set(productId, {
      productId,
      productName,
      unitCost: resolved.unitCost,
      sourceField: resolved.sourceField,
      referenceDate: null,
      referenceId: null,
      referenceLabel: null,
    });
  }

  return map;
}