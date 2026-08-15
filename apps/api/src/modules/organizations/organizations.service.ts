import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";

import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { PrismaService } from "../../database/prisma.service";

// Lecture seule (pas de POST/PATCH) : une organisation est provisionnée une fois (ops/seed), il
// n'existe aucun flow produit "créer une organisation" à ce stade — même traitement que
// Rôles/Permissions en Phase 3 (rien n'exploiterait l'écriture).
@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(id: string, requester: AuthenticatedUser) {
    if (id !== requester.organizationId) {
      throw new ForbiddenException("Hors périmètre de votre organisation");
    }
    const organization = await this.prisma.organization.findUnique({ where: { id } });
    if (!organization) {
      throw new NotFoundException("Organisation introuvable");
    }
    return organization;
  }
}
