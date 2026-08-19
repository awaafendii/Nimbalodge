import { Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

import { MetricsService } from "./metrics.service";

// Middleware Express (pas un interceptor Nest) : s'exécute avant les guards, donc capture aussi
// les requêtes rejetées par PermissionsGuard/JwtAuthGuard (401/403), contrairement à un
// APP_INTERCEPTOR qui ne verrait jamais ces requêtes rejetées en amont.
@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metrics: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();
    res.on("finish", () => {
      this.metrics.record(res.statusCode, Date.now() - start);
    });
    next();
  }
}
