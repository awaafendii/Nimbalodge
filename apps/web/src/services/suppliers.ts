import { apiClient } from "./api-client.js";

export interface Supplier {
  id: string;
  hotelId: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  taxId: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface CreateSupplierInput {
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  notes?: string;
  hotelId?: string;
}

export interface UpdateSupplierInput {
  name?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  notes?: string;
  isActive?: boolean;
}

export function listSuppliers(): Promise<Supplier[]> {
  return apiClient.get<Supplier[]>("/suppliers");
}

export function createSupplier(input: CreateSupplierInput): Promise<Supplier> {
  return apiClient.post<Supplier>("/suppliers", input);
}

export function updateSupplier(id: string, input: UpdateSupplierInput): Promise<Supplier> {
  return apiClient.patch<Supplier>(`/suppliers/${id}`, input);
}
