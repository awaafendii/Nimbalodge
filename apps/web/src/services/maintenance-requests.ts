import { apiClient } from "./api-client.js";

export type MaintenanceRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface MaintenanceRequest {
  id: string;
  hotelId: string;
  description: string;
  assetId: string | null;
  roomId: string | null;
  status: MaintenanceRequestStatus;
  requestedById: string;
  approvedById: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

export interface CreateMaintenanceRequestInput {
  description: string;
  assetId?: string;
  roomId?: string;
  hotelId?: string;
}

export function listMaintenanceRequests(): Promise<MaintenanceRequest[]> {
  return apiClient.get<MaintenanceRequest[]>("/maintenance-requests");
}

// create/approve/reject/cancel n'appellent plus apiClient directement — voir
// hooks/use-maintenance-requests.ts, qui passe désormais par offline/mutation-queue.ts
// (queueOrSend) pour le support hors ligne, Étape 6.
