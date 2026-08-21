import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";

import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { assertInScope } from "../../common/utils/assert-in-scope";
import { PrismaService } from "../../database/prisma.service";
import { AddHotelMembershipDto } from "./dto/add-hotel-membership.dto";
import { CreateUserDto } from "./dto/create-user.dto";
import { toUserResponse, type UserResponse } from "./dto/user-response.dto";

// Relation réutilisée par list()/findOne()/create()/addHotelMembership()/removeHotelMembership() —
// un seul point de vérité pour la forme "utilisateur + ses HotelMembership actives", jamais
// dupliquée entre méthodes.
const MEMBERSHIPS_INCLUDE = {
  hotelMemberships: {
    where: { status: "ACTIVE" as const },
    include: { hotel: true, role: true },
    orderBy: { createdAt: "asc" as const },
  },
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // Isolation hôtel (§29, §52) : un demandeur sans hotelId (rôle org-wide, ex. SUPER_ADMIN) voit
  // tous les users de son organisation ; un demandeur rattaché à un hôtel ne voit que les users
  // de ce même hôtel. Utilise une donnée qui existe déjà en Phase 3 — testable sans attendre les
  // départements (Phase 4).
  async list(requester: AuthenticatedUser): Promise<UserResponse[]> {
    const users = await this.prisma.user.findMany({
      where: requester.hotelId
        ? { organizationId: requester.organizationId, hotelId: requester.hotelId }
        : { organizationId: requester.organizationId },
      orderBy: { createdAt: "asc" },
      include: MEMBERSHIPS_INCLUDE,
    });
    return users.map(toUserResponse);
  }

  async findOne(id: string, requester: AuthenticatedUser): Promise<UserResponse> {
    const user = await this.prisma.user.findUnique({ where: { id }, include: MEMBERSHIPS_INCLUDE });
    if (!user) {
      throw new NotFoundException("Utilisateur introuvable");
    }
    assertInScope(user.organizationId, user.hotelId, requester);
    return toUserResponse(user);
  }

  // RBAC multi-hôtel (audit RBAC multi-hôtel) — un rôle métier créé ici est attribué EXCLUSIVEMENT
  // via HotelMembership, jamais via UserRole. `role.organizationId === requester.organizationId`
  // exclut par construction tout rôle plateforme (SUPER_ADMIN, organizationId: null) : cet endpoint
  // ne peut jamais servir à créer un second SUPER_ADMIN — cohérent avec la doc existante ("seul
  // SUPER_ADMIN est créé par bootstrap-production.ts, tout AUTRE rôle est créé par l'opérateur
  // depuis l'application").
  async create(dto: CreateUserDto, requester: AuthenticatedUser): Promise<UserResponse> {
    // Un demandeur rattaché à un hôtel ne peut créer que dans son propre hôtel.
    const hotelId = requester.hotelId ?? dto.hotelId ?? null;
    if (requester.hotelId && dto.hotelId && dto.hotelId !== requester.hotelId) {
      throw new ForbiddenException("Hors périmètre de votre hôtel");
    }
    if (!hotelId) {
      throw new BadRequestException("hotelId requis — un utilisateur métier est toujours rattaché à un hôtel");
    }

    const hotel = await this.prisma.hotel.findUnique({ where: { id: hotelId } });
    if (!hotel || hotel.organizationId !== requester.organizationId) {
      throw new BadRequestException("Hôtel invalide");
    }

    const role = await this.prisma.role.findUnique({ where: { id: dto.roleId } });
    if (!role || role.organizationId !== requester.organizationId) {
      throw new BadRequestException("Rôle invalide — seuls les rôles métier de votre organisation peuvent être attribués ici");
    }

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException("Cet email est déjà utilisé");
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          organizationId: requester.organizationId,
          hotelId,
        },
      });
      await tx.hotelMembership.create({ data: { userId: created.id, hotelId, roleId: dto.roleId } });
      return tx.user.findUniqueOrThrow({ where: { id: created.id }, include: MEMBERSHIPS_INCLUDE });
    });

    return toUserResponse(user);
  }

  // Ajoute une HotelMembership à un utilisateur EXISTANT — constitue un profil multi-hôtel (type
  // BOSS) progressivement, sans repasser par create(). upsert() plutôt que create() : rejouer cette
  // action pour changer le rôle d'un utilisateur déjà membre du même hôtel est un cas d'usage
  // légitime (changement de poste), pas une erreur.
  async addHotelMembership(userId: string, dto: AddHotelMembershipDto, requester: AuthenticatedUser): Promise<UserResponse> {
    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target) {
      throw new NotFoundException("Utilisateur introuvable");
    }
    assertInScope(target.organizationId, target.hotelId, requester);
    if (requester.hotelId && dto.hotelId !== requester.hotelId) {
      throw new ForbiddenException("Hors périmètre de votre hôtel");
    }

    const hotel = await this.prisma.hotel.findUnique({ where: { id: dto.hotelId } });
    if (!hotel || hotel.organizationId !== requester.organizationId) {
      throw new BadRequestException("Hôtel invalide");
    }
    const role = await this.prisma.role.findUnique({ where: { id: dto.roleId } });
    if (!role || role.organizationId !== requester.organizationId) {
      throw new BadRequestException("Rôle invalide — seuls les rôles métier de votre organisation peuvent être attribués ici");
    }

    await this.prisma.hotelMembership.upsert({
      where: { userId_hotelId: { userId, hotelId: dto.hotelId } },
      update: { roleId: dto.roleId, status: "ACTIVE" },
      create: { userId, hotelId: dto.hotelId, roleId: dto.roleId },
    });

    const updated = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: MEMBERSHIPS_INCLUDE });
    return toUserResponse(updated);
  }

  // Révoque l'accès d'un utilisateur à un hôtel donné (status: SUSPENDED, jamais une suppression —
  // conserve l'historique d'audit, même principe que HotelMembership.status ailleurs dans le
  // projet). Un utilisateur qui perd sa dernière membership retombe sur le comportement décrit dans
  // resolveActiveHotelId() (repli sur User.hotelId, jamais un élargissement d'accès).
  async removeHotelMembership(userId: string, hotelId: string, requester: AuthenticatedUser): Promise<UserResponse> {
    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target) {
      throw new NotFoundException("Utilisateur introuvable");
    }
    assertInScope(target.organizationId, target.hotelId, requester);
    if (requester.hotelId && hotelId !== requester.hotelId) {
      throw new ForbiddenException("Hors périmètre de votre hôtel");
    }

    const membership = await this.prisma.hotelMembership.findUnique({ where: { userId_hotelId: { userId, hotelId } } });
    if (!membership) {
      throw new NotFoundException("Cet utilisateur n'a pas d'affectation sur cet hôtel");
    }

    await this.prisma.hotelMembership.update({ where: { id: membership.id }, data: { status: "SUSPENDED" } });

    const updated = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: MEMBERSHIPS_INCLUDE });
    return toUserResponse(updated);
  }
}
