import { Global, Module } from "@nestjs/common";

import { MetricsMiddleware } from "./metrics.middleware";
import { MetricsService } from "./metrics.service";

// @Global() : MetricsMiddleware est appliqué à toutes les routes depuis AppModule.configure(), et
// HealthController (dans un autre module) a besoin d'injecter MetricsService pour /health/metrics —
// même raisonnement que AuditModule/AppLoggingModule.
@Global()
@Module({
  providers: [MetricsService, MetricsMiddleware],
  exports: [MetricsService, MetricsMiddleware],
})
export class MonitoringModule {}
