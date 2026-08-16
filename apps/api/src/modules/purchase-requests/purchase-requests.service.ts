import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { PurchaseRequest, PurchaseRequestStatus } from "@prisma/client";

import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { assertInScope } from "../../common/utils/assert-in-scope";
import { PrismaService } from "../../database/prisma.service";
import { CreatePurchaseRequestDto } from "./dto/create-purchase-request.dto";
import { toPurchaseRequestResponse } from "./dto/purchase-request-response.dto";
import { RejectPurchaseRequestDto } from "./dto/reject-purchase-request.dto";
import { UpdatePurchaseRequestDto } from "./dto/update-purchase-request.dto";

type PurchaseRequestFields = CreatePurchaseRequestDto | UpdatePurchaseRequestDto;

@Injectable()
export class PurchaseRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(requester: AuthenticatedUser) {
    const purchaseRequests = await this.prisma.purchaseRequest.findMany({
      where: requester.hotelId
        ? { hotelId: requester.hotelId }
        : { hotel: { organizationId: requester.organizationId } },
      orderBy: { createdAt: "desc" },
    });
    return purchaseRequests.map(toPurchaseRequestResponse);
  }

  async findOne(id: string, requester: AuthenticatedUser) {
    const purchaseRequest = await this.findWithHotelOrThrow(id);
    assertInScope(purchaseRequest.hotel.organizationId, purchaseRequest.hotelId, requester);
    return toPurchaseRequestResponse(purchaseRequest);
  }

  async create(dto: CreatePurchaseRequestDto, requester: AuthenticatedUser) {
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

    const purchaseRequest = await this.prisma.purchaseRequest.create({
      data: {
        hotelId,
        departmentId: dto.departmentId,
        description: dto.description,
        estimatedAmount: dto.estimatedAmount,
        currency: dto.currency,
        requestedById: requester.id,
      },
    });
    return toPurchaseRequestResponse(purchaseRequest);
  }

  async update(id: string, dto: UpdatePurchaseRequestDto, requester: AuthenticatedUser) {
    const purchaseRequest = await this.findWithHotelOrThrow(id);
    assertInScope(purchaseRequest.hotel.organizationId, purchaseRequest.hotelId, requester);
    if (purchaseRequest.status !== "PENDING") {
      throw new BadRequestException("Seule une demande en attente peut être modifiée");
    }

    await this.validateReferences(purchaseRequest.hotelId, dto);

    const updated = await this.prisma.purchaseRequest.update({ where: { id }, data: dto });
    return toPurchaseRequestResponse(updated);
  }

  async approve(id: string, requester: AuthenticatedUser) {
    const purchaseRequest = await this.transition(id, requester, "PENDING", "approve");
    const updated = await this.prisma.purchaseRequest.update({
      where: { id: purchaseRequest.id },
      data: { status: "APPROVED", approvedById: requester.id, approvedAt: new Date() },
    });
    return toPurchaseRequestResponse(updated);
  }

  async reject(id: string, dto: RejectPurchaseRequestDto, requester: AuthenticatedUser) {
    const purchaseRequest = await this.transition(id, requester, "PENDING", "reject");
    const updated = await this.prisma.purchaseRequest.update({
      where: { id: purchaseRequest.id },
      data: {
        status: "REJECTED",
        approvedById: requester.id,
        approvedAt: new Date(),
        rejectionReason: dto.reason,
      },
    });
    return toPurchaseRequestResponse(updated);
  }

  async cancel(id: string, requester: AuthenticatedUser) {
    const purchaseRequest = await this.transition(id, requester, "PENDING", "cancel");
    const updated = await this.prisma.purchaseRequest.update({
      where: { id: purchaseRequest.id },
      data: { status: "CANCELLED" },
    });
    return toPurchaseRequestResponse(updated);
  }

  private async transition(
    id: string,
    requester: AuthenticatedUser,
    expectedStatus: PurchaseRequestStatus,
    action: string
  ): Promise<PurchaseRequest> {
    const purchaseRequest = await this.findWithHotelOrThrow(id);
    assertInScope(purchaseRequest.hotel.organizationId, purchaseRequest.hotelId, requester);
    if (purchaseRequest.status !== expectedStatus) {
      throw new BadRequestException(
        `Impossible d'effectuer "${action}" depuis le statut ${purchaseRequest.status} (attendu : ${expectedStatus})`
      );
    }
    return purchaseRequest;
  }

  private async validateReferences(hotelId: string, dto: PurchaseRequestFields): Promise<void> {
    if (dto.departmentId) {
      const department = await this.prisma.department.findUnique({ where: { id: dto.departmentId } });
      if (!department || department.hotelId !== hotelId) {
        throw new BadRequestException("Département invalide");
      }
    }
  }

  private async findWithHotelOrThrow(id: string) {
    const purchaseRequest = await this.prisma.purchaseRequest.findUnique({
      where: { id },
      include: { hotel: true },
    });
    if (!purchaseRequest) {
      throw new NotFoundException("Demande d'achat introuvable");
    }
    return purchaseRequest;
  }
}
