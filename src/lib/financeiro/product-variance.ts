import { listGoodsReceiptItems, listGoodsReceipts } from "@/lib/compras/receipts";
import { supabase } from "@/lib/supabase/client";

export type ProductVarianceSupplierContribution = {
  supplierId: string;
  supplierName: string;
  quantity: number;
  averageRealUnitCost: number;
  varianceValue: number;
  variancePercent: number;
  receiptsCount: number;
  lastReceiptDate: string | null;
};

export type ProductVarianceRow = {
  productId: string;
  productName: string;
  totalQuantity: number;
  averageRealUnitCost: number;
  theoreticalUnitCost: number | null;
  varianceValue: number;
  variancePercent: number;
  receiptsCount: number;
  suppliersCount: number;
  lastReceiptDate: string | null;
  supplierContributions: ProductVarianceSupplierContribution[];
};

export type ProductVarianceSummary = {
  products: ProductVarianceRow[];
  topProductsByPositiveVariance: Array<{
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
          "base_unit_cost",
          ")",
        ].join("")
      );

    if (error) {
      console.warn("Não foi possível carregar custos teóricos por produto:", error.message);
      return new Map();
    }

    const accumulator = new Map<
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

        const current = accumulator.get(productId) ?? {
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

        accumulator.set(productId, current);
      }
    }

    const result = new Map<string, ProductTheoreticalCost>();

    for (const [productId, value] of accumulator.entries()) {
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

export async function getProductVarianceSummary(): Promise<ProductVarianceSummary> {
  const [receipts, theoreticalCosts] = await Promise.all([
    listGoodsReceipts(),
    listTheoreticalProductCosts(),
  ]);

  const finalizedReceipts = receipts.filter((receipt) => receipt.inventoryApplied);

  const productAccumulator = new Map<
    string,
    {
      productId: string;
      productName: string;
      totalQuantity: number;
      totalValue: number;
      receiptsCount: number;
      lastReceiptDate: string | null;
      supplierMap: Map<
        string,
        {
          supplierId: string;
          supplierName: string;
          quantity: number;
          totalValue: number;
          receiptsCount: number;
          lastReceiptDate: string | null;
        }
      >;
    }
  >();

  for (const receipt of finalizedReceipts) {
    const items = await listGoodsReceiptItems(receipt.id);

    for (const item of items) {
      const productId = toText(item.productId).trim();
      if (!productId) continue;

      const quantity = toNumber(item.quantidadeRecebida);
      const unitValue = toNumber(item.valorUnitarioReal);

      if (quantity <= 0 || unitValue <= 0) {
        continue;
      }

      const receiptDate = receipt.finalizedAt || receipt.createdAt || null;

      const currentProduct = productAccumulator.get(productId) ?? {
        productId,
        productName: toText(item.produtoNome),
        totalQuantity: 0,
        totalValue: 0,
        receiptsCount: 0,
        lastReceiptDate: null,
        supplierMap: new Map(),
      };

      currentProduct.totalQuantity += quantity;
      currentProduct.totalValue += quantity * unitValue;
      currentProduct.receiptsCount += 1;

      if (
        receiptDate &&
        (!currentProduct.lastReceiptDate || receiptDate > currentProduct.lastReceiptDate)
      ) {
        currentProduct.lastReceiptDate = receiptDate;
      }

      const supplierKey = toText(receipt.supplierId);
      const currentSupplier = currentProduct.supplierMap.get(supplierKey) ?? {
        supplierId: toText(receipt.supplierId),
        supplierName: toText(receipt.supplierName),
        quantity: 0,
        totalValue: 0,
        receiptsCount: 0,
        lastReceiptDate: null,
      };

      currentSupplier.quantity += quantity;
      currentSupplier.totalValue += quantity * unitValue;
      currentSupplier.receiptsCount += 1;

      if (
        receiptDate &&
        (!currentSupplier.lastReceiptDate || receiptDate > currentSupplier.lastReceiptDate)
      ) {
        currentSupplier.lastReceiptDate = receiptDate;
      }

      currentProduct.supplierMap.set(supplierKey, currentSupplier);
      productAccumulator.set(productId, currentProduct);
    }
  }

  const products: ProductVarianceRow[] = Array.from(productAccumulator.values())
    .map((product) => {
      const averageRealUnitCost =
        product.totalQuantity > 0 ? product.totalValue / product.totalQuantity : 0;

      const theoretical = theoreticalCosts.get(product.productId);
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

      const supplierContributions: ProductVarianceSupplierContribution[] = Array.from(
        product.supplierMap.values()
      )
        .map((supplier) => {
          const averageSupplierCost =
            supplier.quantity > 0 ? supplier.totalValue / supplier.quantity : 0;

          const supplierVarianceValue =
            theoreticalUnitCost != null
              ? Number((averageSupplierCost - theoreticalUnitCost).toFixed(4))
              : 0;

          const supplierVariancePercent =
            theoreticalUnitCost != null
              ? Number(
                  calculateVariancePercent(
                    theoreticalUnitCost,
                    averageSupplierCost
                  ).toFixed(2)
                )
              : 0;

          return {
            supplierId: supplier.supplierId,
            supplierName: supplier.supplierName,
            quantity: Number(supplier.quantity.toFixed(2)),
            averageRealUnitCost: Number(averageSupplierCost.toFixed(4)),
            varianceValue: supplierVarianceValue,
            variancePercent: supplierVariancePercent,
            receiptsCount: supplier.receiptsCount,
            lastReceiptDate: supplier.lastReceiptDate,
          };
        })
        .sort((a, b) => b.varianceValue - a.varianceValue);

      return {
        productId: product.productId,
        productName: product.productName || theoretical?.productName || "Produto sem nome",
        totalQuantity: Number(product.totalQuantity.toFixed(2)),
        averageRealUnitCost: Number(averageRealUnitCost.toFixed(4)),
        theoreticalUnitCost,
        varianceValue,
        variancePercent,
        receiptsCount: product.receiptsCount,
        suppliersCount: supplierContributions.length,
        lastReceiptDate: product.lastReceiptDate,
        supplierContributions,
      };
    })
    .sort((a, b) => b.varianceValue - a.varianceValue);

  return {
    products,
    topProductsByPositiveVariance: products
      .filter((product) => product.varianceValue > 0)
      .slice(0, 10)
      .map((product) => ({
        name: product.productName,
        value: Number((product.varianceValue * product.totalQuantity).toFixed(2)),
      })),
  };
}