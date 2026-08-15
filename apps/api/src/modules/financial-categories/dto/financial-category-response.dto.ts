import type { FinancialCategory } from "@prisma/client";

export function toFinancialCategoryResponse(category: FinancialCategory) {
  return {
    id: category.id,
    hotelId: category.hotelId,
    type: category.type,
    name: category.name,
    code: category.code,
    description: category.description,
    isActive: category.isActive,
    createdAt: category.createdAt,
  };
}
