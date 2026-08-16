import { apiClient } from "./api-client.js";

export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface LeaveRequest {
  id: string;
  hotelId: string;
  employeeId: string;
  type: string | null;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: LeaveStatus;
  approvedById: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  createdById: string;
  days: number;
  createdAt: string;
}

export interface CreateLeaveRequestInput {
  employeeId: string;
  type?: string;
  startDate: string;
  endDate: string;
  reason?: string;
  hotelId?: string;
}

export function listLeaveRequests(): Promise<LeaveRequest[]> {
  return apiClient.get<LeaveRequest[]>("/leave-requests");
}

export function createLeaveRequest(input: CreateLeaveRequestInput): Promise<LeaveRequest> {
  return apiClient.post<LeaveRequest>("/leave-requests", input);
}

export function approveLeaveRequest(id: string): Promise<LeaveRequest> {
  return apiClient.post<LeaveRequest>(`/leave-requests/${id}/approve`);
}

export function rejectLeaveRequest(id: string, reason?: string): Promise<LeaveRequest> {
  return apiClient.post<LeaveRequest>(`/leave-requests/${id}/reject`, { reason });
}

export function cancelLeaveRequest(id: string): Promise<LeaveRequest> {
  return apiClient.post<LeaveRequest>(`/leave-requests/${id}/cancel`);
}
