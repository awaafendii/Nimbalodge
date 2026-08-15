import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";

import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { PrismaService } from "../../database/prisma.service";
import { CreateWarehouseDto } from "./dto/create-warehouse.dto";
import { toWarehouseResponse } from "./dto/warehouse-response.dto";
import { UpdateWarehouseDto } from "./dto/update-warehouse.dto";

type WarehouseFields = CreateWarehouseDto | UpdateWarehouseDto;

@Injectable()
export class WarehousesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(requester: AuthenticatedUser) {
    const warehouses = await this.prisma.warehouse.findMany({
      where: requester.hotelId
        ? { hotelId: requester.hotelId }
        : { hotel: { organizationId: requester.organizationId } },
      orderBy: { createdAt: "asc" },
    });
    return warehouses.map(toWarehouseResponse);
  }

  async findOne(id: string, requester: AuthenticatedUser) {
    const warehouse = await this.findWithHotelOrThrow(id);
    this.assertInScope(warehouse.hotel.organizationId, warehouse.hotelId, requester);
    return toWarehouseResponse(warehouse);
  }

  async create(dto: CreateWarehouseDto, requester: AuthenticatedUser) {
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

    await this.validateReferences(hotelId, dto);

    const existing = await this.prisma.warehouse.findUnique({
      where: { hotelId_name: { hotelId, name: dto.name } },
    });
    if (existing) {
      throw new ConflictException("Un entrepôt avec ce nom existe déjà pour cet hôtel");
    }

    const warehouse = await this.prisma.warehouse.create({
      data: {
        hotelId,
        departmentId: dto.departmentId,
        name: dto.name,
        location: dto.location,
      },
    });
    return toWarehouseResponse(warehouse);
  }

  async update(id: string, dto: UpdateWarehouseDto, requester: AuthenticatedUser) {
    const warehouse = await this.findWithHotelOrThrow(id);
    this.assertInScope(warehouse.hotel.organizationId, warehouse.hotelId, requester);

    await this.validateReferences(warehouse.hotelId, dto);

    if (dto.name && dto.name !== warehouse.name) {
      const existing = await this.prisma.warehouse.findUnique({
        where: { hotelId_name: { hotelId: warehouse.hotelId, name: dto.name } },
      });
      if (existing) {
        throw new ConflictException("Un entrepôt avec ce nom existe déjà pour cet hôtel");
      }
    }

    const updated = await this.prisma.warehouse.update({ where: { id }, data: dto });
    return toWarehouseResponse(updated);
  }

  private async validateReferences(hotelId: string, dto: WarehouseFields): Promise<void> {
    if (dto.departmentId) {
      const department = await this.prisma.department.findUnique({ where: { id: dto.departmentId } });
      if (!department || department.hotelId !== hotelId) {
        throw new BadRequestException("Département invalide");
      }
    }
  }

  private async findWithHotelOrThrow(id: string) {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id }, include: { hotel: true } });
    if (!warehouse) {
      throw new NotFoundException("Entrepôt introuvable");
    }
    return warehouse;
  }

  private assertInScope(organizationId: string, hotelId: string, requester: AuthenticatedUser): void {
    if (organizationId !== requester.organizationId) {
      throw new ForbiddenException("Hors périmètre de votre organisation");
    }
    if (requester.hotelId && hotelId !== requester.hotelId) {
      throw new ForbiddenException("Hors périmètre de votre hôtel");
    }
  }
}
