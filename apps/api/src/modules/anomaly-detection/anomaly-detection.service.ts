import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";

// Nimba AI (Étape 1 — squelette d'architecture). Orchestrera à l'Étape 8 du plan Nimba AI une
// liste de AnomalyDetector (un par source : budget, dépense, trésorerie, stock, RH, audit trail),
// chacun fondé sur des règles/seuils/moyennes glissantes — aucun ML dans cette version, interface
// pensée pour en accueillir un plus tard sans modifier ce service. Suit le gabarit déjà établi par
// BudgetsService.checkOverspendAlerts()/ProductsService.checkLowStock() : à la demande, aucun
// scheduler dans ce projet. Autonome, en dehors du module nimba-ai.
@Injectable()
export class AnomalyDetectionService {
  constructor(private readonly prisma: PrismaService) {}
}
