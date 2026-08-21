import { Controller, Get, Query } from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { HospitalityInsightsQueryDto } from "./dto/hospitality-insights-query.dto";
import { HospitalityInsightsService } from "./hospitality-insights.service";

// Endpoint REST direct — le service existait déjà (Nimba AI Étape 7, Tool "occupancy-summary")
// mais n'était accessible qu'à travers /nimba-ai/insights/hospitality, gardé par nimba-ai.use.
// L'occupation est un KPI hôtelier de base (tableau de bord général), pas une fonctionnalité IA :
// un rôle avec reservations.view mais sans nimba-ai.use (ex. RECEPTIONNISTE) doit pouvoir le voir
// sans dépendre de Nimba AI. Même permission que le Tool (reservations.view) — même calcul, aucune
// logique dupliquée.
@Controller("hospitality-insights")
export class HospitalityInsightsController {
  constructor(private readonly hospitalityInsightsService: HospitalityInsightsService) {}

  @Get("occupancy")
  @RequirePermissions("reservations.view")
  getOccupancy(@Query() query: HospitalityInsightsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.hospitalityInsightsService.getOccupancySummary(query, user);
  }
}
