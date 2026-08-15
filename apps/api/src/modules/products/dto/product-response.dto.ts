import type { Product } from "@prisma/client";

export function toProductResponse(product: Product) {
  return {
    id: product.id,
    hotelId: product.hotelId,
    name: product.name,
    sku: product.sku,
    unit: product.unit,
    category: product.category,
    minThreshold: product.minThreshold,
    notes: product.notes,
    isActive: product.isActive,
    createdAt: product.createdAt,
  };
}
