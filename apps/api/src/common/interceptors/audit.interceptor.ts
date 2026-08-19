import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from "@nestjs/common";
import type { Request } from "express";
import { tap, type Observable } from "rxjs";

import { PrismaService } from "../../database/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { AuthenticatedUser } from "../types/authenticated-request";

const AUDITED_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

// Correspondance resourceType (2e segment d'URL, ex. "cash-accounts") -> accesseur Prisma Client
// (ex. prisma.cashAccount) — sert uniquement au snapshot "before" générique sur toute route
// mutante portant un :id (update classique PATCH, mais aussi les transitions POST /:id/approve
// etc. — voir toAction()). Limitée aux ressources qui ont réellement un endpoint de modification/
// transition ; une ressource absente de cette table obtient simplement before=null, jamais une
// erreur (voir schema.prisma, modèle AuditLog, pour la sémantique "lorsque pertinent").
const RESOURCE_MODEL_MAP: Record<string, string> = {
  activities: "departmentActivity",
  assets: "asset",
  "financial-categories": "financialCategory",
  "leave-requests": "leaveRequest",
  budgets: "budget",
  invoices: "invoice",
  guests: "guest",
  rooms: "room",
  payslips: "payslip",
  "work-schedules": "workSchedule",
  "maintenance-requests": "maintenanceRequest",
  "maintenance-interventions": "maintenanceIntervention",
  hotels: "hotel",
  "purchase-requests": "purchaseRequest",
  products: "product",
  "room-types": "roomType",
  "purchase-orders": "purchaseOrder",
  warehouses: "warehouse",
  reservations: "reservation",
  suppliers: "supplier",
  "bank-accounts": "bankAccount",
  "cash-accounts": "cashAccount",
  departments: "department",
  employees: "employee",
  "cost-centers": "costCenter",
  expenses: "expense",
};

// Le nom de la méthode du controller reflète déjà l'action métier dans toute la base (create,
// update, approve, reject, submit, markPaid, book, issue, cancel, clean, inspect, finalize, start,
// complete, confirm...) — plus fiable qu'analyser l'URL, et nécessite aucune modification des ~40
// controllers. camelCase -> kebab-case (markPaid -> mark-paid) pour rester cohérent avec le
// vocabulaire des routes elles-mêmes.
function toAction(handlerName: string, method: string): string {
  const kebab = handlerName.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
  if (kebab && kebab !== "find-one" && kebab !== "list" && kebab !== "remove") return kebab;
  if (kebab === "remove") return "delete";
  return method === "POST" ? "create" : method === "DELETE" ? "delete" : "update";
}

type PrismaFindUnique = { findUnique: (args: { where: { id: string } }) => Promise<unknown> };

// Audit trail global (§37, durci Étape 7) — seules les requêtes mutantes sont journalisées.
// /auth/login et /auth/logout sont exclus ici : l'acteur n'est pas connu à ce stade pour login
// (pas encore authentifié) et logout est @Public() (pas de JwtAuthGuard) — AuthService écrit ses
// propres entrées d'audit correctement actorées pour ces deux cas (voir auth.service.ts). Écriture
// toujours best-effort, ne bloque jamais la réponse réelle.
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<
      Request & { user?: AuthenticatedUser; auditHandled?: boolean }
    >();
    if (!AUDITED_METHODS.has(request.method)) {
      return next.handle();
    }

    const segments = request.path.split("/").filter(Boolean);
    const resourceType = segments[2] ?? null;
    if (resourceType === "auth") {
      return next.handle();
    }
    request.auditHandled = true;

    const resourceId = (request.params as Record<string, string> | undefined)?.id ?? null;
    const action = toAction(context.getHandler().name, request.method);

    // resourceId n'existe que sur les routes portant un :id (update/delete ET transitions type
    // POST /:id/approve — la plupart des transitions de ce projet sont des POST, pas des PATCH,
    // voir le vocabulaire des controllers). Un simple POST de création (pas de :id) n'a jamais de
    // "before" — rien n'existait avant — donc resourceId reste naturellement null pour ce cas.
    let before: unknown = null;
    if (resourceId && resourceType) {
      const modelName = RESOURCE_MODEL_MAP[resourceType];
      const model = modelName ? (this.prisma as unknown as Record<string, PrismaFindUnique>)[modelName] : undefined;
      if (model) {
        before = await model.findUnique({ where: { id: resourceId } }).catch(() => null);
      }
    }

    const write = (outcome: "SUCCESS" | "FAILURE", after: unknown, errorMessage?: string) => {
      const afterObj = after && typeof after === "object" ? (after as Record<string, unknown>) : null;
      const beforeObj = before && typeof before === "object" ? (before as Record<string, unknown>) : null;
      const departmentId =
        (afterObj?.departmentId as string | undefined) ?? (beforeObj?.departmentId as string | undefined) ?? null;
      const finalResourceId = resourceId ?? (afterObj?.id as string | undefined) ?? null;

      this.auditService.record({
        organizationId: request.user?.organizationId ?? null,
        hotelId: request.user?.hotelId ?? null,
        departmentId,
        userId: request.user?.id ?? null,
        method: request.method,
        path: request.path,
        resourceType,
        resourceId: finalResourceId,
        action,
        outcome,
        errorMessage,
        ipAddress: request.ip,
        before: beforeObj ?? undefined,
        after: outcome === "SUCCESS" ? (afterObj ?? undefined) : undefined,
      });
    };

    return next.handle().pipe(
      tap({
        next: (responseBody) => write("SUCCESS", responseBody),
        error: (error: unknown) => write("FAILURE", null, error instanceof Error ? error.message.slice(0, 500) : String(error)),
      })
    );
  }
}
