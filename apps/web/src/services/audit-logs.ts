import { apiClient } from "./api-client.js";

export type AuditOutcome = "SUCCESS" | "FAILURE";

export interface AuditLog {
  id: string;
  organizationId: string | null;
  hotelId: string | null;
  departmentId: string | null;
  userId: string | null;
  method: string;
  path: string;
  resourceType: string | null;
  resourceId: string | null;
  action: string;
  outcome: AuditOutcome;
  errorMessage: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface AuditLogDetail extends AuditLog {
  before: unknown;
  after: unknown;
}

export interface AuditLogFilters {
  search?: string;
  userId?: string;
  resourceType?: string;
  action?: string;
  departmentId?: string;
  hotelId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface AuditLogPage {
  items: AuditLog[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export function listAuditLogs(filters: AuditLogFilters = {}): Promise<AuditLogPage> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const query = params.toString();
  return apiClient.get<AuditLogPage>(`/audit-logs${query ? `?${query}` : ""}`);
}

export function getAuditLog(id: string): Promise<AuditLogDetail> {
  return apiClient.get<AuditLogDetail>(`/audit-logs/${id}`);
}
