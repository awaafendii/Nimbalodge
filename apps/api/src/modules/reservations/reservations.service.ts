import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Reservation, ReservationStatus } from "@prisma/client";

import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { PrismaService } from "../../database/prisma.service";
import { RoomsService } from "../rooms/rooms.service";
import { CancelReservationDto } from "./dto/cancel-reservation.dto";
import { CreateReservationDto } from "./dto/create-reservation.dto";
import { toReservationResponse } from "./dto/reservation-response.dto";
import { UpdateReservationDto } from "./dto/update-reservation.dto";

type ReservationFields = CreateReservationDto | UpdateReservationDto;

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roomsService: RoomsService
  ) {}

  async list(requester: AuthenticatedUser) {
    const reservations = await this.prisma.reservation.findMany({
      where: requester.hotelId
        ? { hotelId: requester.hotelId }
        : { hotel: { organizationId: requester.organizationId } },
      orderBy: { checkInDate: "desc" },
    });
    return reservations.map(toReservationResponse);
  }

  async findOne(id: string, requester: AuthenticatedUser) {
    const reservation = await this.findWithHotelOrThrow(id);
    this.assertInScope(reservation.hotel.organizationId, reservation.hotelId, requester);
    return toReservationResponse(reservation);
  }

  async create(dto: CreateReservationDto, requester: AuthenticatedUser) {
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

    const checkInDate = new Date(dto.checkInDate);
    const checkOutDate = new Date(dto.checkOutDate);
    if (checkInDate >= checkOutDate) {
      throw new BadRequestException("checkInDate doit être antérieure à checkOutDate");
    }

    const room = await this.prisma.room.findUniqueOrThrow({
      where: { id: dto.roomId },
      include: { roomType: true },
    });

    const hasOverlap = await this.roomsService.hasOverlap(dto.roomId, checkInDate, checkOutDate);
    if (hasOverlap) {
      throw new ConflictException("Chambre déjà réservée sur cette période");
    }

    const reservation = await this.prisma.reservation.create({
      data: {
        hotelId,
        guestId: dto.guestId,
        roomId: dto.roomId,
        checkInDate,
        checkOutDate,
        adults: dto.adults,
        children: dto.children,
        agreedRate: dto.agreedRate ?? room.roomType.baseRate,
        currency: dto.currency ?? room.roomType.currency,
        source: dto.source,
        notes: dto.notes,
        createdById: requester.id,
      },
    });
    return toReservationResponse(reservation);
  }

  async update(id: string, dto: UpdateReservationDto, requester: AuthenticatedUser) {
    const reservation = await this.findWithHotelOrThrow(id);
    this.assertInScope(reservation.hotel.organizationId, reservation.hotelId, requester);
    if (reservation.status !== "PENDING") {
      throw new BadRequestException("Seule une réservation en attente peut être modifiée");
    }

    await this.validateReferences(reservation.hotelId, dto);

    const checkInDate = dto.checkInDate ? new Date(dto.checkInDate) : reservation.checkInDate;
    const checkOutDate = dto.checkOutDate ? new Date(dto.checkOutDate) : reservation.checkOutDate;
    if (checkInDate >= checkOutDate) {
      throw new BadRequestException("checkInDate doit être antérieure à checkOutDate");
    }

    const roomId = dto.roomId ?? reservation.roomId;
    if (dto.roomId || dto.checkInDate || dto.checkOutDate) {
      const hasOverlap = await this.roomsService.hasOverlap(roomId, checkInDate, checkOutDate, reservation.id);
      if (hasOverlap) {
        throw new ConflictException("Chambre déjà réservée sur cette période");
      }
    }

    const updated = await this.prisma.reservation.update({
      where: { id },
      data: {
        guestId: dto.guestId,
        roomId: dto.roomId,
        checkInDate: dto.checkInDate ? checkInDate : undefined,
        checkOutDate: dto.checkOutDate ? checkOutDate : undefined,
        adults: dto.adults,
        children: dto.children,
        agreedRate: dto.agreedRate,
        currency: dto.currency,
        source: dto.source,
        notes: dto.notes,
      },
    });
    return toReservationResponse(updated);
  }

  async confirm(id: string, requester: AuthenticatedUser) {
    const reservation = await this.transition(id, requester, "PENDING", "confirm");
    const updated = await this.prisma.reservation.update({ where: { id: reservation.id }, data: { status: "CONFIRMED" } });
    return toReservationResponse(updated);
  }

  async checkIn(id: string, requester: AuthenticatedUser) {
    const reservation = await this.transition(id, requester, "CONFIRMED", "check-in");
    const updated = await this.prisma.reservation.update({
      where: { id: reservation.id },
      data: { status: "CHECKED_IN", actualCheckInAt: new Date() },
    });
    return toReservationResponse(updated);
  }

  async checkOut(id: string, requester: AuthenticatedUser) {
    const reservation = await this.transition(id, requester, "CHECKED_IN", "check-out");
    const updated = await this.prisma.reservation.update({
      where: { id: reservation.id },
      data: { status: "CHECKED_OUT", actualCheckOutAt: new Date() },
    });
    return toReservationResponse(updated);
  }

  async noShow(id: string, requester: AuthenticatedUser) {
    const reservation = await this.transition(id, requester, "CONFIRMED", "no-show");
    const updated = await this.prisma.reservation.update({ where: { id: reservation.id }, data: { status: "NO_SHOW" } });
    return toReservationResponse(updated);
  }

  // Pas via transition() (statut attendu unique) : PENDING et CONFIRMED sont tous deux annulables,
  // CHECKED_IN ne l'est plus (séjour en cours — miroir de l'annulation Invoice bloquée si paiements
  // existants, voir docs/architecture/phase-6-billing.md).
  async cancel(id: string, dto: CancelReservationDto, requester: AuthenticatedUser) {
    const reservation = await this.findWithHotelOrThrow(id);
    this.assertInScope(reservation.hotel.organizationId, reservation.hotelId, requester);
    if (reservation.status !== "PENDING" && reservation.status !== "CONFIRMED") {
      throw new BadRequestException(
        `Impossible d'annuler une réservation au statut ${reservation.status} — un séjour en cours ou terminé ne s'annule pas`
      );
    }
    const updated = await this.prisma.reservation.update({
      where: { id: reservation.id },
      data: { status: "CANCELLED", cancelReason: dto.reason },
    });
    return toReservationResponse(updated);
  }

  private async transition(
    id: string,
    requester: AuthenticatedUser,
    expectedStatus: ReservationStatus,
    action: string
  ): Promise<Reservation> {
    const reservation = await this.findWithHotelOrThrow(id);
    this.assertInScope(reservation.hotel.organizationId, reservation.hotelId, requester);
    if (reservation.status !== expectedStatus) {
      throw new BadRequestException(
        `Impossible d'effectuer "${action}" depuis le statut ${reservation.status} (attendu : ${expectedStatus})`
      );
    }
    return reservation;
  }

  private async validateReferences(hotelId: string, dto: ReservationFields): Promise<void> {
    if (dto.guestId) {
      const guest = await this.prisma.guest.findUnique({ where: { id: dto.guestId } });
      if (!guest || guest.hotelId !== hotelId || !guest.isActive) {
        throw new BadRequestException("Client invalide");
      }
    }
    if (dto.roomId) {
      const room = await this.prisma.room.findUnique({ where: { id: dto.roomId } });
      if (!room || room.hotelId !== hotelId || !room.isActive) {
        throw new BadRequestException("Chambre invalide");
      }
    }
  }

  private async findWithHotelOrThrow(id: string) {
    const reservation = await this.prisma.reservation.findUnique({ where: { id }, include: { hotel: true } });
    if (!reservation) {
      throw new NotFoundException("Réservation introuvable");
    }
    return reservation;
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
