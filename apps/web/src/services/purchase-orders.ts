import { apiClient } from "./api-client.js";

export type PurchaseOrderStatus = "DRAFT" | "SENT" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED";

export interface PurchaseOrderLine {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
  receivedQuantity: string;
}

export interface PurchaseOrder {
  id: string;
  hotelId: string;
  supplierId: string;
  purchaseRequestId: string | null;
  orderNumber: string | null;
  status: PurchaseOrderStatus;
  orderDate: string | null;
  expectedDate: string | null;
  currency: string;
  notes: string | null;
  createdById: string;
  lines: PurchaseOrderLine[];
  orderTotal: string;
  createdAt: string;
}

export interface CreatePurchaseOrderLineInput {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface CreatePurchaseOrderInput {
  supplierId: string;
  purchaseRequestId?: string;
  lines: CreatePurchaseOrderLineInput[];
  hotelId?: string;
}

export interface GoodsReceiptLine {
  id: string;
  purchaseOrderLineId: string;
  quantityReceived: string;
}

export interface GoodsReceipt {
  id: string;
  purchaseOrderId: string;
  date: string;
  notes: string | null;
  lines: GoodsReceiptLine[];
  createdAt: string;
}

export interface CreateGoodsReceiptInput {
  notes?: string;
  lines: { purchaseOrderLineId: string; quantityReceived: number }[];
}

export function listPurchaseOrders(): Promise<PurchaseOrder[]> {
  return apiClient.get<PurchaseOrder[]>("/purchase-orders");
}

export function createPurchaseOrder(input: CreatePurchaseOrderInput): Promise<PurchaseOrder> {
  return apiClient.post<PurchaseOrder>("/purchase-orders", input);
}

export function sendPurchaseOrder(id: string): Promise<PurchaseOrder> {
  return apiClient.post<PurchaseOrder>(`/purchase-orders/${id}/send`);
}

export function cancelPurchaseOrder(id: string): Promise<PurchaseOrder> {
  return apiClient.post<PurchaseOrder>(`/purchase-orders/${id}/cancel`);
}

export function createGoodsReceipt(
  purchaseOrderId: string,
  input: CreateGoodsReceiptInput
): Promise<GoodsReceipt> {
  return apiClient.post<GoodsReceipt>(`/purchase-orders/${purchaseOrderId}/receipts`, input);
}
