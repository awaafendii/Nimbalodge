import type { AuthenticatedUser } from "../../../common/types/authenticated-request";
import type { Anomaly } from "../anomaly";

// Nimba AI (Étape 8) — un détecteur par source de données, fondé en v1 sur des règles/seuils/
// moyennes glissantes/écarts relatifs uniquement (AUCUN ML dans cette version — voir plan
// d'architecture Nimba AI). Cette interface permet d'ajouter plus tard un détecteur statistique ou
// de forecasting sans toucher AnomalyDetectionService ni les autres détecteurs — même logique de
// pluggabilité que LLMProvider/StorageProvider.
//
// `requiredPermission` est TOUJOURS la permission réelle qui gate déjà l'équivalent REST (jamais
// une permission IA synthétique) — AnomalyDetectionService ne fait tourner un détecteur que si le
// demandeur possède sa permission, exactement le même principe que les Tools d'Insights (Étape 7).
export interface AnomalyDetector {
  readonly source: string;
  readonly requiredPermission: string;
  detect(requester: AuthenticatedUser, dateFrom: Date, dateTo: Date): Promise<Anomaly[]>;
}

export const ANOMALY_DETECTORS = "ANOMALY_DETECTORS";
