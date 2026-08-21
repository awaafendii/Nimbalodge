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

  // Réutilisé par PermissionsGuard (vérification à chaque requête), AuthService (/auth/me,
  // switch-hotel) et AiOrchestratorService (Nimba AI). Pas de cache : pas de Redis à ce stade, coût
  // négligeable au volume d'utilisateurs actuel.
  //
  // RBAC multi-hôtel : union de deux sources, jamais fusionnées en une seule requête pour garder
  // la distinction ROLE (permissions) / MEMBERSHIP (à quel hôtel un rôle métier s'applique)
  // explicite (audit RBAC multi-hôtel) :
  //   1. UserRole — rôles PLATEFORME (ex. SUPER_ADMIN), toujours actifs quel que soit l'hôtel actif.
  //   2. HotelMembership(status: ACTIVE) pour `activeHotelId` — rôles MÉTIER, scopés à l'hôtel
  //      actif de la session. Changer d'hôtel actif (POST /auth/switch-hotel) change ce résultat.
  // Un rôle métier n'est jamais lu depuis UserRole ici : ne recevoir aucune permission depuis
  // HotelMembership pour l'hôtel actif est le comportement attendu si l'utilisateur n'y a pas de
  // membership valide, jamais un repli silencieux vers un autre scope.
  async resolveForUser(userId: string, activeHotelId: string | null = null): Promise<ResolvedPermissions> {
    const [userRoles, membership] = await Promise.all([
      this.prisma.userRole.findMany({
        where: { userId },
        include: { role: { include: { permissions: { include: { permission: true } } } } },
      }),
      activeHotelId
        ? this.prisma.hotelMembership.findUnique({
            where: { userId_hotelId: { userId, hotelId: activeHotelId } },
            include: { role: { include: { permissions: { include: { permission: true } } } } },
          })
        : Promise.resolve(null),
    ]);

    const roleNames = userRoles.map((userRole) => userRole.role.name);
    const permissions = new Set<string>();
    for (const userRole of userRoles) {
      for (const rolePermission of userRole.role.permissions) {
        permissions.add(rolePermission.permission.key);
      }
    }
    if (membership && membership.status === "ACTIVE") {
      roleNames.push(membership.role.name);
      for (const rolePermission of membership.role.permissions) {
        permissions.add(rolePermission.permission.key);
      }
    }
    return { roleNames, permissions };
  }
}
