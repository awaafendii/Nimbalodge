import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";

import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { PrismaService } from "../../database/prisma.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { toUserResponse, type UserResponse } from "./dto/user-response.dto";

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
    });
    return users.map(toUserResponse);
  }

  async findOne(id: string, requester: AuthenticatedUser): Promise<UserResponse> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException("Utilisateur introuvable");
    }
    this.assertInScope(user.organizationId, user.hotelId, requester);
    return toUserResponse(user);
  }

  async create(dto: CreateUserDto, requester: AuthenticatedUser): Promise<UserResponse> {
    // Un demandeur rattaché à un hôtel ne peut créer que dans son propre hôtel.
    const hotelId = requester.hotelId ?? dto.hotelId ?? null;
    if (requester.hotelId && dto.hotelId && dto.hotelId !== requester.hotelId) {
      throw new ForbiddenException("Hors périmètre de votre hôtel");
    }
    if (hotelId) {
      const hotel = await this.prisma.hotel.findUnique({ where: { id: hotelId } });
      if (!hotel || hotel.organizationId !== requester.organizationId) {
        throw new BadRequestException("Hôtel invalide");
      }
    }

    const roles = await this.prisma.role.findMany({
      where: {
        id: { in: dto.roleIds },
        OR: [{ organizationId: null }, { organizationId: requester.organizationId }],
      },
    });
    if (roles.length !== dto.roleIds.length) {
      throw new BadRequestException("Un ou plusieurs rôles sont invalides pour cette organisation");
    }

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException("Cet email est déjà utilisé");
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        organizationId: requester.organizationId,
        hotelId,
        roles: { create: dto.roleIds.map((roleId) => ({ roleId })) },
      },
    });

    return toUserResponse(user);
  }

  private assertInScope(organizationId: string, hotelId: string | null, requester: AuthenticatedUser): void {
    if (organizationId !== requester.organizationId) {
      throw new ForbiddenException("Hors périmètre de votre organisation");
    }
    if (requester.hotelId && hotelId !== requester.hotelId) {
      throw new ForbiddenException("Hors périmètre de votre hôtel");
    }
  }
}
