import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Request, Response } from "express";
import { memoryStorage } from "multer";

import { AuthenticatedOnly } from "../../common/decorators/authenticated-only.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { DocumentsService } from "./documents.service";

// @AuthenticatedOnly() partout, jamais @RequirePermissions() : la permission requise dépend du
// TYPE de ressource ciblée (finance-expenses.update, employees.update, ...), résolue dynamiquement
// dans DocumentsService (RESOURCE_TYPE_CONFIG), pas une permission statique par route. Sans ce
// marqueur explicite, PermissionsGuard refuserait ces routes par défaut (fail-closed, Étape 7 RBAC
// 2/n) — la vérification réelle a bien lieu, juste plus bas dans la pile. Stockage multer en
// mémoire (memoryStorage) : le fichier passe en Buffer à DocumentsService, jamais écrit sur disque
// par multer lui-même — un seul point d'écriture (StorageProvider), pas deux.
@Controller("documents")
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @AuthenticatedOnly()
  @Post(":resourceType/:resourceId")
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  upload(
    @Param("resourceType") resourceType: string,
    @Param("resourceId") resourceId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request
  ) {
    if (!file) {
      throw new BadRequestException("Aucun fichier reçu (champ attendu : \"file\")");
    }
    return this.documentsService.upload(resourceType, resourceId, file, user, request.ip ?? null);
  }

  // :id/content DOIT être déclaré avant :resourceType/:resourceId ci-dessous : Nest/Express
  // matchent les routes GET dans l'ordre d'enregistrement pour un même nombre de segments, donc
  // "/documents/abc123/content" serait sinon capté à tort par le pattern à deux paramètres
  // (resourceType="abc123", resourceId="content") — constaté en direct via les tests e2e.
  @AuthenticatedOnly()
  @Get(":id/content")
  async download(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser, @Res() response: Response) {
    const { buffer, filename, mimeType } = await this.documentsService.download(id, user);
    response.setHeader("Content-Type", mimeType);
    response.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
    response.send(buffer);
  }

  @AuthenticatedOnly()
  @Get(":resourceType/:resourceId")
  list(
    @Param("resourceType") resourceType: string,
    @Param("resourceId") resourceId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.documentsService.list(resourceType, resourceId, user);
  }

  @AuthenticatedOnly()
  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser, @Req() request: Request) {
    return this.documentsService.remove(id, user, request.ip ?? null);
  }
}
