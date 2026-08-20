import { Injectable } from "@nestjs/common";

import { AuditLogsService } from "../../audit-logs/audit-logs.service";
import type { AuthenticatedUser } from "../../../common/types/authenticated-request";
import type { Anomaly } from "../anomaly";
import type { AnomalyDetector } from "./anomaly-detector.interface";
import { severityForRatio } from "./severity";

// Rafale d'échecs (connexions refusées, accès refusés) par utilisateur ou par IP sur la période.
// Réutilise AuditLogsService.countFailuresByActor() — aucune donnée n'est jamais recalculée ici,
// seuls des seuils absolus sont appliqués aux compteurs déjà agrégés par le service.
const USER_FAILURE_THRESHOLD = 5;
const IP_FAILURE_THRESHOLD = 10;

@Injectable()
export class AuditTrailAnomalyDetector implements AnomalyDetector {
  readonly source = "audit-trail-anomaly";
  readonly requiredPermission = "audit-logs.view";

  constructor(private readonly auditLogsService: AuditLogsService) {}

  async detect(requester: AuthenticatedUser, dateFrom: Date, dateTo: Date): Promise<Anomaly[]> {
    const { byUser, byIp } = await this.auditLogsService.countFailuresByActor(dateFrom, dateTo, requester);
    const period = { from: dateFrom.toISOString(), to: dateTo.toISOString() };
    const anomalies: Anomaly[] = [];

    for (const entry of byUser) {
      if (entry.count < USER_FAILURE_THRESHOLD) continue;
      const ratio = (entry.count - USER_FAILURE_THRESHOLD) / USER_FAILURE_THRESHOLD;
      anomalies.push({
        severity: severityForRatio(ratio),
        indicator: "Audit Trail — échecs répétés (utilisateur)",
        period,
        observedValue: `${entry.count} échec(s)`,
        referenceValue: `${USER_FAILURE_THRESHOLD} échec(s)`,
        explanation: `${entry.count} tentatives en échec (accès refusé, action refusée...) ont été enregistrées pour un même utilisateur sur la période, au-delà du seuil habituel de ${USER_FAILURE_THRESHOLD}.`,
        recommendation: "Vérifier s'il s'agit d'une tentative d'accès non autorisée.",
        resourceType: "user",
        resourceId: entry.userId,
      });
    }

    for (const entry of byIp) {
      if (entry.count < IP_FAILURE_THRESHOLD) continue;
      const ratio = (entry.count - IP_FAILURE_THRESHOLD) / IP_FAILURE_THRESHOLD;
      anomalies.push({
        severity: severityForRatio(ratio),
        indicator: "Audit Trail — échecs répétés (adresse IP)",
        period,
        observedValue: `${entry.count} échec(s)`,
        referenceValue: `${IP_FAILURE_THRESHOLD} échec(s)`,
        explanation: `${entry.count} tentatives en échec ont été enregistrées depuis une même adresse IP sur la période, au-delà du seuil habituel de ${IP_FAILURE_THRESHOLD}.`,
        recommendation: "Vérifier s'il s'agit d'une tentative d'intrusion (force brute, scan d'accès...).",
        resourceType: "ip-address",
        resourceId: entry.ipAddress,
      });
    }

    return anomalies;
  }
}
