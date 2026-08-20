import { Injectable } from "@nestjs/common";
import type { LeaveStatus } from "@prisma/client";

import type { WorkforceSummaryRaw } from "../../hr-insights/hr-insights.service";
import type { DataMinimizer } from "./data-minimizer.interface";

export interface WorkforceSummaryMinimized {
  period: { from: string; to: string };
  headcount: number;
  scheduledShifts: number;
  attendedShifts: number;
  absenteeismRatePercent: number | null;
  leaveRequestsByStatus: Partial<Record<LeaveStatus, number>>;
}

// Déjà entièrement agrégé (aucun nom/email/matricule d'employé) — minimisation = formatage du taux
// en pourcentage lisible. Aucune donnée personnelle n'a jamais transité par ce chemin : le service
// sous-jacent ne sélectionne que employeeId (jamais réutilisé au-delà du calcul) et des compteurs.
@Injectable()
export class HrWorkforceMinimizer implements DataMinimizer<WorkforceSummaryRaw, WorkforceSummaryMinimized> {
  minimize(raw: WorkforceSummaryRaw): WorkforceSummaryMinimized {
    return {
      period: { from: raw.period.dateFrom.toISOString(), to: raw.period.dateTo.toISOString() },
      headcount: raw.headcount,
      scheduledShifts: raw.scheduledShifts,
      attendedShifts: raw.attendedShifts,
      absenteeismRatePercent: raw.absenteeismRate === null ? null : Math.round(raw.absenteeismRate * 1000) / 10,
      leaveRequestsByStatus: raw.leaveRequestsByStatus,
    };
  }
}
