import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { HousekeepingTask } from "@prisma/client";

import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { assertInScope } from "../../common/utils/assert-in-scope";
import { PrismaService } from "../../database/prisma.service";
import { CreateHousekeepingTaskDto } from "./dto/create-housekeeping-task.dto";
import { toHousekeepingTaskResponse } from "./dto/housekeeping-task-response.dto";

@Injectable()
export class HousekeepingTasksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(requester: AuthenticatedUser) {
    const tasks = await this.prisma.housekeepingTask.findMany({
      where: requester.hotelId
        ? { hotelId: requester.hotelId }
        : { hotel: { organizationId: requester.organizationId } },
      orderBy: { createdAt: "desc" },
    });
    return tasks.map(toHousekeepingTaskResponse);
  }

  async findOne(id: string, requester: AuthenticatedUser) {
    const task = await this.findWithHotelOrThrow(id);
    assertInScope(task.hotel.organizationId, task.hotelId, requester);
    return toHousekeepingTaskResponse(task);
  }

  // "à nettoyer/propres/inspectées" (§25) — statut par chambre calculé à la demande à partir de sa
  // HousekeepingTask la plus récente, jamais dénormalisé sur Room (même principe que la
  // disponibilité Room calculée depuis Reservation, Phase 7). Une chambre sans tâche, ou dont la
  // plus récente est INSPECTED, est reportée "AVAILABLE".
  async dashboard(requester: AuthenticatedUser) {
    const hotelWhere = requester.hotelId
      ? { hotelId: requester.hotelId }
      : { hotel: { organizationId: requester.organizationId } };

    const [rooms, tasks] = await Promise.all([
      this.prisma.room.findMany({ where: { ...hotelWhere, isActive: true }, orderBy: { number: "asc" } }),
      this.prisma.housekeepingTask.findMany({ where: hotelWhere, orderBy: { createdAt: "desc" } }),
    ]);

    const latestTaskByRoom = new Map<string, HousekeepingTask>();
    for (const task of tasks) {
      if (!latestTaskByRoom.has(task.roomId)) {
        latestTaskByRoom.set(task.roomId, task);
      }
    }

    return rooms.map((room) => {
      const latest = latestTaskByRoom.get(room.id);
      const status = !latest || latest.status === "INSPECTED" ? "AVAILABLE" : latest.status;
      return {
        roomId: room.id,
        roomNumber: room.number,
        status,
        taskId: latest?.id ?? null,
      };
    });
  }

  async create(dto: CreateHousekeepingTaskDto, requester: AuthenticatedUser) {
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

    const room = await this.prisma.room.findUnique({ where: { id: dto.roomId } });
    if (!room || room.hotelId !== hotelId || !room.isActive) {
      throw new BadRequestException("Chambre invalide");
    }

    const task = await this.prisma.housekeepingTask.create({
      data: {
        hotelId,
        roomId: dto.roomId,
        notes: dto.notes,
        createdById: requester.id,
      },
    });
    return toHousekeepingTaskResponse(task);
  }

  async clean(id: string, requester: AuthenticatedUser) {
    const task = await this.transition(id, requester, "TO_CLEAN", "clean");
    const updated = await this.prisma.housekeepingTask.update({
      where: { id: task.id },
      data: { status: "CLEANED", cleanedById: requester.id, cleanedAt: new Date() },
    });
    return toHousekeepingTaskResponse(updated);
  }

  async inspect(id: string, requester: AuthenticatedUser) {
    const task = await this.transition(id, requester, "CLEANED", "inspect");
    const updated = await this.prisma.housekeepingTask.update({
      where: { id: task.id },
      data: { status: "INSPECTED", inspectedById: requester.id, inspectedAt: new Date() },
    });
    return toHousekeepingTaskResponse(updated);
  }

  private async transition(
    id: string,
    requester: AuthenticatedUser,
    expectedStatus: HousekeepingTask["status"],
    action: string
  ): Promise<HousekeepingTask> {
    const task = await this.findWithHotelOrThrow(id);
    assertInScope(task.hotel.organizationId, task.hotelId, requester);
    if (task.status !== expectedStatus) {
      throw new BadRequestException(
        `Impossible d'effectuer "${action}" depuis le statut ${task.status} (attendu : ${expectedStatus})`
      );
    }
    return task;
  }

  private async findWithHotelOrThrow(id: string) {
    const task = await this.prisma.housekeepingTask.findUnique({ where: { id }, include: { hotel: true } });
    if (!task) {
      throw new NotFoundException("Tâche de ménage introuvable");
    }
    return task;
  }
}
