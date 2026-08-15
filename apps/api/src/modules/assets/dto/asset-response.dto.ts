import type { Asset } from "@prisma/client";

export function toAssetResponse(asset: Asset) {
  return {
    id: asset.id,
    hotelId: asset.hotelId,
    roomId: asset.roomId,
    name: asset.name,
    category: asset.category,
    serialNumber: asset.serialNumber,
    purchaseDate: asset.purchaseDate,
    notes: asset.notes,
    isActive: asset.isActive,
    createdAt: asset.createdAt,
  };
}
