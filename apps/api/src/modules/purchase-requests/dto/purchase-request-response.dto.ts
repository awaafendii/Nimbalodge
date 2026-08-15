import type { PurchaseRequest } from "@prisma/client";

export function toPurchaseRequestResponse(purchaseRequest: PurchaseRequest) {
  return {
    id: purchaseRequest.id,
    hotelId: purchaseRequest.hotelId,
    departmentId: purchaseRequest.departmentId,
    description: purchaseRequest.description,
    estimatedAmount: purchaseRequest.estimatedAmount,
    currency: purchaseRequest.currency,
    status: purchaseRequest.status,
    requestedById: purchaseRequest.requestedById,
    approvedById: purchaseRequest.approvedById,
    approvedAt: purchaseRequest.approvedAt,
    rejectionReason: purchaseRequest.rejectionReason,
    createdAt: purchaseRequest.createdAt,
  };
}
