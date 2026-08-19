import { Controller, Get, HttpCode, HttpStatus, ServiceUnavailableException } from "@nestjs/common";

import { Public } from "../../common/decorators/public.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { MetricsService } from "../../common/monitoring/metrics.service";
import { HealthService } from "./health.service";

@Controller("health")
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly metrics: MetricsService
  ) {}

  // @Public() : le healthcheck Docker/monitoring (contrat Phase 2, render.yaml healthCheckPath)
  // doit rester accessible sans JWT une fois les guards globaux d'auth posés par AuthModule.
  // Conservé en alias de /health/ready (même comportement qu'avant Étape 7) pour ne rien casser
  // côté déploiement existant.
  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  async check() {
    return this.readiness();
  }

  // Liveness : "le process répond-il ?", sans dépendance externe (DB). Une base de données
  // temporairement indisponible ne doit jamais faire redémarrer un process API qui, lui,
  // fonctionne correctement — distinction standard Kubernetes/Render liveness vs readiness.
  @Public()
  @Get("live")
  @HttpCode(HttpStatus.OK)
  live() {
    return { status: "ok", uptimeSeconds: Math.floor(process.uptime()), timestamp: new Date().toISOString() };
  }

  // Readiness : "le process peut-il servir du trafic ?" — vérifie les dépendances critiques (DB).
  @Public()
  @Get("ready")
  @HttpCode(HttpStatus.OK)
  async ready() {
    return this.readiness();
  }

  private async readiness() {
    const result = await this.healthService.check();
    if (result.status === "error") {
      throw new ServiceUnavailableException(result);
    }
    return result;
  }

  // Non public : expose volumétrie/latence/mémoire du process, une donnée opérationnelle
  // plateforme (voir le commentaire sur system-monitoring.view dans permissions-catalog.ts).
  @Get("metrics")
  @RequirePermissions("system-monitoring.view")
  metricsSnapshot() {
    return this.metrics.snapshot();
  }
}
