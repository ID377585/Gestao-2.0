import { listGoodsReceiptItems, listGoodsReceipts } from "@/lib/compras/receipts";
import { supabase } from "@/lib/supabase/client";

export type SupplierVarianceRow = {
  supplierId: string;
  supplierName: string;
  productId: string;
  productName: string;
  totalQuantity: number;
  averageRealUnitCost: number;
  theoreticalUnitCost: number | null;
  varianceValue: number;
  variancePercent: number;
  receiptsCount: number;
  lastReceiptDate: string | null;
};

export type SupplierVarianceSummary = {
  suppliers: Array<{
    supplierId: string;
    supplierName: string;
    totalItems: number;
    totalQuantity: number;
    averageVariancePercent: number;
    totalPositiveVarianceValue: number;
    totalNegativeVarianceValue: number;
    topProducts: Array<{
      name: string;
      value: number;
    }>;
  }>;
  topSuppliersByPositiveVariance: Array<{
    name: string;
    value: number;
  }>;
};

type ProductTheoreticalCost = {
  productId: string;
  productName: string;
  theoreticalUnitCost: number | null;
};

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toText(value: unknown) {
  return value == null ? "" : String(value);
}

function calculateVariancePercent(theoretical: number, real: number) {
  if (!theoretical || theoretical <= 0) return 0;
  return ((real - theoretical) / theoretical) * 100;
}

async function listTheoreticalProductCosts(): Promise<Map<string, ProductTheoreticalCost>> {

  try {
    const { data, error } = await supabase
      .from("technical_sheets")
      .select(
        [
          "name",
          "ingredients(",
          "product_id,",
          "ingredient_name,",
          "usage_quantity,",
          "base_unit_cost",
          ")",
        ].join("")
      );

    if (error) {
      console.warn("Não foi possível carregar custos teóricos por produto:", error.message);
      return new Map();
    }

    const costMap = new Map<
      string,
      {
        productName: string;
        costSum: number;
        count: number;
      }
    >();

if (error) {
  console.error(error);
  return new Map();
}

    const rows = data as any[];

for (const sheet of rows) {
      const rawSheet = sheet as Record<string, unknown>;
      const ingredients = Array.isArray(rawSheet.ingredients)
        ? (rawSheet.ingredients as Record<string, unknown>[])
        : [];

      for (const ingredient of ingredients) {
        const productId = toText(ingredient.product_id).trim();
        if (!productId) continue;

        const ingredientName = toText(ingredient.ingredient_name);
        const theoreticalUnitCost = toNumber(ingredient.base_unit_cost);

        const current = costMap.get(productId) ?? {
          productName: ingredientName,
          costSum: 0,
          count: 0,
        };

        if (theoreticalUnitCost > 0) {
          current.costSum += theoreticalUnitCost;
          current.count += 1;
        }

        if (!current.productName && ingredientName) {
          current.productName = ingredientName;
        }

        costMap.set(productId, current);
      }
    }

    const result = new Map<string, ProductTheoreticalCost>();

    for (const [productId, value] of costMap.entries()) {
      result.set(productId, {
        productId,
        productName: value.productName,
        theoreticalUnitCost:
          value.count > 0 ? Number((value.costSum / value.count).toFixed(4)) : null,
      });
    }

    return result;
  } catch (error) {
    console.warn("Falha ao montar custos teóricos por produto:", error);
    return new Map();
  }
}

