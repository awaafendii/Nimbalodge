import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";

import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { PrismaService } from "../../database/prisma.service";
import { CreateWorkScheduleDto } from "./dto/create-work-schedule.dto";
import { toWorkScheduleResponse } from "./dto/work-schedule-response.dto";
import { UpdateWorkScheduleDto } from "./dto/update-work-schedule.dto";

type WorkScheduleFields = CreateWorkScheduleDto | UpdateWorkScheduleDto;

@Injectable()
export class WorkSchedulesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(requester: AuthenticatedUser) {
    const schedules = await this.prisma.workSchedule.findMany({
      where: requester.hotelId
        ? { hotelId: requester.hotelId }
        : { hotel: { organizationId: requester.organizationId } },
      orderBy: { startAt: "desc" },
    });
    return schedules.map(toWorkScheduleResponse);
  }

  async findOne(id: string, requester: AuthenticatedUser) {
    const schedule = await this.findWithHotelOrThrow(id);
    this.assertInScope(schedule.hotel.organizationId, schedule.hotelId, requester);
    return toWorkScheduleResponse(schedule);
  }

  async create(dto: CreateWorkScheduleDto, requester: AuthenticatedUser) {
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

    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);
    if (startAt >= endAt) {
      throw new BadRequestException("startAt doit être antérieur à endAt");
    }

    const schedule = await this.prisma.workSchedule.create({
      data: { hotelId, employeeId: dto.employeeId, startAt, endAt, notes: dto.notes },
    });
    return toWorkScheduleResponse(schedule);
  }

  async update(id: string, dto: UpdateWorkScheduleDto, requester: AuthenticatedUser) {
    const schedule = await this.findWithHotelOrThrow(id);
    this.assertInScope(schedule.hotel.organizationId, schedule.hotelId, requester);

    await this.validateReferences(schedule.hotelId, dto);

    const startAt = dto.startAt ? new Date(dto.startAt) : schedule.startAt;
    const endAt = dto.endAt ? new Date(dto.endAt) : schedule.endAt;
    if (startAt >= endAt) {
      throw new BadRequestException("startAt doit être antérieur à endAt");
    }

    const updated = await this.prisma.workSchedule.update({
      where: { id },
      data: {
        employeeId: dto.employeeId,
        startAt: dto.startAt ? startAt : undefined,
        endAt: dto.endAt ? endAt : undefined,
        notes: dto.notes,
      },
    });
    return toWorkScheduleResponse(updated);
  }

  private async validateReferences(hotelId: string, dto: WorkScheduleFields): Promise<void> {
    if (dto.employeeId) {
      const employee = await this.prisma.employee.findUnique({ where: { id: dto.employeeId } });
      if (!employee || employee.hotelId !== hotelId) {
        throw new BadRequestException("Employé invalide");
      }
    }
  }

  private async findWithHotelOrThrow(id: string) {
    const schedule = await this.prisma.workSchedule.findUnique({ where: { id }, include: { hotel: true } });
    if (!schedule) {
      throw new NotFoundException("Planning introuvable");
    }
    return schedule;
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
