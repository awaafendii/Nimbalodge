import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";

import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { PrismaService } from "../../database/prisma.service";
import { CreateGuestDto } from "./dto/create-guest.dto";
import { toGuestResponse } from "./dto/guest-response.dto";
import { UpdateGuestDto } from "./dto/update-guest.dto";

@Injectable()
export class GuestsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(requester: AuthenticatedUser) {
    const guests = await this.prisma.guest.findMany({
      where: requester.hotelId
        ? { hotelId: requester.hotelId }
        : { hotel: { organizationId: requester.organizationId } },
      orderBy: { createdAt: "asc" },
    });
    return guests.map(toGuestResponse);
  }

  async findOne(id: string, requester: AuthenticatedUser) {
    const guest = await this.findWithHotelOrThrow(id);
    this.assertInScope(guest.hotel.organizationId, guest.hotelId, requester);
    return toGuestResponse(guest);
  }

  async create(dto: CreateGuestDto, requester: AuthenticatedUser) {
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

    const guest = await this.prisma.guest.create({
      data: {
        hotelId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        documentType: dto.documentType,
        documentNumber: dto.documentNumber,
        nationality: dto.nationality,
        address: dto.address,
        preferences: dto.preferences,
        notes: dto.notes,
      },
    });
    return toGuestResponse(guest);
  }

  async update(id: string, dto: UpdateGuestDto, requester: AuthenticatedUser) {
    const guest = await this.findWithHotelOrThrow(id);
    this.assertInScope(guest.hotel.organizationId, guest.hotelId, requester);

    const updated = await this.prisma.guest.update({ where: { id }, data: dto });
    return toGuestResponse(updated);
  }

  private async findWithHotelOrThrow(id: string) {
    const guest = await this.prisma.guest.findUnique({ where: { id }, include: { hotel: true } });
    if (!guest) {
      throw new NotFoundException("Client introuvable");
    }
    return guest;
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
