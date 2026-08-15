import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";

import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { PrismaService } from "../../database/prisma.service";
import { toAttendanceResponse } from "./dto/attendance-response.dto";
import { CreateAttendanceDto } from "./dto/create-attendance.dto";

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async list(requester: AuthenticatedUser) {
    const attendances = await this.prisma.attendance.findMany({
      where: requester.hotelId
        ? { hotelId: requester.hotelId }
        : { hotel: { organizationId: requester.organizationId } },
      orderBy: { clockIn: "desc" },
    });
    return attendances.map(toAttendanceResponse);
  }

  async findOne(id: string, requester: AuthenticatedUser) {
    const attendance = await this.findWithHotelOrThrow(id);
    this.assertInScope(attendance.hotel.organizationId, attendance.hotelId, requester);
    return toAttendanceResponse(attendance);
  }

  async create(dto: CreateAttendanceDto, requester: AuthenticatedUser) {
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

    const open = await this.prisma.attendance.findFirst({
      where: { employeeId: dto.employeeId, clockOut: null },
    });
    if (open) {
      throw new ConflictException("Un pointage est déjà ouvert pour cet employé");
    }

    const attendance = await this.prisma.attendance.create({
      data: {
        hotelId,
        employeeId: dto.employeeId,
        clockIn: dto.clockIn ? new Date(dto.clockIn) : undefined,
        notes: dto.notes,
      },
    });
    return toAttendanceResponse(attendance);
  }

  async clockOut(id: string, requester: AuthenticatedUser) {
    const attendance = await this.findWithHotelOrThrow(id);
    this.assertInScope(attendance.hotel.organizationId, attendance.hotelId, requester);
    if (attendance.clockOut) {
      throw new BadRequestException("Ce pointage est déjà fermé");
    }
    const updated = await this.prisma.attendance.update({
      where: { id: attendance.id },
      data: { clockOut: new Date() },
    });
    return toAttendanceResponse(updated);
  }

  private async findWithHotelOrThrow(id: string) {
    const attendance = await this.prisma.attendance.findUnique({ where: { id }, include: { hotel: true } });
    if (!attendance) {
      throw new NotFoundException("Pointage introuvable");
    }
    return attendance;
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
