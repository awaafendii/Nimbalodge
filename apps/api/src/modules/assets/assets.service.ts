import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";

import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { assertInScope } from "../../common/utils/assert-in-scope";
import { PrismaService } from "../../database/prisma.service";
import { CreateAssetDto } from "./dto/create-asset.dto";
import { toAssetResponse } from "./dto/asset-response.dto";
import { UpdateAssetDto } from "./dto/update-asset.dto";

type AssetFields = CreateAssetDto | UpdateAssetDto;

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(requester: AuthenticatedUser) {
    const assets = await this.prisma.asset.findMany({
      where: requester.hotelId
        ? { hotelId: requester.hotelId }
        : { hotel: { organizationId: requester.organizationId } },
      orderBy: { createdAt: "asc" },
    });
    return assets.map(toAssetResponse);
  }

  async findOne(id: string, requester: AuthenticatedUser) {
    const asset = await this.findWithHotelOrThrow(id);
    assertInScope(asset.hotel.organizationId, asset.hotelId, requester);
    return toAssetResponse(asset);
  }

  async create(dto: CreateAssetDto, requester: AuthenticatedUser) {
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

    const asset = await this.prisma.asset.create({
      data: {
        hotelId,
        roomId: dto.roomId,
        name: dto.name,
        category: dto.category,
        serialNumber: dto.serialNumber,
        purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : undefined,
        notes: dto.notes,
      },
    });
    return toAssetResponse(asset);
  }

  async update(id: string, dto: UpdateAssetDto, requester: AuthenticatedUser) {
    const asset = await this.findWithHotelOrThrow(id);
    assertInScope(asset.hotel.organizationId, asset.hotelId, requester);

    await this.validateReferences(asset.hotelId, dto);

    const updated = await this.prisma.asset.update({
      where: { id },
      data: {
        ...dto,
        purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : undefined,
      },
    });
    return toAssetResponse(updated);
  }

  private async validateReferences(hotelId: string, dto: AssetFields): Promise<void> {
    if (dto.roomId) {
      const room = await this.prisma.room.findUnique({ where: { id: dto.roomId } });
      if (!room || room.hotelId !== hotelId) {
        throw new BadRequestException("Chambre invalide");
      }
    }
  }

  private async findWithHotelOrThrow(id: string) {
    const asset = await this.prisma.asset.findUnique({ where: { id }, include: { hotel: true } });
    if (!asset) {
      throw new NotFoundException("Actif introuvable");
    }
    return asset;
  }
}
