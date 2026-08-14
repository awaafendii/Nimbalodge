import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  // Rôles visibles par une organisation : les rôles système globaux (organizationId null,
  // ex. SUPER_ADMIN) + les rôles personnalisés propres à cette organisation.
  listForOrganization(organizationId: string) {
    return this.prisma.role.findMany({
      where: { OR: [{ organizationId: null }, { organizationId }] },
      include: { permissions: { include: { permission: true } } },
      orderBy: { name: "asc" },
    });
  }
}
