import { Injectable } from "@nestjs/common";
import type { ReservationStatus } from "@prisma/client";

import type { HospitalityInsightsRaw, OccupancyPeriodResult } from "../../hospitality-insights/hospitality-insights.service";
import type { DataMinimizer } from "./data-minimizer.interface";

export interface OccupancyPeriodMinimized {
  availableRooms: number;
  availableRoomNights: number;
  occupiedRoomNights: number;
  occupancyRatePercent: number | null;
  totalRoomRevenue: string;
  adr: string | null;
  revpar: string | null;
}

export interface HospitalityInsightsMinimized {
  period: { from: string; to: string };
  current: OccupancyPeriodMinimized;
  previous: OccupancyPeriodMinimized;
  reservationsByStatus: Partial<Record<ReservationStatus, number>>;
}

// Déjà entièrement agrégé au niveau hôtel (aucune réservation/chambre individuelle exposée) —
// minimisation = conversion Decimal → string + taux en pourcentage lisible (ex. 0.5 → 50), jamais
// un flottant brut ambigu.
@Injectable()
export class HospitalityInsightsMinimizer implements DataMinimizer<HospitalityInsightsRaw, HospitalityInsightsMinimized> {
  minimize(raw: HospitalityInsightsRaw): HospitalityInsightsMinimized {
    return {
      period: { from: raw.period.dateFrom.toISOString(), to: raw.period.dateTo.toISOString() },
      current: this.minimizePeriod(raw.current),
      previous: this.minimizePeriod(raw.previous),
      reservationsByStatus: raw.reservationsByStatus,
    };
  }

  private minimizePeriod(period: OccupancyPeriodResult): OccupancyPeriodMinimized {
    return {
      availableRooms: period.availableRooms,
      availableRoomNights: period.availableRoomNights,
      occupiedRoomNights: period.occupiedRoomNights,
      occupancyRatePercent: period.occupancyRate === null ? null : Math.round(period.occupancyRate * 1000) / 10,
      totalRoomRevenue: period.totalRoomRevenue.toString(),
      adr: period.adr?.toString() ?? null,
      revpar: period.revpar?.toString() ?? null,
    };
  }
}
