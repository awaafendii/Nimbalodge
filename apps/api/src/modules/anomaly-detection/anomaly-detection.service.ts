import { Inject, Injectable, Optional } from "@nestjs/common";

import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import type { Anomaly } from "./anomaly";
import { ANOMALY_DETECTORS, type AnomalyDetector } from "./detectors/anomaly-detector.interface";

// Nimba AI (Étape 8) — dispatch permission-filtré : chaque détecteur ne tourne QUE si sa
// `requiredPermission` figure dans le set déjà résolu par AiOrchestratorService.resolveContext()
// (mêmes principes que AiToolRegistry, mais appliqués par détecteur plutôt que par Tool entier,
// car un seul scan logique couvre plusieurs domaines de permission différents). Résilience
// per-détecteur : l'échec d'une source (ex. erreur Prisma sur un domaine) ne doit jamais empêcher
// les autres détecteurs de répondre.
@Injectable()
export class AnomalyDetectionService {
  constructor(@Optional() @Inject(ANOMALY_DETECTORS) private readonly detectors: AnomalyDetector[] = []) {}

  async detectAnomalies(
    requester: AuthenticatedUser,
    permissions: Set<string>,
    dateFrom: Date,
    dateTo: Date
  ): Promise<Anomaly[]> {
    const applicableDetectors = this.detectors.filter((detector) => permissions.has(detector.requiredPermission));

    const results = await Promise.all(
      applicableDetectors.map((detector) =>
        detector.detect(requester, dateFrom, dateTo).catch(() => [] as Anomaly[])
      )
    );

    return results.flat();
  }
}
