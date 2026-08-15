import type { MaintenanceRequest } from "@prisma/client";

export function toMaintenanceRequestResponse(maintenanceRequest: MaintenanceRequest) {
  return {
    id: maintenanceRequest.id,
    hotelId: maintenanceRequest.hotelId,
    assetId: maintenanceRequest.assetId,
    roomId: maintenanceRequest.roomId,
    description: maintenanceRequest.description,
    status: maintenanceRequest.status,
    requestedById: maintenanceRequest.requestedById,
    approvedById: maintenanceRequest.approvedById,
    approvedAt: maintenanceRequest.approvedAt,
    rejectionReason: maintenanceRequest.rejectionReason,
    createdAt: maintenanceRequest.createdAt,
  };
}