export async function getSupplierVarianceSummary(): Promise<SupplierVarianceSummary> {
  const [receipts, theoreticalCosts] = await Promise.all([
    listGoodsReceipts(),
    listTheoreticalProductCosts(),
  ]);

  const finalizedReceipts = receipts.filter((receipt) => receipt.inventoryApplied);

  const itemAccumulator = new Map<
    string,
    {
      supplierId: string;
      supplierName: string;
      productId: string;
      productName: string;
      totalQuantity: number;
      totalValue: number;
      receiptsCount: number;
      lastReceiptDate: string | null;
    }
  >();

  for (const receipt of finalizedReceipts) {
    const items = await listGoodsReceiptItems(receipt.id);

    for (const item of items) {
      const productId = toText(item.productId).trim();
      if (!productId) continue;

      const key = `${receipt.supplierId}::${productId}`;
      const quantity = toNumber(item.quantidadeRecebida);
      const unitValue = toNumber(item.valorUnitarioReal);

      const current = itemAccumulator.get(key) ?? {
        supplierId: receipt.supplierId,
        supplierName: receipt.supplierName,
        productId,
        productName: item.produtoNome,
        totalQuantity: 0,
        totalValue: 0,
        receiptsCount: 0,
        lastReceiptDate: null,
      };

      current.totalQuantity += quantity;
      current.totalValue += quantity * unitValue;
      current.receiptsCount += 1;

      const receiptDate = receipt.finalizedAt || receipt.createdAt || null;
      if (receiptDate && (!current.lastReceiptDate || receiptDate > current.lastReceiptDate)) {
        current.lastReceiptDate = receiptDate;
      }

      itemAccumulator.set(key, current);
    }
  }

  const rows: SupplierVarianceRow[] = Array.from(itemAccumulator.values()).map((item) => {
    const averageRealUnitCost =
      item.totalQuantity > 0 ? item.totalValue / item.totalQuantity : 0;

    const theoretical = theoreticalCosts.get(item.productId);
    const theoreticalUnitCost = theoretical?.theoreticalUnitCost ?? null;

    const varianceValue =
      theoreticalUnitCost != null
        ? Number((averageRealUnitCost - theoreticalUnitCost).toFixed(4))
        : 0;

    const variancePercent =
      theoreticalUnitCost != null
        ? Number(
            calculateVariancePercent(theoreticalUnitCost, averageRealUnitCost).toFixed(2)
          )
        : 0;

    return {
      supplierId: item.supplierId,
      supplierName: item.supplierName,
      productId: item.productId,
      productName: item.productName,
      totalQuantity: Number(item.totalQuantity.toFixed(2)),
      averageRealUnitCost: Number(averageRealUnitCost.toFixed(4)),
      theoreticalUnitCost,
      varianceValue,
      variancePercent,
      receiptsCount: item.receiptsCount,
      lastReceiptDate: item.lastReceiptDate,
    };
  });

  const supplierMap = new Map<
    string,
    {
      supplierId: string;
      supplierName: string;
      totalItems: number;
      totalQuantity: number;
      variancePercentSum: number;
      variancePercentCount: number;
      totalPositiveVarianceValue: number;
      totalNegativeVarianceValue: number;
      topProductsMap: Map<string, number>;
    }
  >();

  for (const row of rows) {
    const current = supplierMap.get(row.supplierId) ?? {
      supplierId: row.supplierId,
      supplierName: row.supplierName,
      totalItems: 0,
      totalQuantity: 0,
      variancePercentSum: 0,
      variancePercentCount: 0,
      totalPositiveVarianceValue: 0,
      totalNegativeVarianceValue: 0,
      topProductsMap: new Map<string, number>(),
    };

    current.totalItems += 1;
    current.totalQuantity += row.totalQuantity;

    if (row.theoreticalUnitCost != null) {
      current.variancePercentSum += row.variancePercent;
      current.variancePercentCount += 1;
    }

    if (row.varianceValue > 0) {
      current.totalPositiveVarianceValue += row.varianceValue * row.totalQuantity;
      current.topProductsMap.set(
        row.productName,
        (current.topProductsMap.get(row.productName) ?? 0) +
          row.varianceValue * row.totalQuantity
      );
    } else if (row.varianceValue < 0) {
      current.totalNegativeVarianceValue += row.varianceValue * row.totalQuantity;
    }

    supplierMap.set(row.supplierId, current);
  }

  const suppliers = Array.from(supplierMap.values())
    .map((supplier) => ({
      supplierId: supplier.supplierId,
      supplierName: supplier.supplierName,
      totalItems: supplier.totalItems,
      totalQuantity: Number(supplier.totalQuantity.toFixed(2)),
      averageVariancePercent:
        supplier.variancePercentCount > 0
          ? Number(
              (supplier.variancePercentSum / supplier.variancePercentCount).toFixed(2)
            )
          : 0,
      totalPositiveVarianceValue: Number(
        supplier.totalPositiveVarianceValue.toFixed(2)
      ),
      totalNegativeVarianceValue: Number(
        supplier.totalNegativeVarianceValue.toFixed(2)
      ),
      topProducts: Array.from(supplier.topProductsMap.entries())
        .map(([name, value]) => ({
          name,
          value: Number(value.toFixed(2)),
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5),
    }))
    .sort((a, b) => b.totalPositiveVarianceValue - a.totalPositiveVarianceValue);

  return {
    suppliers,
    topSuppliersByPositiveVariance: suppliers.slice(0, 8).map((supplier) => ({
      name: supplier.supplierName,
      value: supplier.totalPositiveVarianceValue,
    })),
  };
}