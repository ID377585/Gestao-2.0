import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import type {
  FinalizeGoodsReceiptResult,
  GoodsReceipt,
  GoodsReceiptItem,
  PurchaseOrder,
  PurchaseOrderStatus,
} from "@/types/compras";

const PRODUCT_COLLECTION = "products";
const STOCK_MOVEMENT_COLLECTION = "stockMovements";
const PRODUCT_COST_HISTORY_COLLECTION = "productCostHistory";
const ACCOUNTS_PAYABLE_COLLECTION = "accountsPayable";

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function calculateWeightedAverageCost(params: {
  currentStock: number;
  currentAverageCost: number;
  entryQuantity: number;
  entryUnitCost: number;
}) {
  const { currentStock, currentAverageCost, entryQuantity, entryUnitCost } = params;

  if (entryQuantity <= 0) return currentAverageCost;
  if (currentStock <= 0) return entryUnitCost;

  const newStock = currentStock + entryQuantity;

  if (newStock <= 0) return entryUnitCost;

  return (
    (currentStock * currentAverageCost + entryQuantity * entryUnitCost) / newStock
  );
}

export async function applyPurchaseReceiptToInventory(params: {
  receipt: GoodsReceipt;
  order: PurchaseOrder;
  items: GoodsReceiptItem[];
  receiptStatus: "divergencia" | "finalizado";
  orderStatus: PurchaseOrderStatus;
  valorTotalRecebido: number;
  observacoes?: string;
  vencimento?: string;
}): Promise<FinalizeGoodsReceiptResult> {
  const receiptRef = doc(db, "goodsReceipts", params.receipt.id);
  const orderRef = doc(db, "purchaseOrders", params.order.id);
  const payableRef = doc(db, ACCOUNTS_PAYABLE_COLLECTION, params.receipt.id);

  return runTransaction(db, async (tx) => {
    const liveReceiptSnap = await tx.get(receiptRef);

    if (!liveReceiptSnap.exists()) {
      throw new Error("Recebimento não encontrado.");
    }

    const liveReceipt = liveReceiptSnap.data();

    if (liveReceipt.inventoryApplied) {
      return {
        receiptStatus: liveReceipt.status ?? params.receiptStatus,
        orderStatus: params.orderStatus,
        valorTotalRecebido: toNumber(liveReceipt.valorTotalRecebido),
        inventoryPendingLink: Boolean(liveReceipt.inventoryPendingLink ?? false),
        alreadyApplied: true,
      };
    }

    let inventoryPendingLink = false;

    for (const item of params.items) {
      const quantidadeRecebida = toNumber(item.quantidadeRecebida);
      const valorUnitarioReal = toNumber(item.valorUnitarioReal);

      const itemRef = doc(
        db,
        "goodsReceipts",
        params.receipt.id,
        "items",
        item.id
      );

      tx.update(itemRef, {
        quantidadeRecebida,
        valorUnitarioReal,
        lote: item.lote ?? "",
        validade: item.validade ?? "",
        divergencia: Boolean(item.divergencia),
        motivoDivergencia: item.motivoDivergencia ?? "",
        updatedAt: serverTimestamp(),
      });

      if (quantidadeRecebida <= 0) {
        continue;
      }

      const movementRef = doc(
        db,
        STOCK_MOVEMENT_COLLECTION,
        `${params.receipt.id}_${item.id}`
      );

      if (!item.productId) {
        inventoryPendingLink = true;

        tx.set(movementRef, {
          origem: "recebimento_compra",
          origemId: params.receipt.id,
          receiptNumber: params.receipt.numero,
          purchaseOrderId: params.receipt.purchaseOrderId,
          productId: "",
          produtoNome: item.produtoNome,
          tipo: "entrada",
          quantidade: quantidadeRecebida,
          unidade: item.unidade,
          lote: item.lote ?? "",
          validade: item.validade ?? "",
          valorUnitario: valorUnitarioReal,
          valorTotal: quantidadeRecebida * valorUnitarioReal,
          pendenteVinculoProduto: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        continue;
      }

      const productRef = doc(db, PRODUCT_COLLECTION, item.productId);
      const productSnap = await tx.get(productRef);

      if (!productSnap.exists()) {
        throw new Error(
          `Produto do estoque não encontrado para o item "${item.produtoNome}".`
        );
      }

      const productData = productSnap.data();

      const currentStock = toNumber(productData.stockAtual);
      const currentAverageCost = toNumber(productData.custoMedio);
      const newStock = currentStock + quantidadeRecebida;

      const newAverageCost = calculateWeightedAverageCost({
        currentStock,
        currentAverageCost,
        entryQuantity: quantidadeRecebida,
        entryUnitCost: valorUnitarioReal,
      });

      tx.update(productRef, {
        stockAtual: newStock,
        custoMedio: newAverageCost,
        ultimoCustoCompra: valorUnitarioReal,
        dataUltimaCompra: params.receipt.dataRecebimento,
        updatedAt: serverTimestamp(),
      });

      tx.set(movementRef, {
        origem: "recebimento_compra",
        origemId: params.receipt.id,
        receiptNumber: params.receipt.numero,
        purchaseOrderId: params.receipt.purchaseOrderId,
        productId: item.productId,
        produtoNome: item.produtoNome,
        tipo: "entrada",
        quantidade: quantidadeRecebida,
        unidade: item.unidade,
        lote: item.lote ?? "",
        validade: item.validade ?? "",
        valorUnitario: valorUnitarioReal,
        valorTotal: quantidadeRecebida * valorUnitarioReal,
        stockAnterior: currentStock,
        stockPosterior: newStock,
        custoMedioAnterior: currentAverageCost,
        custoMedioPosterior: newAverageCost,
        pendenteVinculoProduto: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const costHistoryRef = doc(
        db,
        PRODUCT_COST_HISTORY_COLLECTION,
        `${params.receipt.id}_${item.id}`
      );

      tx.set(costHistoryRef, {
        productId: item.productId,
        produtoNome: item.produtoNome,
        origem: "recebimento_compra",
        origemId: params.receipt.id,
        receiptNumber: params.receipt.numero,
        purchaseOrderId: params.receipt.purchaseOrderId,
        quantidadeEntrada: quantidadeRecebida,
        valorUnitarioEntrada: valorUnitarioReal,
        stockAnterior: currentStock,
        stockPosterior: newStock,
        custoMedioAnterior: currentAverageCost,
        custoMedioPosterior: newAverageCost,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    tx.update(receiptRef, {
      status: params.receiptStatus,
      observacoes: params.observacoes ?? params.receipt.observacoes ?? "",
      valorTotalRecebido: params.valorTotalRecebido,
      inventoryApplied: true,
      inventoryPendingLink,
      payableCreated: params.valorTotalRecebido > 0,
      finalizedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    tx.update(orderRef, {
      status: params.orderStatus,
      updatedAt: serverTimestamp(),
    });

    if (params.valorTotalRecebido > 0) {
      tx.set(
        payableRef,
        {
          origem: "recebimento",
origemId: params.receipt.id,
supplierId: params.receipt.supplierId,
supplierName: params.receipt.supplierName,
descricao: `Recebimento ${params.receipt.numero} - Pedido ${params.receipt.purchaseOrderNumber}`,
valor: params.valorTotalRecebido,
vencimento: params.vencimento ?? params.order.vencimento ?? "",
statusPagamento: "pendente",
dataPagamento: "",
formaPagamento: "",
numeroDocumento: params.receipt.numero,
categoria: "Compras",
centroCusto: "Suprimentos",
observacoes: params.observacoes ?? "",
createdAt: serverTimestamp(),
updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }

    return {
      receiptStatus: params.receiptStatus,
      orderStatus: params.orderStatus,
      valorTotalRecebido: params.valorTotalRecebido,
      inventoryPendingLink,
      alreadyApplied: false,
    };
  });
}