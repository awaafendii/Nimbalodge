import { apiClient } from "./api-client.js";

export type MaintenanceInterventionType = "PREVENTIVE" | "CORRECTIVE";
export type MaintenanceInterventionStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export interface MaintenanceIntervention {
  id: string;
  hotelId: string;
  assetId: string | null;
  roomId: string | null;
  maintenanceRequestId: string | null;
  type: MaintenanceInterventionType;
  status: MaintenanceInterventionStatus;
  scheduledDate: string | null;
  completedDate: string | null;
  cost: string | null;
  notes: string | null;
  createdById: string;
  performedById: string | null;
  createdAt: string;
}

export interface CreateMaintenanceInterventionInput {
  type: MaintenanceInterventionType;
  assetId?: string;
  roomId?: string;
  maintenanceRequestId?: string;
  scheduledDate?: string;
  cost?: number;
  notes?: string;
  hotelId?: string;
}

export function listMaintenanceInterventions(): Promise<MaintenanceIntervention[]> {
  return apiClient.get<MaintenanceIntervention[]>("/maintenance-interventions");
}

export function createMaintenanceIntervention(
  input: CreateMaintenanceInterventionInput
): Promise<MaintenanceIntervention> {
  return apiClient.post<MaintenanceIntervention>("/maintenance-interventions", input);
}

export function startMaintenanceIntervention(id: string): Promise<MaintenanceIntervention> {
  return apiClient.post<MaintenanceIntervention>(`/maintenance-interventions/${id}/start`);
}

export function completeMaintenanceIntervention(id: string): Promise<MaintenanceIntervention> {
  return apiClient.post<MaintenanceIntervention>(`/maintenance-interventions/${id}/complete`);
}

export function cancelMaintenanceIntervention(id: string): Promise<MaintenanceIntervention> {
  return apiClient.post<MaintenanceIntervention>(`/maintenance-interventions/${id}/cancel`);
}
