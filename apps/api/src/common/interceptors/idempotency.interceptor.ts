import { HTTP_CODE_METADATA } from "@nestjs/common/constants";
import { HttpStatus, Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Prisma } from "@prisma/client";
import type { Request, Response } from "express";
import { of, tap, type Observable } from "rxjs";

import { PrismaService } from "../../database/prisma.service";
import type { AuthenticatedUser } from "../types/authenticated-request";

const IDEMPOTENT_METHODS = new Set(["POST", "PATCH"]);

// Étape 6 (Offline) — rejeu sans effet de bord des mutations synchronisées après une période hors
// ligne. Strictement opt-in via l'en-tête `Idempotency-Key` : absent chez tout client existant
// (web actuel, apps mobiles futures qui ne l'implémentent pas), donc AUCUN changement de
// comportement pour quiconque ne l'envoie pas — même principe d'innocuité que le reste du volet
// Offline. Clé composite (userId, key) : voir le commentaire du modèle Prisma IdempotencyKey pour
// le raisonnement (jamais renvoyer la réponse d'un autre utilisateur).
//
// Le statut HTTP à rejouer est déterminé via les métadonnées @HttpCode() du handler (comme Nest le
// fait lui-même en interne), pas en lisant response.statusCode dans le tap() — AuditInterceptor
// documente déjà pourquoi cette lecture est fragile (la réponse n'est pas encore finalisée à ce
// stade du cycle de vie Nest) ; ce fichier applique la même prudence.
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const key = request.header("Idempotency-Key");

    if (!key || !IDEMPOTENT_METHODS.has(request.method) || !request.user) {
      return next.handle();
    }

    const userId = request.user.id;
    const existing = await this.prisma.idempotencyKey.findUnique({
      where: { userId_key: { userId, key } },
    });
    if (existing) {
      const response = context.switchToHttp().getResponse<Response>();
      response.status(existing.responseStatus);
      return of(existing.responseBody);
    }

    const statusCode =
      this.reflector.get<number>(HTTP_CODE_METADATA, context.getHandler()) ??
      (request.method === "POST" ? HttpStatus.CREATED : HttpStatus.OK);

    return next.handle().pipe(
      tap((body: unknown) => {
        this.prisma.idempotencyKey
          .create({
            data: {
              userId,
              key,
              path: request.path,
              method: request.method,
              responseStatus: statusCode,
              responseBody: body === undefined ? Prisma.JsonNull : (body as Prisma.InputJsonValue),
            },
          })
          .catch(() => undefined);
      })
    );
  }
}
