import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { MaintenanceRequest, MaintenanceRequestStatus } from "@prisma/client";

import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { assertInScope } from "../../common/utils/assert-in-scope";
import { PrismaService } from "../../database/prisma.service";
import { CreateMaintenanceRequestDto } from "./dto/create-maintenance-request.dto";
import { toMaintenanceRequestResponse } from "./dto/maintenance-request-response.dto";
import { RejectMaintenanceRequestDto } from "./dto/reject-maintenance-request.dto";
import { UpdateMaintenanceRequestDto } from "./dto/update-maintenance-request.dto";

type MaintenanceRequestFields = CreateMaintenanceRequestDto | UpdateMaintenanceRequestDto;

@Injectable()
export class MaintenanceRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(requester: AuthenticatedUser) {
    const maintenanceRequests = await this.prisma.maintenanceRequest.findMany({
      where: requester.hotelId
        ? { hotelId: requester.hotelId }
        : { hotel: { organizationId: requester.organizationId } },
      orderBy: { createdAt: "desc" },
    });
    return maintenanceRequests.map(toMaintenanceRequestResponse);
  }

  async findOne(id: string, requester: AuthenticatedUser) {
    const maintenanceRequest = await this.findWithHotelOrThrow(id);
    assertInScope(maintenanceRequest.hotel.organizationId, maintenanceRequest.hotelId, requester);
    return toMaintenanceRequestResponse(maintenanceRequest);
  }

  async create(dto: CreateMaintenanceRequestDto, requester: AuthenticatedUser) {
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

    const maintenanceRequest = await this.prisma.maintenanceRequest.create({
      data: {
        hotelId,
        assetId: dto.assetId,
        roomId: dto.roomId,
        description: dto.description,
        requestedById: requester.id,
      },
    });
    return toMaintenanceRequestResponse(maintenanceRequest);
  }

  async update(id: string, dto: UpdateMaintenanceRequestDto, requester: AuthenticatedUser) {
    const maintenanceRequest = await this.findWithHotelOrThrow(id);
    assertInScope(maintenanceRequest.hotel.organizationId, maintenanceRequest.hotelId, requester);
    if (maintenanceRequest.status !== "PENDING") {
      throw new BadRequestException("Seule une demande en attente peut être modifiée");
    }

    await this.validateReferences(maintenanceRequest.hotelId, dto);

    const updated = await this.prisma.maintenanceRequest.update({ where: { id }, data: dto });
    return toMaintenanceRequestResponse(updated);
  }

  async approve(id: string, requester: AuthenticatedUser) {
    const maintenanceRequest = await this.transition(id, requester, "PENDING", "approve");
    const updated = await this.prisma.maintenanceRequest.update({
      where: { id: maintenanceRequest.id },
      data: { status: "APPROVED", approvedById: requester.id, approvedAt: new Date() },
    });
    return toMaintenanceRequestResponse(updated);
  }

  async reject(id: string, dto: RejectMaintenanceRequestDto, requester: AuthenticatedUser) {
    const maintenanceRequest = await this.transition(id, requester, "PENDING", "reject");
    const updated = await this.prisma.maintenanceRequest.update({
      where: { id: maintenanceRequest.id },
      data: {
        status: "REJECTED",
        approvedById: requester.id,
        approvedAt: new Date(),
        rejectionReason: dto.reason,
      },
    });
    return toMaintenanceRequestResponse(updated);
  }

  async cancel(id: string, requester: AuthenticatedUser) {
    const maintenanceRequest = await this.transition(id, requester, "PENDING", "cancel");
    const updated = await this.prisma.maintenanceRequest.update({
      where: { id: maintenanceRequest.id },
      data: { status: "CANCELLED" },
    });
    return toMaintenanceRequestResponse(updated);
  }

  private async transition(
    id: string,
    requester: AuthenticatedUser,
    expectedStatus: MaintenanceRequestStatus,
    action: string
  ): Promise<MaintenanceRequest> {
    const maintenanceRequest = await this.findWithHotelOrThrow(id);
    assertInScope(maintenanceRequest.hotel.organizationId, maintenanceRequest.hotelId, requester);
    if (maintenanceRequest.status !== expectedStatus) {
      throw new BadRequestException(
        `Impossible d'effectuer "${action}" depuis le statut ${maintenanceRequest.status} (attendu : ${expectedStatus})`
      );
    }
    return maintenanceRequest;
  }

  private async validateReferences(hotelId: string, dto: MaintenanceRequestFields): Promise<void> {
    if (dto.assetId) {
      const asset = await this.prisma.asset.findUnique({ where: { id: dto.assetId } });
      if (!asset || asset.hotelId !== hotelId) {
        throw new BadRequestException("Actif invalide");
      }
    }
    if (dto.roomId) {
      const room = await this.prisma.room.findUnique({ where: { id: dto.roomId } });
      if (!room || room.hotelId !== hotelId) {
        throw new BadRequestException("Chambre invalide");
      }
    }
  }

  private async findWithHotelOrThrow(id: string) {
    const maintenanceRequest = await this.prisma.maintenanceRequest.findUnique({
      where: { id },
      include: { hotel: true },
    });
    if (!maintenanceRequest) {
      throw new NotFoundException("Demande de maintenance introuvable");
    }
    return maintenanceRequest;
  }
}
