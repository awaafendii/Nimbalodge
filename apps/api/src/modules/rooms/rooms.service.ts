import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { ReservationStatus } from "@prisma/client";

import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { PrismaService } from "../../database/prisma.service";
import { CreateRoomDto } from "./dto/create-room.dto";
import { RoomAvailabilityQueryDto } from "./dto/room-availability-query.dto";
import { toRoomResponse } from "./dto/room-response.dto";
import { UpdateRoomDto } from "./dto/update-room.dto";

// Statuts qui "tiennent" la chambre — une Reservation CANCELLED/NO_SHOW ne bloque plus rien.
const BLOCKING_STATUSES: ReservationStatus[] = ["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT"];

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(requester: AuthenticatedUser) {
    const rooms = await this.prisma.room.findMany({
      where: requester.hotelId
        ? { hotelId: requester.hotelId }
        : { hotel: { organizationId: requester.organizationId } },
      orderBy: { createdAt: "asc" },
    });
    return rooms.map(toRoomResponse);
  }

  async findOne(id: string, requester: AuthenticatedUser) {
    const room = await this.findWithHotelOrThrow(id);
    this.assertInScope(room.hotel.organizationId, room.hotelId, requester);
    return toRoomResponse(room);
  }

  // Chambres actives sans Reservation bloquante en chevauchement sur [checkIn, checkOut) —
  // même formule que checkOverlap(), réutilisée telle quelle par ReservationsService (injection de
  // RoomsService, même pattern que FinanceSummaryService/CashAccountsService).
  async available(query: RoomAvailabilityQueryDto, requester: AuthenticatedUser) {
    const checkIn = new Date(query.checkIn);
    const checkOut = new Date(query.checkOut);
    if (checkIn >= checkOut) {
      throw new BadRequestException("checkIn doit être antérieur à checkOut");
    }

    const hotelWhere = requester.hotelId
      ? { hotelId: requester.hotelId }
      : { hotel: { organizationId: requester.organizationId } };

    if (query.roomTypeId) {
      const roomType = await this.prisma.roomType.findUnique({ where: { id: query.roomTypeId } });
      const roomTypeHotelId = requester.hotelId;
      if (!roomType || (roomTypeHotelId && roomType.hotelId !== roomTypeHotelId)) {
        throw new BadRequestException("Type de chambre invalide");
      }
    }

    const rooms = await this.prisma.room.findMany({
      where: {
        ...hotelWhere,
        isActive: true,
        ...(query.roomTypeId ? { roomTypeId: query.roomTypeId } : {}),
        reservations: {
          none: {
            status: { in: BLOCKING_STATUSES },
            checkInDate: { lt: checkOut },
            checkOutDate: { gt: checkIn },
          },
        },
      },
      orderBy: { number: "asc" },
    });
    return rooms.map(toRoomResponse);
  }

  // Réutilisé par ReservationsService.create()/update() — chevauchement demi-ouvert sur
  // [checkInDate, checkOutDate) : une arrivée le jour même du départ d'une autre réservation
  // n'est pas un conflit. `excludeReservationId` permet à update() de s'exclure elle-même.
  async hasOverlap(roomId: string, checkIn: Date, checkOut: Date, excludeReservationId?: string): Promise<boolean> {
    const conflict = await this.prisma.reservation.findFirst({
      where: {
        roomId,
        status: { in: BLOCKING_STATUSES },
        checkInDate: { lt: checkOut },
        checkOutDate: { gt: checkIn },
        ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
      },
    });
    return Boolean(conflict);
  }

  async create(dto: CreateRoomDto, requester: AuthenticatedUser) {
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

    const roomType = await this.prisma.roomType.findUnique({ where: { id: dto.roomTypeId } });
    if (!roomType || roomType.hotelId !== hotelId) {
      throw new BadRequestException("Type de chambre invalide");
    }

    const existing = await this.prisma.room.findUnique({
      where: { hotelId_number: { hotelId, number: dto.number } },
    });
    if (existing) {
      throw new ConflictException("Une chambre avec ce numéro existe déjà pour cet hôtel");
    }

    const room = await this.prisma.room.create({
      data: {
        hotelId,
        roomTypeId: dto.roomTypeId,
        number: dto.number,
        floor: dto.floor,
        building: dto.building,
      },
    });
    return toRoomResponse(room);
  }

  async update(id: string, dto: UpdateRoomDto, requester: AuthenticatedUser) {
    const room = await this.findWithHotelOrThrow(id);
    this.assertInScope(room.hotel.organizationId, room.hotelId, requester);

    if (dto.roomTypeId) {
      const roomType = await this.prisma.roomType.findUnique({ where: { id: dto.roomTypeId } });
      if (!roomType || roomType.hotelId !== room.hotelId) {
        throw new BadRequestException("Type de chambre invalide");
      }
    }

    if (dto.number && dto.number !== room.number) {
      const existing = await this.prisma.room.findUnique({
        where: { hotelId_number: { hotelId: room.hotelId, number: dto.number } },
      });
      if (existing) {
        throw new ConflictException("Une chambre avec ce numéro existe déjà pour cet hôtel");
      }
    }

    const updated = await this.prisma.room.update({ where: { id }, data: dto });
    return toRoomResponse(updated);
  }

  private async findWithHotelOrThrow(id: string) {
    const room = await this.prisma.room.findUnique({ where: { id }, include: { hotel: true } });
    if (!room) {
      throw new NotFoundException("Chambre introuvable");
    }
    return room;
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
