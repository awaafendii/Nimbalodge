import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";

import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { assertInScope } from "../../common/utils/assert-in-scope";
import { PrismaService } from "../../database/prisma.service";
import { CreateDepartmentDto } from "./dto/create-department.dto";
import { toDepartmentResponse } from "./dto/department-response.dto";
import { UpdateDepartmentDto } from "./dto/update-department.dto";

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  // Dérivé automatiquement du demandeur (jamais un hotelId en query param — empêcherait
  // l'isolation d'être contournée). Org-wide : tous les départements de son organisation.
  // Hôtel-scopé : uniquement ceux de son hôtel.
  async list(requester: AuthenticatedUser) {
    const departments = await this.prisma.department.findMany({
      where: requester.hotelId
        ? { hotelId: requester.hotelId }
        : { hotel: { organizationId: requester.organizationId } },
      orderBy: { createdAt: "asc" },
    });
    return departments.map(toDepartmentResponse);
  }

  async findOne(id: string, requester: AuthenticatedUser) {
    const department = await this.findWithHotelOrThrow(id);
    assertInScope(department.hotel.organizationId, department.hotelId, requester);
    return toDepartmentResponse(department);
  }

  async create(dto: CreateDepartmentDto, requester: AuthenticatedUser) {
    const hotelId = requester.hotelId ?? dto.hotelId;
    if (!hotelId) {
      throw new BadRequestException("hotelId requis");
    }
    if (requester.hotelId && dto.hotelId && dto.hotelId !== requester.hotelId) {
      throw new ForbiddenException("Hors périmètre de votre hôtel");
    }

    const hotel = await this.prisma.hotel.findUnique({ where: { id: hotelId } });
    if (!hotel || hotel.organizationId !== requester.organizationId) {
      throw new BadRequestException("Hôtel invalide");
    }

    if (dto.managerId) {
      await this.assertManagerInHotel(dto.managerId, hotelId);
    }

    const existing = await this.prisma.department.findUnique({
      where: { hotelId_name: { hotelId, name: dto.name } },
    });
    if (existing) {
      throw new ConflictException("Un département avec ce nom existe déjà pour cet hôtel");
    }

    const department = await this.prisma.department.create({
      data: {
        hotelId,
        name: dto.name,
        code: dto.code,
        description: dto.description,
        managerId: dto.managerId,
      },
    });
    return toDepartmentResponse(department);
  }

  async update(id: string, dto: UpdateDepartmentDto, requester: AuthenticatedUser) {
    const department = await this.findWithHotelOrThrow(id);
    assertInScope(department.hotel.organizationId, department.hotelId, requester);

    if (dto.managerId) {
      await this.assertManagerInHotel(dto.managerId, department.hotelId);
    }
    if (dto.name && dto.name !== department.name) {
      const existing = await this.prisma.department.findUnique({
        where: { hotelId_name: { hotelId: department.hotelId, name: dto.name } },
      });
      if (existing) {
        throw new ConflictException("Un département avec ce nom existe déjà pour cet hôtel");
      }
    }

    const updated = await this.prisma.department.update({ where: { id }, data: dto });
    return toDepartmentResponse(updated);
  }

  async assignUser(departmentId: string, userId: string, requester: AuthenticatedUser) {
    const department = await this.findWithHotelOrThrow(departmentId);
    assertInScope(department.hotel.organizationId, department.hotelId, requester);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.hotelId !== department.hotelId) {
      throw new BadRequestException("L'utilisateur doit appartenir au même hôtel que le département");
    }

    await this.prisma.userDepartment.upsert({
      where: { userId_departmentId: { userId, departmentId } },
      update: {},
      create: { userId, departmentId },
    });
    return { success: true };
  }

  async removeUser(departmentId: string, userId: string, requester: AuthenticatedUser) {
    const department = await this.findWithHotelOrThrow(departmentId);
    assertInScope(department.hotel.organizationId, department.hotelId, requester);

    await this.prisma.userDepartment.deleteMany({ where: { userId, departmentId } });
    return { success: true };
  }

  // Consommé par assertInDepartmentScope() (Étape 5) dans les services dont la ressource porte un
  // departmentId — liste vide = demandeur non affecté à un département = pas de restriction
  // (voir le commentaire d'assertInDepartmentScope pour la sémantique opt-in).
  async getDepartmentIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.userDepartment.findMany({ where: { userId }, select: { departmentId: true } });
    return rows.map((row) => row.departmentId);
  }

  private async findWithHotelOrThrow(id: string) {
    const department = await this.prisma.department.findUnique({ where: { id }, include: { hotel: true } });
    if (!department) {
      throw new NotFoundException("Département introuvable");
    }
    return department;
  }

  private async assertManagerInHotel(managerId: string, hotelId: string): Promise<void> {
    const manager = await this.prisma.user.findUnique({ where: { id: managerId } });
    if (!manager || manager.hotelId !== hotelId) {
      throw new BadRequestException("Le manager doit appartenir au même hôtel que le département");
    }
  }
}
