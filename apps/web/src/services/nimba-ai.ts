import { apiClient } from "./api-client.js";

// Formes miroir des DTO backend (apps/api/src/modules/nimba-ai) -- voir
// AiResponseEnvelope<TData>, HospitalityInsightsMinimized, WorkforceSummaryMinimized,
// PayrollSummaryMinimized, DepartmentComparisonMinimized, FinanceSummaryMinimized.

export interface Provenance {
  module: string;
  period?: { from: string; to: string };
  filters?: Record<string, string>;
}

export interface AiResponseEnvelope<TData> {
  data: TData;
  provenance: Provenance[];
  answer?: string;
  disclaimer?: string;
}

export interface FinanceInsightsData {
  period: { year: number; month: number };
  totalRevenue: string;
  totalExpense: string;
  cashBalance: string;
  bankBalance: string;
}

export interface DepartmentComparisonRow {
  departmentId: string;
  label: string;
  totalRevenue: string;
  totalExpense: string;
  net: string;
}

export interface DepartmentInsightsData {
  period: { from: string; to: string };
  rows: DepartmentComparisonRow[];
  totals: { totalRevenue: string; totalExpense: string; net: string };
}

export interface OccupancyPeriod {
  availableRooms: number;
  availableRoomNights: number;
  occupiedRoomNights: number;
  occupancyRatePercent: number | null;
  totalRoomRevenue: string;
  adr: string | null;
  revpar: string | null;
}

export interface HospitalityInsightsData {
  period: { from: string; to: string };
  current: OccupancyPeriod;
  previous: OccupancyPeriod;
  reservationsByStatus: Record<string, number>;
}

export interface HrWorkforceData {
  period: { from: string; to: string };
  headcount: number;
  scheduledShifts: number;
  attendedShifts: number;
  absenteeismRatePercent: number | null;
  leaveRequestsByStatus: Record<string, number>;
}

export interface HrPayrollPeriod {
  year: number;
  month: number;
  totalNetPay: string;
  payslipCount: number;
}

export interface HrPayrollData {
  current: HrPayrollPeriod;
  previous: HrPayrollPeriod;
}

export type AnomalySeverity = "low" | "medium" | "high" | "critical";

export interface Anomaly {
  severity: AnomalySeverity;
  indicator: string;
  period: { from: string; to: string };
  observedValue: string;
  referenceValue: string;
  explanation: string;
  recommendation?: string;
  resourceType?: string;
  resourceId?: string;
}

export interface AnomalyScanData {
  period: { from: string; to: string };
  anomalies: Anomaly[];
}

export interface AiPeriodFilters {
  dateFrom?: string;
  dateTo?: string;
}

export interface AiMonthFilters {
  month?: number;
  year?: number;
}

function buildQuery(filters: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function getFinanceInsights(filters: AiMonthFilters = {}): Promise<AiResponseEnvelope<FinanceInsightsData>> {
  return apiClient.get(`/nimba-ai/insights/finance${buildQuery(filters)}`);
}

export function getDepartmentInsights(filters: AiPeriodFilters = {}): Promise<AiResponseEnvelope<DepartmentInsightsData>> {
  return apiClient.get(`/nimba-ai/insights/department${buildQuery(filters)}`);
}

export function getHospitalityInsights(filters: AiPeriodFilters = {}): Promise<AiResponseEnvelope<HospitalityInsightsData>> {
  return apiClient.get(`/nimba-ai/insights/hospitality${buildQuery(filters)}`);
}

export function getHrWorkforceInsights(filters: AiPeriodFilters = {}): Promise<AiResponseEnvelope<HrWorkforceData>> {
  return apiClient.get(`/nimba-ai/insights/hr-workforce${buildQuery(filters)}`);
}

export function getHrPayrollInsights(filters: AiPeriodFilters = {}): Promise<AiResponseEnvelope<HrPayrollData>> {
  return apiClient.get(`/nimba-ai/insights/hr-payroll${buildQuery(filters)}`);
}

export function getAnomalies(filters: AiPeriodFilters = {}): Promise<AiResponseEnvelope<AnomalyScanData>> {
  return apiClient.get(`/nimba-ai/anomalies${buildQuery(filters)}`);
}

// Étape 9 — Assistant conversationnel. Miroir de LLMMessage (backend) : v1 sans état, l'historique
// complet est renvoyé par le frontend à chaque tour (voir StatelessConversationProvider).
export type ChatMessageRole = "user" | "assistant" | "system" | "tool";

export interface ChatMessage {
  role: ChatMessageRole;
  content: string;
  name?: string;
  toolCallId?: string;
}

export interface ChatToolResult {
  tool: string;
  data: unknown;
}

// Pas d'enveloppe AiResponseEnvelope ici : contrairement aux Insights/Anomalies (un seul Tool,
// une seule `data`), une réponse de chat peut agréger plusieurs Tools différents — voir
// `toolResults`, un élément par Tool réellement invoqué pendant ce tour.
export interface ChatResponse {
  answer?: string;
  provenance: Provenance[];
  toolResults: ChatToolResult[];
  disclaimer?: string;
}

export function postChat(message: string, conversationId: string, history: ChatMessage[]): Promise<ChatResponse> {
  return apiClient.post("/nimba-ai/chat", { message, conversationId, history });
}
