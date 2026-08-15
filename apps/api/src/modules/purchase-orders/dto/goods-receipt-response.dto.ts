import type { GoodsReceipt, GoodsReceiptLine } from "@prisma/client";

type FullGoodsReceipt = GoodsReceipt & { lines: GoodsReceiptLine[] };

export function toGoodsReceiptResponse(goodsReceipt: FullGoodsReceipt) {
  return {
    id: goodsReceipt.id,
    purchaseOrderId: goodsReceipt.purchaseOrderId,
    date: goodsReceipt.date,
    notes: goodsReceipt.notes,
    createdById: goodsReceipt.createdById,
    lines: goodsReceipt.lines.map((line) => ({
      id: line.id,
      purchaseOrderLineId: line.purchaseOrderLineId,
      quantityReceived: line.quantityReceived,
    })),
    createdAt: goodsReceipt.createdAt,
  };
}
