import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";

import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { assertInScope } from "../../common/utils/assert-in-scope";
import { PrismaService } from "../../database/prisma.service";
import { CreateSupplierDto } from "./dto/create-supplier.dto";
import { toSupplierResponse } from "./dto/supplier-response.dto";
import { UpdateSupplierDto } from "./dto/update-supplier.dto";

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(requester: AuthenticatedUser) {
    const suppliers = await this.prisma.supplier.findMany({
      where: requester.hotelId
        ? { hotelId: requester.hotelId }
        : { hotel: { organizationId: requester.organizationId } },
      orderBy: { createdAt: "asc" },
    });
    return suppliers.map(toSupplierResponse);
  }

  async findOne(id: string, requester: AuthenticatedUser) {
    const supplier = await this.findWithHotelOrThrow(id);
    assertInScope(supplier.hotel.organizationId, supplier.hotelId, requester);
    return toSupplierResponse(supplier);
  }

  async create(dto: CreateSupplierDto, requester: AuthenticatedUser) {
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

    const existing = await this.prisma.supplier.findUnique({
      where: { hotelId_name: { hotelId, name: dto.name } },
    });
    if (existing) {
      throw new ConflictException("Un fournisseur avec ce nom existe déjà pour cet hôtel");
    }

    const supplier = await this.prisma.supplier.create({
      data: {
        hotelId,
        name: dto.name,
        contactName: dto.contactName,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
        taxId: dto.taxId,
        notes: dto.notes,
      },
    });
    return toSupplierResponse(supplier);
  }

  async update(id: string, dto: UpdateSupplierDto, requester: AuthenticatedUser) {
    const supplier = await this.findWithHotelOrThrow(id);
    assertInScope(supplier.hotel.organizationId, supplier.hotelId, requester);

    if (dto.name && dto.name !== supplier.name) {
      const existing = await this.prisma.supplier.findUnique({
        where: { hotelId_name: { hotelId: supplier.hotelId, name: dto.name } },
      });
      if (existing) {
        throw new ConflictException("Un fournisseur avec ce nom existe déjà pour cet hôtel");
      }
    }

    const updated = await this.prisma.supplier.update({ where: { id }, data: dto });
    return toSupplierResponse(updated);
  }

  private async findWithHotelOrThrow(id: string) {
    const supplier = await this.prisma.supplier.findUnique({ where: { id }, include: { hotel: true } });
    if (!supplier) {
      throw new NotFoundException("Fournisseur introuvable");
    }
    return supplier;
  }
}
