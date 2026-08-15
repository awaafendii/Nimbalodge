import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";

import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { PrismaService } from "../../database/prisma.service";
import { CreateRoomTypeDto } from "./dto/create-room-type.dto";
import { toRoomTypeResponse } from "./dto/room-type-response.dto";
import { UpdateRoomTypeDto } from "./dto/update-room-type.dto";

@Injectable()
export class RoomTypesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(requester: AuthenticatedUser) {
    const roomTypes = await this.prisma.roomType.findMany({
      where: requester.hotelId
        ? { hotelId: requester.hotelId }
        : { hotel: { organizationId: requester.organizationId } },
      orderBy: { createdAt: "asc" },
    });
    return roomTypes.map(toRoomTypeResponse);
  }

  async findOne(id: string, requester: AuthenticatedUser) {
    const roomType = await this.findWithHotelOrThrow(id);
    this.assertInScope(roomType.hotel.organizationId, roomType.hotelId, requester);
    return toRoomTypeResponse(roomType);
  }

  async create(dto: CreateRoomTypeDto, requester: AuthenticatedUser) {
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

    const existing = await this.prisma.roomType.findUnique({
      where: { hotelId_name: { hotelId, name: dto.name } },
    });
    if (existing) {
      throw new ConflictException("Un type de chambre avec ce nom existe déjà pour cet hôtel");
    }

    const roomType = await this.prisma.roomType.create({
      data: {
        hotelId,
        name: dto.name,
        code: dto.code,
        description: dto.description,
        baseRate: dto.baseRate,
        currency: dto.currency,
        capacity: dto.capacity,
      },
    });
    return toRoomTypeResponse(roomType);
  }

  async update(id: string, dto: UpdateRoomTypeDto, requester: AuthenticatedUser) {
    const roomType = await this.findWithHotelOrThrow(id);
    this.assertInScope(roomType.hotel.organizationId, roomType.hotelId, requester);

    if (dto.name && dto.name !== roomType.name) {
      const existing = await this.prisma.roomType.findUnique({
        where: { hotelId_name: { hotelId: roomType.hotelId, name: dto.name } },
      });
      if (existing) {
        throw new ConflictException("Un type de chambre avec ce nom existe déjà pour cet hôtel");
      }
    }

    const updated = await this.prisma.roomType.update({ where: { id }, data: dto });
    return toRoomTypeResponse(updated);
  }

  private async findWithHotelOrThrow(id: string) {
    const roomType = await this.prisma.roomType.findUnique({ where: { id }, include: { hotel: true } });
    if (!roomType) {
      throw new NotFoundException("Type de chambre introuvable");
    }
    return roomType;
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
