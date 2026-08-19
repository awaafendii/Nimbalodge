import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";

// Nimba AI (Étape 1 — squelette d'architecture). Calculs neufs (occupation, ADR, RevPAR,
// annulations, tendances) branchés à l'Étape 7 du plan Nimba AI — aucune agrégation hôtelière
// n'existe ailleurs dans le projet (confirmé par recherche préalable). Autonome, en dehors du
// module nimba-ai, pour rester réutilisable par un futur écran Rapports sans dépendre de l'IA.
@Injectable()
export class HospitalityInsightsService {
  constructor(private readonly prisma: PrismaService) {}
}
