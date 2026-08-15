import type { Revenue } from "@prisma/client";

export function toRevenueResponse(revenue: Revenue) {
  return {
    id: revenue.id,
    hotelId: revenue.hotelId,
    departmentId: revenue.departmentId,
    activityId: revenue.activityId,
    costCenterId: revenue.costCenterId,
    categoryId: revenue.categoryId,
    amount: revenue.amount,
    currency: revenue.currency,
    date: revenue.date,
    paymentMethod: revenue.paymentMethod,
    cashAccountId: revenue.cashAccountId,
    bankAccountId: revenue.bankAccountId,
    reference: revenue.reference,
    attachmentReference: revenue.attachmentReference,
    recordedById: revenue.recordedById,
    createdAt: revenue.createdAt,
  };
}
