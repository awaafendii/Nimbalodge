import { apiClient } from "./api-client.js";

export interface Warehouse {
  id: string;
  hotelId: string;
  name: string;
  departmentId: string | null;
  location: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface CreateWarehouseInput {
  name: string;
  departmentId?: string;
  location?: string;
  hotelId?: string;
}

export interface UpdateWarehouseInput {
  name?: string;
  departmentId?: string;
  location?: string;
  isActive?: boolean;
}

export function listWarehouses(): Promise<Warehouse[]> {
  return apiClient.get<Warehouse[]>("/warehouses");
}

export function createWarehouse(input: CreateWarehouseInput): Promise<Warehouse> {
  return apiClient.post<Warehouse>("/warehouses", input);
}

export function updateWarehouse(id: string, input: UpdateWarehouseInput): Promise<Warehouse> {
  return apiClient.patch<Warehouse>(`/warehouses/${id}`, input);
}
