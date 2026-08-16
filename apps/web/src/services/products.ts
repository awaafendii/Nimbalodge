import { apiClient } from "./api-client.js";

export interface Product {
  id: string;
  hotelId: string;
  name: string;
  sku: string | null;
  unit: string | null;
  category: string | null;
  minThreshold: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface CreateProductInput {
  name: string;
  sku?: string;
  unit?: string;
  category?: string;
  minThreshold?: number;
  notes?: string;
  hotelId?: string;
}

export interface UpdateProductInput {
  name?: string;
  sku?: string;
  unit?: string;
  category?: string;
  minThreshold?: number;
  notes?: string;
  isActive?: boolean;
}

export interface ProductStock {
  productId: string;
  byWarehouse: { warehouseId: string; warehouseName: string; quantity: string }[];
  total: string;
}

export function listProducts(): Promise<Product[]> {
  return apiClient.get<Product[]>("/products");
}

export function createProduct(input: CreateProductInput): Promise<Product> {
  return apiClient.post<Product>("/products", input);
}

export function updateProduct(id: string, input: UpdateProductInput): Promise<Product> {
  return apiClient.patch<Product>(`/products/${id}`, input);
}

export function getProductStock(id: string): Promise<ProductStock> {
  return apiClient.get<ProductStock>(`/products/${id}/stock`);
}
