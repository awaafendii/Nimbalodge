import { apiClient } from "./api-client.js";
import type { FinancialCategoryType } from "./finance-entries.js";

export type BudgetPeriod = "ANNUAL" | "QUARTERLY" | "MONTHLY";

export interface Budget {
  id: string;
  hotelId: string;
  name: string;
  periodType: BudgetPeriod;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
}

export interface BudgetLine {
  id: string;
  budgetId: string;
  type: FinancialCategoryType;
  departmentId: string | null;
  activityId: string | null;
  costCenterId: string | null;
  categoryId: string | null;
  plannedAmount: string;
  createdAt: string;
}

export interface BudgetDetail extends Budget {
  lines: BudgetLine[];
}

export interface BudgetExecutionLine {
  lineId: string;
  type: FinancialCategoryType;
  departmentId: string | null;
  activityId: string | null;
  costCenterId: string | null;
  categoryId: string | null;
  planned: string;
  actual: string;
  variance: string;
  executionRate: string;
}

export interface BudgetExecution {
  budgetId: string;
  startDate: string;
  endDate: string;
  lines: BudgetExecutionLine[];
}

export interface CreateBudgetInput {
  name: string;
  periodType: BudgetPeriod;
  startDate: string;
  endDate: string;
  hotelId?: string;
}

export interface CreateBudgetLineInput {
  type: FinancialCategoryType;
  plannedAmount: number;
  departmentId?: string;
  activityId?: string;
  costCenterId?: string;
  categoryId?: string;
}

export function listBudgets(): Promise<Budget[]> {
  return apiClient.get<Budget[]>("/budgets");
}

export function getBudget(id: string): Promise<BudgetDetail> {
  return apiClient.get<BudgetDetail>(`/budgets/${id}`);
}

export function createBudget(input: CreateBudgetInput): Promise<Budget> {
  return apiClient.post<Budget>("/budgets", input);
}

export function addBudgetLine(budgetId: string, input: CreateBudgetLineInput): Promise<BudgetLine> {
  return apiClient.post<BudgetLine>(`/budgets/${budgetId}/lines`, input);
}

export function getBudgetExecution(id: string): Promise<BudgetExecution> {
  return apiClient.get<BudgetExecution>(`/budgets/${id}/execution`);
}

export function checkBudgetOverspend(id: string): Promise<{ overspentLineCount: number; notificationsCreated: number }> {
  return apiClient.post<{ overspentLineCount: number; notificationsCreated: number }>(`/budgets/${id}/check-overspend`);
}
