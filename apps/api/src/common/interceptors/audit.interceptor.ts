import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from "@nestjs/common";
import type { Request } from "express";
import { tap, type Observable } from "rxjs";

import { PrismaService } from "../../database/prisma.service";
import type { AuthenticatedUser } from "../types/authenticated-request";

const AUDITED_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

// Audit trail global (§37) — annoncé dès la Phase 2 ("un interceptor d'audit qu'à partir de la
// Phase 12"). Seules les requêtes mutantes sont journalisées (voir schema.prisma, modèle AuditLog,
// pour le détail des choix : pas de code HTTP exact, pas de corps de requête, écriture best-effort
// qui ne bloque jamais la réponse réelle).
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    if (!AUDITED_METHODS.has(request.method)) {
      return next.handle();
    }

    // /api/v1/<resourceType>/... — heuristique simple, suffisante pour filtrer par ressource.
    const resourceType = request.path.split("/").filter(Boolean)[2] ?? null;

    const write = (outcome: "SUCCESS" | "FAILURE", errorMessage?: string) => {
      this.prisma.auditLog
        .create({
          data: {
            organizationId: request.user?.organizationId ?? null,
            hotelId: request.user?.hotelId ?? null,
            userId: request.user?.id ?? null,
            method: request.method,
            path: request.path,
            resourceType,
            outcome,
            errorMessage,
            ipAddress: request.ip,
          },
        })
        .catch(() => undefined);
    };

    return next.handle().pipe(
      tap({
        next: () => write("SUCCESS"),
        error: (error: unknown) => write("FAILURE", error instanceof Error ? error.message.slice(0, 500) : String(error)),
      })
    );
  }
}
