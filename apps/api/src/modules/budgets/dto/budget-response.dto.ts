import type { Budget, BudgetLine } from "@prisma/client";

export function toBudgetResponse(budget: Budget) {
  return {
    id: budget.id,
    hotelId: budget.hotelId,
    name: budget.name,
    periodType: budget.periodType,
    startDate: budget.startDate,
    endDate: budget.endDate,
    isActive: budget.isActive,
    createdAt: budget.createdAt,
  };
}

export function toBudgetLineResponse(line: BudgetLine) {
  return {
    id: line.id,
    budgetId: line.budgetId,
    type: line.type,
    departmentId: line.departmentId,
    activityId: line.activityId,
    costCenterId: line.costCenterId,
    categoryId: line.categoryId,
    plannedAmount: line.plannedAmount,
    createdAt: line.createdAt,
  };
}
