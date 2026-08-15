import type { StockMovement } from "@prisma/client";

export function toStockMovementResponse(movement: StockMovement) {
  return {
    id: movement.id,
    hotelId: movement.hotelId,
    productId: movement.productId,
    warehouseId: movement.warehouseId,
    toWarehouseId: movement.toWarehouseId,
    type: movement.type,
    quantity: movement.quantity,
    date: movement.date,
    reference: movement.reference,
    reason: movement.reason,
    notes: movement.notes,
    goodsReceiptId: movement.goodsReceiptId,
    createdById: movement.createdById,
    createdAt: movement.createdAt,
  };
}
