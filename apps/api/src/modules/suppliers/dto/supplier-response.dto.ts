import type { Supplier } from "@prisma/client";

export function toSupplierResponse(supplier: Supplier) {
  return {
    id: supplier.id,
    hotelId: supplier.hotelId,
    name: supplier.name,
    contactName: supplier.contactName,
    email: supplier.email,
    phone: supplier.phone,
    address: supplier.address,
    taxId: supplier.taxId,
    notes: supplier.notes,
    isActive: supplier.isActive,
    createdAt: supplier.createdAt,
  };
}
