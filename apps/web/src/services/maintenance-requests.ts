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

export function createMaintenanceRequest(input: CreateMaintenanceRequestInput): Promise<MaintenanceRequest> {
  return apiClient.post<MaintenanceRequest>("/maintenance-requests", input);
}

export function approveMaintenanceRequest(id: string): Promise<MaintenanceRequest> {
  return apiClient.post<MaintenanceRequest>(`/maintenance-requests/${id}/approve`);
}

export function rejectMaintenanceRequest(id: string): Promise<MaintenanceRequest> {
  return apiClient.post<MaintenanceRequest>(`/maintenance-requests/${id}/reject`);
}

export function cancelMaintenanceRequest(id: string): Promise<MaintenanceRequest> {
  return apiClient.post<MaintenanceRequest>(`/maintenance-requests/${id}/cancel`);
}
