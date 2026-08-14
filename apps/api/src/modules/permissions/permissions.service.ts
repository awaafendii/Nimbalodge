import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";

export interface ResolvedPermissions {
  roleNames: string[];
  permissions: Set<string>;
}

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.permission.findMany({ orderBy: { key: "asc" } });
  }

  // Réutilisé par PermissionsGuard (vérification à chaque requête) et par AuthService (/auth/me).
  // Pas de cache : pas de Redis à ce stade (rien n'en dépend encore), coût négligeable au volume
  // d'utilisateurs actuel.
  async resolveForUser(userId: string): Promise<ResolvedPermissions> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: { permissions: { include: { permission: true } } },
        },
      },
    });

    const roleNames = userRoles.map((userRole) => userRole.role.name);
    const permissions = new Set<string>();
    for (const userRole of userRoles) {
      for (const rolePermission of userRole.role.permissions) {
        permissions.add(rolePermission.permission.key);
      }
    }
    return { roleNames, permissions };
  }
}
