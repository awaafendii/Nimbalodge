import { apiClient } from "./api-client.js";

export interface Employee {
  id: string;
  hotelId: string;
  userId: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  departmentId: string | null;
  employeeNumber: string | null;
  hireDate: string | null;
  contractType: string | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  baseSalary: string;
  currency: string;
  isActive: boolean;
  terminationDate: string | null;
  terminationReason: string | null;
  createdAt: string;
}

export interface CreateEmployeeInput {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  position?: string;
  departmentId?: string;
  employeeNumber?: string;
  hireDate?: string;
  contractType?: string;
  baseSalary: number;
  currency?: string;
  hotelId?: string;
}

export interface UpdateEmployeeInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  position?: string;
  departmentId?: string;
  baseSalary?: number;
  isActive?: boolean;
  terminationDate?: string;
  terminationReason?: string;
}

export function listEmployees(): Promise<Employee[]> {
  return apiClient.get<Employee[]>("/employees");
}

export function createEmployee(input: CreateEmployeeInput): Promise<Employee> {
  return apiClient.post<Employee>("/employees", input);
}

export function updateEmployee(id: string, input: UpdateEmployeeInput): Promise<Employee> {
  return apiClient.patch<Employee>(`/employees/${id}`, input);
}
