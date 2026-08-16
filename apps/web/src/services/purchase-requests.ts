import { apiClient } from "./api-client.js";

export type PurchaseRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface PurchaseRequest {
  id: string;
  hotelId: string;
  departmentId: string | null;
  description: string;
  estimatedAmount: string | null;
  currency: string;
  status: PurchaseRequestStatus;
  requestedById: string;
  approvedById: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

export interface CreatePurchaseRequestInput {
  description: string;
  estimatedAmount?: number;
  departmentId?: string;
  hotelId?: string;
}

export function listPurchaseRequests(): Promise<PurchaseRequest[]> {
  return apiClient.get<PurchaseRequest[]>("/purchase-requests");
}

export function createPurchaseRequest(input: CreatePurchaseRequestInput): Promise<PurchaseRequest> {
  return apiClient.post<PurchaseRequest>("/purchase-requests", input);
}

export function approvePurchaseRequest(id: string): Promise<PurchaseRequest> {
  return apiClient.post<PurchaseRequest>(`/purchase-requests/${id}/approve`);
}

export function rejectPurchaseRequest(id: string): Promise<PurchaseRequest> {
  return apiClient.post<PurchaseRequest>(`/purchase-requests/${id}/reject`);
}

export function cancelPurchaseRequest(id: string): Promise<PurchaseRequest> {
  return apiClient.post<PurchaseRequest>(`/purchase-requests/${id}/cancel`);
}
