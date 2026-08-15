import type { Expense } from "@prisma/client";

export function toExpenseResponse(expense: Expense) {
  return {
    id: expense.id,
    hotelId: expense.hotelId,
    departmentId: expense.departmentId,
    activityId: expense.activityId,
    costCenterId: expense.costCenterId,
    categoryId: expense.categoryId,
    amount: expense.amount,
    currency: expense.currency,
    date: expense.date,
    vendorName: expense.vendorName,
    supplierId: expense.supplierId,
    purchaseOrderId: expense.purchaseOrderId,
    paymentMethod: expense.paymentMethod,
    cashAccountId: expense.cashAccountId,
    bankAccountId: expense.bankAccountId,
    reference: expense.reference,
    attachmentReference: expense.attachmentReference,
    status: expense.status,
    requesterId: expense.requesterId,
    validatorId: expense.validatorId,
    validatedAt: expense.validatedAt,
    rejectionReason: expense.rejectionReason,
    paidAt: expense.paidAt,
    bookedAt: expense.bookedAt,
    createdAt: expense.createdAt,
  };
}
