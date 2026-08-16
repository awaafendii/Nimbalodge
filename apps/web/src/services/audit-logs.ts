import { apiClient } from "./api-client.js";

export type AuditOutcome = "SUCCESS" | "FAILURE";

export interface AuditLog {
  id: string;
  organizationId: string;
  hotelId: string | null;
  userId: string | null;
  method: string;
  path: string;
  resourceType: string | null;
  outcome: AuditOutcome;
  errorMessage: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface AuditLogFilters {
  dateFrom?: string;
  dateTo?: string;
  resourceType?: string;
}

export function listAuditLogs(filters: AuditLogFilters = {}): Promise<AuditLog[]> {
  const params = new URLSearchParams();
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (filters.resourceType) params.set("resourceType", filters.resourceType);
  const query = params.toString();
  return apiClient.get<AuditLog[]>(`/audit-logs${query ? `?${query}` : ""}`);
}
