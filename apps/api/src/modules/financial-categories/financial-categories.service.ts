import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";

import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { assertInScope } from "../../common/utils/assert-in-scope";
import { PrismaService } from "../../database/prisma.service";
import { CreateFinancialCategoryDto } from "./dto/create-financial-category.dto";
import { toFinancialCategoryResponse } from "./dto/financial-category-response.dto";
import { UpdateFinancialCategoryDto } from "./dto/update-financial-category.dto";

@Injectable()
export class FinancialCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(requester: AuthenticatedUser) {
    const categories = await this.prisma.financialCategory.findMany({
      where: requester.hotelId
        ? { hotelId: requester.hotelId }
        : { hotel: { organizationId: requester.organizationId } },
      orderBy: { createdAt: "asc" },
    });
    return categories.map(toFinancialCategoryResponse);
  }

  async findOne(id: string, requester: AuthenticatedUser) {
    const category = await this.findWithHotelOrThrow(id);
    assertInScope(category.hotel.organizationId, category.hotelId, requester);
    return toFinancialCategoryResponse(category);
  }

  async create(dto: CreateFinancialCategoryDto, requester: AuthenticatedUser) {
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

    const existing = await this.prisma.financialCategory.findUnique({
      where: { hotelId_name: { hotelId, name: dto.name } },
    });
    if (existing) {
      throw new ConflictException("Une catégorie avec ce nom existe déjà pour cet hôtel");
    }

    const category = await this.prisma.financialCategory.create({
      data: { hotelId, type: dto.type, name: dto.name, code: dto.code, description: dto.description },
    });
    return toFinancialCategoryResponse(category);
  }

  async update(id: string, dto: UpdateFinancialCategoryDto, requester: AuthenticatedUser) {
    const category = await this.findWithHotelOrThrow(id);
    assertInScope(category.hotel.organizationId, category.hotelId, requester);

    if (dto.name && dto.name !== category.name) {
      const existing = await this.prisma.financialCategory.findUnique({
        where: { hotelId_name: { hotelId: category.hotelId, name: dto.name } },
      });
      if (existing) {
        throw new ConflictException("Une catégorie avec ce nom existe déjà pour cet hôtel");
      }
    }

    const updated = await this.prisma.financialCategory.update({ where: { id }, data: dto });
    return toFinancialCategoryResponse(updated);
  }

  private async findWithHotelOrThrow(id: string) {
    const category = await this.prisma.financialCategory.findUnique({ where: { id }, include: { hotel: true } });
    if (!category) {
      throw new NotFoundException("Catégorie introuvable");
    }
    return category;
  }
}
