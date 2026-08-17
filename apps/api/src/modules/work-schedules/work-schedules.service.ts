import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";

import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { assertInDepartmentScope, assertInScope } from "../../common/utils/assert-in-scope";
import { PrismaService } from "../../database/prisma.service";
import { DepartmentsService } from "../departments/departments.service";
import { CreateWorkScheduleDto } from "./dto/create-work-schedule.dto";
import { toWorkScheduleResponse } from "./dto/work-schedule-response.dto";
import { UpdateWorkScheduleDto } from "./dto/update-work-schedule.dto";

type WorkScheduleFields = CreateWorkScheduleDto | UpdateWorkScheduleDto;

@Injectable()
export class WorkSchedulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly departmentsService: DepartmentsService
  ) {}

  // WorkSchedule n'a pas de departmentId direct (voir prisma/schema.prisma) — le scope
  // départemental (Étape 5) passe donc par l'employé planifié (employee.departmentId), en
  // filtrage relationnel ici et via l'employé déjà chargé ailleurs (create/update).
  async list(requester: AuthenticatedUser) {
    const departmentIds = await this.departmentsService.getDepartmentIds(requester.id);
    const schedules = await this.prisma.workSchedule.findMany({
      where: {
        ...(requester.hotelId
          ? { hotelId: requester.hotelId }
          : { hotel: { organizationId: requester.organizationId } }),
        ...(departmentIds.length > 0 ? { employee: { departmentId: { in: departmentIds } } } : {}),
      },
      orderBy: { startAt: "desc" },
    });
    return schedules.map(toWorkScheduleResponse);
  }

  async findOne(id: string, requester: AuthenticatedUser) {
    const schedule = await this.findWithHotelOrThrow(id);
    assertInScope(schedule.hotel.organizationId, schedule.hotelId, requester);
    const departmentIds = await this.departmentsService.getDepartmentIds(requester.id);
    assertInDepartmentScope(schedule.employee.departmentId, departmentIds);
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

    const departmentIds = await this.departmentsService.getDepartmentIds(requester.id);
    await this.validateReferences(hotelId, dto, departmentIds);

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
    assertInScope(schedule.hotel.organizationId, schedule.hotelId, requester);
    const departmentIds = await this.departmentsService.getDepartmentIds(requester.id);
    assertInDepartmentScope(schedule.employee.departmentId, departmentIds);

    await this.validateReferences(schedule.hotelId, dto, departmentIds);

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

  private async validateReferences(
    hotelId: string,
    dto: WorkScheduleFields,
    departmentIds: string[]
  ): Promise<void> {
    if (dto.employeeId) {
      const employee = await this.prisma.employee.findUnique({ where: { id: dto.employeeId } });
      if (!employee || employee.hotelId !== hotelId) {
        throw new BadRequestException("Employé invalide");
      }
      assertInDepartmentScope(employee.departmentId, departmentIds);
    }
  }

  private async findWithHotelOrThrow(id: string) {
    const schedule = await this.prisma.workSchedule.findUnique({
      where: { id },
      include: { hotel: true, employee: true },
    });
    if (!schedule) {
      throw new NotFoundException("Planning introuvable");
    }
    return schedule;
  }
}
