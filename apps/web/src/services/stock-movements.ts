import { apiClient } from "./api-client.js";

export type StockMovementType = "IN" | "OUT" | "TRANSFER" | "ADJUSTMENT" | "CONSUMPTION" | "LOSS";
export type SimpleStockMovementType = "IN" | "OUT" | "CONSUMPTION" | "LOSS";

export interface StockMovement {
  id: string;
  hotelId: string;
  productId: string;
  warehouseId: string;
  toWarehouseId: string | null;
  type: StockMovementType;
  quantity: string;
  date: string;
  reference: string | null;
  reason: string | null;
  notes: string | null;
  goodsReceiptId: string | null;
  createdById: string;
  createdAt: string;
}

export interface CreateStockMovementInput {
  type: SimpleStockMovementType;
  productId: string;
  warehouseId: string;
  quantity: number;
  reference?: string;
  notes?: string;
  hotelId?: string;
}

export interface CreateTransferInput {
  productId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  quantity: number;
  reference?: string;
  notes?: string;
  hotelId?: string;
}

export interface CreateAdjustmentInput {
  productId: string;
  warehouseId: string;
  quantity: number;
  reason?: string;
  notes?: string;
  hotelId?: string;
}

export function listStockMovements(): Promise<StockMovement[]> {
  return apiClient.get<StockMovement[]>("/stock-movements");
}

export function createStockMovement(input: CreateStockMovementInput): Promise<StockMovement> {
  return apiClient.post<StockMovement>("/stock-movements", input);
}

export function createTransfer(input: CreateTransferInput): Promise<StockMovement> {
  return apiClient.post<StockMovement>("/stock-movements/transfer", input);
}

export function createAdjustment(input: CreateAdjustmentInput): Promise<StockMovement> {
  return apiClient.post<StockMovement>("/stock-movements/adjustment", input);
}
