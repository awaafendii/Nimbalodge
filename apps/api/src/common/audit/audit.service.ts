import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../../database/prisma.service";

// Étape 7 (durcissement Audit Trail) — point d'écriture unique pour AuditLog, partagé par
// AuditInterceptor (couverture générique de toute requête mutante), AuthService (login/logout,
// jamais couverts par l'interceptor générique — voir AuditInterceptor, qui les exclut explicitement
// pour éviter un doublon) et AuthzAuditFilter (rejets 401/403, qui n'atteignent jamais un
// interceptor dans le cycle de vie Nest). Écriture toujours best-effort (.catch) : un échec du
// journal d'audit ne doit jamais faire échouer la requête réelle qu'il journalise.
const SENSITIVE_KEY_PATTERN = /password|token|secret/i;

// JSON.stringify/parse d'abord : les entités Prisma portent des instances Date et Decimal
// (`toJSON()` propre à chacune — ISO string / string décimale), pas des littéraux JSON. Sans ce
// passage, un avant/après avec un champ Date ou Decimal se sérialise en `{}` vide dans la colonne
// JSONB (constaté en direct : `endDate: {}` au lieu de l'ISO string). sanitizeAuditValue() ne fait
// donc plus que le filtrage des clés sensibles, sur une valeur déjà JSON-safe.
export function sanitizeAuditValue(value: unknown): unknown {
  const jsonSafe = JSON.parse(JSON.stringify(value)) as unknown;
  return redactSensitiveKeys(jsonSafe);
}

function redactSensitiveKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSensitiveKeys);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY_PATTERN.test(key) ? "[redacted]" : redactSensitiveKeys(val);
    }
    return out;
  }
  return value;
}

export interface AuditEntry {
  organizationId?: string | null;
  hotelId?: string | null;
  departmentId?: string | null;
  userId?: string | null;
  method: string;
  path: string;
  resourceType?: string | null;
  resourceId?: string | null;
  action: string;
  outcome: "SUCCESS" | "FAILURE";
  errorMessage?: string;
  ipAddress?: string | null;
  before?: unknown;
  after?: unknown;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  record(entry: AuditEntry): void {
    const before = entry.before ? sanitizeAuditValue(entry.before) : undefined;
    const after = entry.after ? sanitizeAuditValue(entry.after) : undefined;

    this.prisma.auditLog
      .create({
        data: {
          organizationId: entry.organizationId ?? null,
          hotelId: entry.hotelId ?? null,
          departmentId: entry.departmentId ?? null,
          userId: entry.userId ?? null,
          method: entry.method,
          path: entry.path,
          resourceType: entry.resourceType ?? null,
          resourceId: entry.resourceId ?? null,
          action: entry.action,
          outcome: entry.outcome,
          errorMessage: entry.errorMessage,
          ipAddress: entry.ipAddress ?? null,
          before: before as Prisma.InputJsonValue | undefined,
          after: after as Prisma.InputJsonValue | undefined,
        },
      })
      .catch(() => undefined);
  }
}
