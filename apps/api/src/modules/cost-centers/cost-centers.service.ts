import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";

import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { assertInScope } from "../../common/utils/assert-in-scope";
import { PrismaService } from "../../database/prisma.service";
import { toCostCenterResponse } from "./dto/cost-center-response.dto";
import { CreateCostCenterDto } from "./dto/create-cost-center.dto";
import { UpdateCostCenterDto } from "./dto/update-cost-center.dto";

@Injectable()
export class CostCentersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(requester: AuthenticatedUser) {
    const costCenters = await this.prisma.costCenter.findMany({
      where: requester.hotelId
        ? { hotelId: requester.hotelId }
        : { hotel: { organizationId: requester.organizationId } },
      orderBy: { createdAt: "asc" },
    });
    return costCenters.map(toCostCenterResponse);
  }

  async findOne(id: string, requester: AuthenticatedUser) {
    const costCenter = await this.findWithHotelOrThrow(id);
    assertInScope(costCenter.hotel.organizationId, costCenter.hotelId, requester);
    return toCostCenterResponse(costCenter);
  }

  async create(dto: CreateCostCenterDto, requester: AuthenticatedUser) {
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

    if (dto.departmentId) {
      await this.assertDepartmentInHotel(dto.departmentId, hotelId);
    }

    const existing = await this.prisma.costCenter.findUnique({
      where: { hotelId_name: { hotelId, name: dto.name } },
    });
    if (existing) {
      throw new ConflictException("Un centre de coût avec ce nom existe déjà pour cet hôtel");
    }

    const costCenter = await this.prisma.costCenter.create({
      data: {
        hotelId,
        departmentId: dto.departmentId,
        code: dto.code,
        name: dto.name,
        description: dto.description,
      },
    });
    return toCostCenterResponse(costCenter);
  }

  async update(id: string, dto: UpdateCostCenterDto, requester: AuthenticatedUser) {
    const costCenter = await this.findWithHotelOrThrow(id);
    assertInScope(costCenter.hotel.organizationId, costCenter.hotelId, requester);

    if (dto.departmentId) {
      await this.assertDepartmentInHotel(dto.departmentId, costCenter.hotelId);
    }
    if (dto.name && dto.name !== costCenter.name) {
      const existing = await this.prisma.costCenter.findUnique({
        where: { hotelId_name: { hotelId: costCenter.hotelId, name: dto.name } },
      });
      if (existing) {
        throw new ConflictException("Un centre de coût avec ce nom existe déjà pour cet hôtel");
      }
    }

    const updated = await this.prisma.costCenter.update({ where: { id }, data: dto });
    return toCostCenterResponse(updated);
  }

  private async findWithHotelOrThrow(id: string) {
    const costCenter = await this.prisma.costCenter.findUnique({ where: { id }, include: { hotel: true } });
    if (!costCenter) {
      throw new NotFoundException("Centre de coût introuvable");
    }
    return costCenter;
  }

  private async assertDepartmentInHotel(departmentId: string, hotelId: string): Promise<void> {
    const department = await this.prisma.department.findUnique({ where: { id: departmentId } });
    if (!department || department.hotelId !== hotelId) {
      throw new BadRequestException("Le département doit appartenir au même hôtel");
    }
  }
}
