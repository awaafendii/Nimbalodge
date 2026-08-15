import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { LeaveRequest, LeaveStatus } from "@prisma/client";

import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { PrismaService } from "../../database/prisma.service";
import { CreateLeaveRequestDto } from "./dto/create-leave-request.dto";
import { toLeaveRequestResponse } from "./dto/leave-request-response.dto";
import { RejectLeaveRequestDto } from "./dto/reject-leave-request.dto";
import { UpdateLeaveRequestDto } from "./dto/update-leave-request.dto";

@Injectable()
export class LeaveRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(requester: AuthenticatedUser) {
    const leaveRequests = await this.prisma.leaveRequest.findMany({
      where: requester.hotelId
        ? { hotelId: requester.hotelId }
        : { hotel: { organizationId: requester.organizationId } },
      orderBy: { createdAt: "desc" },
    });
    return leaveRequests.map(toLeaveRequestResponse);
  }

  async findOne(id: string, requester: AuthenticatedUser) {
    const leaveRequest = await this.findWithHotelOrThrow(id);
    this.assertInScope(leaveRequest.hotel.organizationId, leaveRequest.hotelId, requester);
    return toLeaveRequestResponse(leaveRequest);
  }

  async create(dto: CreateLeaveRequestDto, requester: AuthenticatedUser) {
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

    const employee = await this.prisma.employee.findUnique({ where: { id: dto.employeeId } });
    if (!employee || employee.hotelId !== hotelId) {
      throw new BadRequestException("Employé invalide");
    }

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (startDate > endDate) {
      throw new BadRequestException("startDate doit être antérieure ou égale à endDate");
    }

    const leaveRequest = await this.prisma.leaveRequest.create({
      data: {
        hotelId,
        employeeId: dto.employeeId,
        type: dto.type,
        startDate,
        endDate,
        reason: dto.reason,
        createdById: requester.id,
      },
    });
    return toLeaveRequestResponse(leaveRequest);
  }

  async update(id: string, dto: UpdateLeaveRequestDto, requester: AuthenticatedUser) {
    const leaveRequest = await this.findWithHotelOrThrow(id);
    this.assertInScope(leaveRequest.hotel.organizationId, leaveRequest.hotelId, requester);
    if (leaveRequest.status !== "PENDING") {
      throw new BadRequestException("Seule une demande en attente peut être modifiée");
    }

    const startDate = dto.startDate ? new Date(dto.startDate) : leaveRequest.startDate;
    const endDate = dto.endDate ? new Date(dto.endDate) : leaveRequest.endDate;
    if (startDate > endDate) {
      throw new BadRequestException("startDate doit être antérieure ou égale à endDate");
    }

    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        type: dto.type,
        startDate: dto.startDate ? startDate : undefined,
        endDate: dto.endDate ? endDate : undefined,
        reason: dto.reason,
      },
    });
    return toLeaveRequestResponse(updated);
  }

  async approve(id: string, requester: AuthenticatedUser) {
    const leaveRequest = await this.transition(id, requester, "PENDING", "approve");
    const updated = await this.prisma.leaveRequest.update({
      where: { id: leaveRequest.id },
      data: { status: "APPROVED", approvedById: requester.id, approvedAt: new Date() },
    });
    return toLeaveRequestResponse(updated);
  }

  async reject(id: string, dto: RejectLeaveRequestDto, requester: AuthenticatedUser) {
    const leaveRequest = await this.transition(id, requester, "PENDING", "reject");
    const updated = await this.prisma.leaveRequest.update({
      where: { id: leaveRequest.id },
      data: {
        status: "REJECTED",
        approvedById: requester.id,
        approvedAt: new Date(),
        rejectionReason: dto.reason,
      },
    });
    return toLeaveRequestResponse(updated);
  }

  // PENDING uniquement — annuler un congé déjà APPROVED est hors périmètre cette phase (limite
  // documentée, voir docs/architecture/phase-8-hr-payroll.md).
  async cancel(id: string, requester: AuthenticatedUser) {
    const leaveRequest = await this.transition(id, requester, "PENDING", "cancel");
    const updated = await this.prisma.leaveRequest.update({
      where: { id: leaveRequest.id },
      data: { status: "CANCELLED" },
    });
    return toLeaveRequestResponse(updated);
  }

  private async transition(
    id: string,
    requester: AuthenticatedUser,
    expectedStatus: LeaveStatus,
    action: string
  ): Promise<LeaveRequest> {
    const leaveRequest = await this.findWithHotelOrThrow(id);
    this.assertInScope(leaveRequest.hotel.organizationId, leaveRequest.hotelId, requester);
    if (leaveRequest.status !== expectedStatus) {
      throw new BadRequestException(
        `Impossible d'effectuer "${action}" depuis le statut ${leaveRequest.status} (attendu : ${expectedStatus})`
      );
    }
    return leaveRequest;
  }

  private async findWithHotelOrThrow(id: string) {
    const leaveRequest = await this.prisma.leaveRequest.findUnique({ where: { id }, include: { hotel: true } });
    if (!leaveRequest) {
      throw new NotFoundException("Demande de congé introuvable");
    }
    return leaveRequest;
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
