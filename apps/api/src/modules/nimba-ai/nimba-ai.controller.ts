import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { AiChatService } from "./chat/ai-chat.service";
import { AiChatQueryDto } from "./dto/ai-chat-query.dto";
import { AiMonthQueryDto } from "./dto/ai-month-query.dto";
import { AiPeriodQueryDto } from "./dto/ai-period-query.dto";
import { AiOrchestratorService } from "./orchestrator/ai-orchestrator.service";

// Nimba AI (Étape 7 — premier contrôleur HTTP). @RequirePermissions("nimba-ai.use") est la porte
// d'entrée grossière (la fonctionnalité existe-t-elle pour ce demandeur) ; le contrôle fin par
// donnée (finance-summary.view, payslips.view, ...) est appliqué plus profond, dans
// AiOrchestratorService.invokeTool() → AiToolRegistry.invoke() — jamais dans ce contrôleur.
// Pas de nimba-ai.service.ts intermédiaire : le contrôleur appelle directement l'orchestrateur,
// une couche de délégation supplémentaire n'aurait ajouté aucune logique (voir plan
// d'architecture Nimba AI pour la structure de fichiers envisagée à l'origine).
@Controller("nimba-ai")
export class NimbaAiController {
  constructor(
    private readonly orchestrator: AiOrchestratorService,
    private readonly chatService: AiChatService
  ) {}

  @Get("insights/finance")
  @RequirePermissions("nimba-ai.use")
  getFinanceInsights(@Query() query: AiMonthQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.orchestrator.invokeTool("finance-summary", query, user);
  }

  @Get("insights/department")
  @RequirePermissions("nimba-ai.use")
  getDepartmentInsights(@Query() query: AiPeriodQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.orchestrator.invokeTool("department-comparison", query, user);
  }

  @Get("insights/hospitality")
  @RequirePermissions("nimba-ai.use")
  getHospitalityInsights(@Query() query: AiPeriodQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.orchestrator.invokeTool("occupancy-summary", query, user);
  }

  @Get("insights/hr-workforce")
  @RequirePermissions("nimba-ai.use")
  getHrWorkforceInsights(@Query() query: AiPeriodQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.orchestrator.invokeTool("hr-workforce-summary", query, user);
  }

  @Get("insights/hr-payroll")
  @RequirePermissions("nimba-ai.use")
  getHrPayrollInsights(@Query() query: AiPeriodQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.orchestrator.invokeTool("hr-payroll-summary", query, user);
  }

  // requiredPermissions du Tool est vide par design (voir anomaly-detection.tool.ts) — la porte
  // d'entrée ici reste nimba-ai.use, le filtrage réel est fait par détecteur/permission plus
  // profond dans AnomalyDetectionService.
  @Get("anomalies")
  @RequirePermissions("nimba-ai.use")
  getAnomalies(@Query() query: AiPeriodQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.orchestrator.invokeTool("anomaly-scan", query, user);
  }

  // conversationId généré côté serveur si absent : v1 sans état (StatelessConversationProvider) —
  // ne sert qu'à étiqueter les messages de CE tour, aucune valeur envoyée par le client n'est
  // jamais utilisée pour retrouver une conversation stockée ailleurs.
  @Post("chat")
  @RequirePermissions("nimba-ai.use")
  chat(@Body() body: AiChatQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.chatService.chat(body.message, body.conversationId ?? randomUUID(), body.history, user);
  }
}
