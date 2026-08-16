import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { MaintenanceIntervention, MaintenanceInterventionStatus } from "@prisma/client";

import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { assertInScope } from "../../common/utils/assert-in-scope";
import { PrismaService } from "../../database/prisma.service";
import { CreateMaintenanceInterventionDto } from "./dto/create-maintenance-intervention.dto";
import { ListMaintenanceInterventionsQueryDto } from "./dto/list-maintenance-interventions-query.dto";
import { toMaintenanceInterventionResponse } from "./dto/maintenance-intervention-response.dto";
import { UpdateMaintenanceInterventionDto } from "./dto/update-maintenance-intervention.dto";

type MaintenanceInterventionFields = CreateMaintenanceInterventionDto | UpdateMaintenanceInterventionDto;

@Injectable()
export class MaintenanceInterventionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListMaintenanceInterventionsQueryDto, requester: AuthenticatedUser) {
    const interventions = await this.prisma.maintenanceIntervention.findMany({
      where: {
        ...(requester.hotelId
          ? { hotelId: requester.hotelId }
          : { hotel: { organizationId: requester.organizationId } }),
        ...(query.assetId ? { assetId: query.assetId } : {}),
        ...(query.roomId ? { roomId: query.roomId } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
    return interventions.map(toMaintenanceInterventionResponse);
  }

  async findOne(id: string, requester: AuthenticatedUser) {
    const intervention = await this.findWithHotelOrThrow(id);
    assertInScope(intervention.hotel.organizationId, intervention.hotelId, requester);
    return toMaintenanceInterventionResponse(intervention);
  }

  async create(dto: CreateMaintenanceInterventionDto, requester: AuthenticatedUser) {
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

    const intervention = await this.prisma.maintenanceIntervention.create({
      data: {
        hotelId,
        assetId: dto.assetId,
        roomId: dto.roomId,
        maintenanceRequestId: dto.maintenanceRequestId,
        type: dto.type,
        scheduledDate: dto.scheduledDate ? new Date(dto.scheduledDate) : undefined,
        cost: dto.cost,
        notes: dto.notes,
        createdById: requester.id,
      },
    });
    return toMaintenanceInterventionResponse(intervention);
  }

  async update(id: string, dto: UpdateMaintenanceInterventionDto, requester: AuthenticatedUser) {
    const intervention = await this.findWithHotelOrThrow(id);
    assertInScope(intervention.hotel.organizationId, intervention.hotelId, requester);
    if (intervention.status !== "SCHEDULED") {
      throw new BadRequestException("Seule une intervention planifiée peut être modifiée");
    }

    await this.validateReferences(intervention.hotelId, dto);

    const updated = await this.prisma.maintenanceIntervention.update({
      where: { id },
      data: {
        type: dto.type,
        assetId: dto.assetId,
        roomId: dto.roomId,
        maintenanceRequestId: dto.maintenanceRequestId,
        scheduledDate: dto.scheduledDate ? new Date(dto.scheduledDate) : undefined,
        cost: dto.cost,
        notes: dto.notes,
      },
    });
    return toMaintenanceInterventionResponse(updated);
  }

  async start(id: string, requester: AuthenticatedUser) {
    const intervention = await this.transition(id, requester, "SCHEDULED", "start");
    const updated = await this.prisma.maintenanceIntervention.update({
      where: { id: intervention.id },
      data: { status: "IN_PROGRESS" },
    });
    return toMaintenanceInterventionResponse(updated);
  }

  async complete(id: string, requester: AuthenticatedUser) {
    const intervention = await this.transition(id, requester, "IN_PROGRESS", "complete");
    const updated = await this.prisma.maintenanceIntervention.update({
      where: { id: intervention.id },
      data: { status: "COMPLETED", completedDate: new Date(), performedById: requester.id },
    });
    return toMaintenanceInterventionResponse(updated);
  }

  // Pas via transition() (statut attendu unique) : SCHEDULED et IN_PROGRESS sont tous deux
  // annulables, COMPLETED ne l'est plus — même principe que Reservation.cancel() (Phase 7).
  async cancel(id: string, requester: AuthenticatedUser) {
    const intervention = await this.findWithHotelOrThrow(id);
    assertInScope(intervention.hotel.organizationId, intervention.hotelId, requester);
    if (intervention.status !== "SCHEDULED" && intervention.status !== "IN_PROGRESS") {
      throw new BadRequestException(
        `Impossible d'annuler une intervention au statut ${intervention.status}`
      );
    }
    const updated = await this.prisma.maintenanceIntervention.update({
      where: { id: intervention.id },
      data: { status: "CANCELLED" },
    });
    return toMaintenanceInterventionResponse(updated);
  }

  private async transition(
    id: string,
    requester: AuthenticatedUser,
    expectedStatus: MaintenanceInterventionStatus,
    action: string
  ): Promise<MaintenanceIntervention> {
    const intervention = await this.findWithHotelOrThrow(id);
    assertInScope(intervention.hotel.organizationId, intervention.hotelId, requester);
    if (intervention.status !== expectedStatus) {
      throw new BadRequestException(
        `Impossible d'effectuer "${action}" depuis le statut ${intervention.status} (attendu : ${expectedStatus})`
      );
    }
    return intervention;
  }

  private async validateReferences(hotelId: string, dto: MaintenanceInterventionFields): Promise<void> {
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
    if (dto.maintenanceRequestId) {
      const maintenanceRequest = await this.prisma.maintenanceRequest.findUnique({
        where: { id: dto.maintenanceRequestId },
      });
      if (!maintenanceRequest || maintenanceRequest.hotelId !== hotelId) {
        throw new BadRequestException("Demande de maintenance invalide");
      }
      if (maintenanceRequest.status !== "APPROVED") {
        throw new BadRequestException("La demande de maintenance référencée doit être approuvée");
      }
    }
  }

  private async findWithHotelOrThrow(id: string) {
    const intervention = await this.prisma.maintenanceIntervention.findUnique({
      where: { id },
      include: { hotel: true },
    });
    if (!intervention) {
      throw new NotFoundException("Intervention introuvable");
    }
    return intervention;
  }
}
