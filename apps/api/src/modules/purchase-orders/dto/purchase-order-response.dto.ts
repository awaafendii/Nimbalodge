import {
  Prisma,
  type GoodsReceipt,
  type GoodsReceiptLine,
  type PurchaseOrder,
  type PurchaseOrderLine,
} from "@prisma/client";
import type { Decimal } from "@prisma/client/runtime/library";

type FullGoodsReceipt = GoodsReceipt & { lines: GoodsReceiptLine[] };
type FullPurchaseOrder = PurchaseOrder & { lines: PurchaseOrderLine[]; goodsReceipts: FullGoodsReceipt[] };

// quantity × unitPrice — pas de discountRate/taxRate (contrairement à InvoiceLine, non détaillé au
// brief pour un bon de commande interne).
export function computeLineTotal(line: Pick<PurchaseOrderLine, "quantity" | "unitPrice">): Decimal {
  return line.quantity.times(line.unitPrice);
}

// Cumulé à la demande à partir de toutes les GoodsReceiptLine de la commande, jamais dénormalisé
// sur PurchaseOrderLine — même principe que le solde CashAccount (Phase 5).
export function computeReceivedQuantity(lineId: string, goodsReceipts: FullGoodsReceipt[]): Decimal {
  let total = new Prisma.Decimal(0);
  for (const receipt of goodsReceipts) {
    for (const line of receipt.lines) {
      if (line.purchaseOrderLineId === lineId) {
        total = total.plus(line.quantityReceived);
      }
    }
  }
  return total;
}

export function toPurchaseOrderResponse(purchaseOrder: FullPurchaseOrder) {
  let orderTotal = new Prisma.Decimal(0);
  const lines = purchaseOrder.lines.map((line) => {
    const lineTotal = computeLineTotal(line);
    orderTotal = orderTotal.plus(lineTotal);
    return {
      id: line.id,
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      lineTotal,
      receivedQuantity: computeReceivedQuantity(line.id, purchaseOrder.goodsReceipts),
    };
  });

  return {
    id: purchaseOrder.id,
    hotelId: purchaseOrder.hotelId,
    supplierId: purchaseOrder.supplierId,
    purchaseRequestId: purchaseOrder.purchaseRequestId,
    orderNumber: purchaseOrder.orderNumber,
    status: purchaseOrder.status,
    orderDate: purchaseOrder.orderDate,
    expectedDate: purchaseOrder.expectedDate,
    currency: purchaseOrder.currency,
    notes: purchaseOrder.notes,
    createdById: purchaseOrder.createdById,
    lines,
    orderTotal,
    createdAt: purchaseOrder.createdAt,
  };
}
