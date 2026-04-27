import { listGoodsReceiptItems, listGoodsReceipts } from "@/lib/compras/receipts";

export type RealProductCostInfo = {
  productId: string;
  unitCost: number;
  source: "goods_receipt";
  receiptId: string;
  receiptNumber: string;
  receiptDate: string;
};

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function listLatestRealProductCosts(): Promise<
  Map<string, RealProductCostInfo>
> {
  const receipts = await listGoodsReceipts();

  const validReceipts = receipts
    .filter((receipt) => receipt.inventoryApplied)
    .sort((a, b) => {
      const aDate = String(a.finalizedAt || a.createdAt || "");
      const bDate = String(b.finalizedAt || b.createdAt || "");
      return bDate.localeCompare(aDate);
    });

  const costMap = new Map<string, RealProductCostInfo>();

  for (const receipt of validReceipts) {
    const items = await listGoodsReceiptItems(receipt.id);

    for (const item of items) {
      const productId = String(item.productId || "").trim();
      const unitCost = toNumber(item.valorUnitarioReal);

      if (!productId || unitCost <= 0) {
        continue;
      }

      if (costMap.has(productId)) {
        continue;
      }

      costMap.set(productId, {
        productId,
        unitCost,
        source: "goods_receipt",
        receiptId: receipt.id,
        receiptNumber: receipt.numero,
        receiptDate: String(receipt.finalizedAt || receipt.createdAt || ""),
      });
    }
  }

  return costMap;
}