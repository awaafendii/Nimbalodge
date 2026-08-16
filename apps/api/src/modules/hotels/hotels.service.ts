import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";

import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { assertInScope } from "../../common/utils/assert-in-scope";
import { PrismaService } from "../../database/prisma.service";
import { CreateHotelDto } from "./dto/create-hotel.dto";
import { toHotelResponse } from "./dto/hotel-response.dto";
import { UpdateHotelDto } from "./dto/update-hotel.dto";

const DEFAULT_DEPARTMENT_NAME = "Administration générale";

@Injectable()
export class HotelsService {
  constructor(private readonly prisma: PrismaService) {}

  // Isolation hôtel (même mécanisme que UsersService.list()) : org-wide voit tous les hôtels de
  // son organisation, un demandeur hôtel-scopé ne voit que le sien (liste à 1 élément).
  async list(requester: AuthenticatedUser) {
    const hotels = await this.prisma.hotel.findMany({
      where: requester.hotelId
        ? { id: requester.hotelId, organizationId: requester.organizationId }
        : { organizationId: requester.organizationId },
      orderBy: { createdAt: "asc" },
    });
    return hotels.map(toHotelResponse);
  }

  async findOne(id: string, requester: AuthenticatedUser) {
    const hotel = await this.prisma.hotel.findUnique({ where: { id } });
    if (!hotel) {
      throw new NotFoundException("Hôtel introuvable");
    }
    assertInScope(hotel.organizationId, hotel.id, requester);
    return toHotelResponse(hotel);
  }

  async create(dto: CreateHotelDto, requester: AuthenticatedUser) {
    const existing = await this.prisma.hotel.findUnique({
      where: { organizationId_slug: { organizationId: requester.organizationId, slug: dto.slug } },
    });
    if (existing) {
      throw new ConflictException("Ce slug est déjà utilisé dans cette organisation");
    }

    const { createDefaultDepartment, ...hotelData } = dto;

    const hotel = await this.prisma.$transaction(async (tx) => {
      const created = await tx.hotel.create({
        data: { ...hotelData, organizationId: requester.organizationId },
      });
      if (createDefaultDepartment) {
        await tx.department.create({
          data: { hotelId: created.id, name: DEFAULT_DEPARTMENT_NAME },
        });
      }
      return created;
    });

    return toHotelResponse(hotel);
  }

  async update(id: string, dto: UpdateHotelDto, requester: AuthenticatedUser) {
    const hotel = await this.prisma.hotel.findUnique({ where: { id } });
    if (!hotel) {
      throw new NotFoundException("Hôtel introuvable");
    }
    assertInScope(hotel.organizationId, hotel.id, requester);

    if (dto.slug && dto.slug !== hotel.slug) {
      const existing = await this.prisma.hotel.findUnique({
        where: { organizationId_slug: { organizationId: hotel.organizationId, slug: dto.slug } },
      });
      if (existing) {
        throw new ConflictException("Ce slug est déjà utilisé dans cette organisation");
      }
    }

    const updated = await this.prisma.hotel.update({ where: { id }, data: dto });
    return toHotelResponse(updated);
  }
}
