import { apiClient } from "./api-client.js";

export interface Department {
  id: string;
  hotelId: string;
  name: string;
  code: string | null;
  description: string | null;
  managerId: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface CreateDepartmentInput {
  name: string;
  code?: string;
  description?: string;
  hotelId?: string;
}

export interface UpdateDepartmentInput {
  name?: string;
  code?: string;
  description?: string;
  isActive?: boolean;
}

export function listDepartments(): Promise<Department[]> {
  return apiClient.get<Department[]>("/departments");
}

export function createDepartment(input: CreateDepartmentInput): Promise<Department> {
  return apiClient.post<Department>("/departments", input);
}

export function updateDepartment(id: string, input: UpdateDepartmentInput): Promise<Department> {
  return apiClient.patch<Department>(`/departments/${id}`, input);
}
