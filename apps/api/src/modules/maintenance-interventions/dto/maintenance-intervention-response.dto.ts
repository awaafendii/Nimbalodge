import type { MaintenanceIntervention } from "@prisma/client";

export function toMaintenanceInterventionResponse(intervention: MaintenanceIntervention) {
  return {
    id: intervention.id,
    hotelId: intervention.hotelId,
    assetId: intervention.assetId,
    roomId: intervention.roomId,
    maintenanceRequestId: intervention.maintenanceRequestId,
    type: intervention.type,
    status: intervention.status,
    scheduledDate: intervention.scheduledDate,
    completedDate: intervention.completedDate,
    cost: intervention.cost,
    notes: intervention.notes,
    createdById: intervention.createdById,
    performedById: intervention.performedById,
    createdAt: intervention.createdAt,
  };
}
