import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";

import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { assertInScope } from "../../common/utils/assert-in-scope";
import { PrismaService } from "../../database/prisma.service";
import { toActivityResponse } from "./dto/activity-response.dto";
import { CreateActivityDto } from "./dto/create-activity.dto";
import { UpdateActivityDto } from "./dto/update-activity.dto";

@Injectable()
export class ActivitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(requester: AuthenticatedUser) {
    const activities = await this.prisma.departmentActivity.findMany({
      where: requester.hotelId
        ? { department: { hotelId: requester.hotelId } }
        : { department: { hotel: { organizationId: requester.organizationId } } },
      orderBy: { createdAt: "asc" },
    });
    return activities.map(toActivityResponse);
  }

  async findOne(id: string, requester: AuthenticatedUser) {
    const activity = await this.findWithDepartmentOrThrow(id);
    assertInScope(activity.department.hotel.organizationId, activity.department.hotelId, requester);
    return toActivityResponse(activity);
  }

  async create(dto: CreateActivityDto, requester: AuthenticatedUser) {
    const department = await this.prisma.department.findUnique({
      where: { id: dto.departmentId },
      include: { hotel: true },
    });
    if (!department) {
      throw new BadRequestException("Département invalide");
    }
    assertInScope(department.hotel.organizationId, department.hotelId, requester);

    const existing = await this.prisma.departmentActivity.findUnique({
      where: { departmentId_name: { departmentId: dto.departmentId, name: dto.name } },
    });
    if (existing) {
      throw new ConflictException("Une activité avec ce nom existe déjà pour ce département");
    }

    const activity = await this.prisma.departmentActivity.create({
      data: { departmentId: dto.departmentId, name: dto.name, code: dto.code, description: dto.description },
    });
    return toActivityResponse(activity);
  }

  async update(id: string, dto: UpdateActivityDto, requester: AuthenticatedUser) {
    const activity = await this.findWithDepartmentOrThrow(id);
    assertInScope(activity.department.hotel.organizationId, activity.department.hotelId, requester);

    if (dto.name && dto.name !== activity.name) {
      const existing = await this.prisma.departmentActivity.findUnique({
        where: { departmentId_name: { departmentId: activity.departmentId, name: dto.name } },
      });
      if (existing) {
        throw new ConflictException("Une activité avec ce nom existe déjà pour ce département");
      }
    }

    const updated = await this.prisma.departmentActivity.update({ where: { id }, data: dto });
    return toActivityResponse(updated);
  }

  private async findWithDepartmentOrThrow(id: string) {
    const activity = await this.prisma.departmentActivity.findUnique({
      where: { id },
      include: { department: { include: { hotel: true } } },
    });
    if (!activity) {
      throw new NotFoundException("Activité introuvable");
    }
    return activity;
  }
}
