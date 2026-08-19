import { Catch, ForbiddenException, UnauthorizedException, type ArgumentsHost, type ExceptionFilter } from "@nestjs/common";
import type { Request, Response } from "express";

import type { AuthenticatedUser } from "../types/authenticated-request";
import { AuditService } from "./audit.service";

// Étape 7 (durcissement Audit Trail) — capture les rejets d'autorisation (401/403) qui
// n'atteignent JAMAIS AuditInterceptor : les Guards (JwtAuthGuard, PermissionsGuard) s'exécutent
// AVANT les interceptors dans le cycle de vie Nest, donc un accès refusé au niveau Guard ne passe
// jamais par next.handle(). ForbiddenException est aussi levée depuis l'intérieur des handlers
// (assertInScope/assertInDepartmentScope) — ces cas-là SONT déjà couverts par AuditInterceptor (le
// flux d'erreur y traverse tap({error}) normalement) ; pour éviter un doublon, AuditInterceptor
// marque la requête (request.auditHandled) dès qu'il la traite, et ce filtre n'écrit que pour les
// requêtes qu'il n'a jamais vues — donc uniquement les vrais rejets de Guard.
@Catch(ForbiddenException, UnauthorizedException)
export class AuthzAuditFilter implements ExceptionFilter {
  constructor(private readonly auditService: AuditService) {}

  catch(exception: ForbiddenException | UnauthorizedException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request & { user?: AuthenticatedUser; auditHandled?: boolean }>();
    const response = ctx.getResponse<Response>();

    if (!request.auditHandled) {
      const segments = request.path.split("/").filter(Boolean);
      this.auditService.record({
        organizationId: request.user?.organizationId ?? null,
        hotelId: request.user?.hotelId ?? null,
        userId: request.user?.id ?? null,
        method: request.method,
        path: request.path,
        resourceType: segments[2] ?? null,
        resourceId: (request.params as Record<string, string> | undefined)?.id ?? null,
        action: "access-denied",
        outcome: "FAILURE",
        errorMessage: exception.message,
        ipAddress: request.ip,
      });
    }

    response.status(exception.getStatus()).json(exception.getResponse());
  }
}
