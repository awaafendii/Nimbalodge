import { apiClient } from "./api-client.js";

// Montants sérialisés en chaîne par l'API (Decimal.toJSON()), occupancyRate reste un number|null
// (jamais 0 par défaut — null quand la période n'a aucune chambre active, voir
// HospitalityInsightsService côté backend). Miroir exact de OccupancyPeriodResult.
export interface OccupancyPeriodSummary {
  availableRooms: number;
  availableRoomNights: number;
  occupiedRoomNights: number;
  occupancyRate: number | null;
  totalRoomRevenue: string;
  adr: string | null;
  revpar: string | null;
}

export interface HospitalityOccupancySummary {
  period: { dateFrom: string; dateTo: string };
  current: OccupancyPeriodSummary;
  previous: OccupancyPeriodSummary;
}

export interface HospitalityInsightsParams {
  dateFrom?: string;
  dateTo?: string;
}

export function getOccupancySummary(params?: HospitalityInsightsParams): Promise<HospitalityOccupancySummary> {
  const query = new URLSearchParams();
  if (params?.dateFrom) query.set("dateFrom", params.dateFrom);
  if (params?.dateTo) query.set("dateTo", params.dateTo);
  const qs = query.toString();
  return apiClient.get<HospitalityOccupancySummary>(`/hospitality-insights/occupancy${qs ? `?${qs}` : ""}`);
}
