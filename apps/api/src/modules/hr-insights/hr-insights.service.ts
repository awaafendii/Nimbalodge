import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";

// Nimba AI (Étape 1 — squelette d'architecture). Calculs neufs (effectifs, absentéisme, congés,
// masse salariale et son évolution) branchés à l'Étape 7 du plan Nimba AI — toujours des agrégats,
// jamais de données individuelles (nom/email/matricule) au-delà de ce qui existe déjà côté
// EmployeesService pour la gestion RH elle-même. Autonome, en dehors du module nimba-ai.
@Injectable()
export class HrInsightsService {
  constructor(private readonly prisma: PrismaService) {}
}
