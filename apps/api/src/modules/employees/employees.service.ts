import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";

import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { assertInDepartmentScope, assertInScope } from "../../common/utils/assert-in-scope";
import { PrismaService } from "../../database/prisma.service";
import { DepartmentsService } from "../departments/departments.service";
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import { toEmployeeResponse } from "./dto/employee-response.dto";
import { UpdateEmployeeDto } from "./dto/update-employee.dto";

type EmployeeFields = CreateEmployeeDto | UpdateEmployeeDto;

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly departmentsService: DepartmentsService
  ) {}

  async list(requester: AuthenticatedUser) {
    const departmentIds = await this.departmentsService.getDepartmentIds(requester.id);
    const employees = await this.prisma.employee.findMany({
      where: {
        ...(requester.hotelId
          ? { hotelId: requester.hotelId }
          : { hotel: { organizationId: requester.organizationId } }),
        ...(departmentIds.length > 0 ? { departmentId: { in: departmentIds } } : {}),
      },
      orderBy: { createdAt: "asc" },
    });
    return employees.map(toEmployeeResponse);
  }

  async findOne(id: string, requester: AuthenticatedUser) {
    const employee = await this.findWithHotelOrThrow(id);
    assertInScope(employee.hotel.organizationId, employee.hotelId, requester);
    const departmentIds = await this.departmentsService.getDepartmentIds(requester.id);
    assertInDepartmentScope(employee.departmentId, departmentIds);
    return toEmployeeResponse(employee);
  }

  async create(dto: CreateEmployeeDto, requester: AuthenticatedUser) {
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
    assertInDepartmentScope(dto.departmentId ?? null, departmentIds);

    await this.validateReferences(hotelId, dto);

    const employee = await this.prisma.employee.create({
      data: {
        hotelId,
        userId: dto.userId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        position: dto.position,
        departmentId: dto.departmentId,
        employeeNumber: dto.employeeNumber,
        hireDate: dto.hireDate ? new Date(dto.hireDate) : undefined,
        contractType: dto.contractType,
        contractStartDate: dto.contractStartDate ? new Date(dto.contractStartDate) : undefined,
        contractEndDate: dto.contractEndDate ? new Date(dto.contractEndDate) : undefined,
        baseSalary: dto.baseSalary,
        currency: dto.currency,
      },
    });
    return toEmployeeResponse(employee);
  }

  async update(id: string, dto: UpdateEmployeeDto, requester: AuthenticatedUser) {
    const employee = await this.findWithHotelOrThrow(id);
    assertInScope(employee.hotel.organizationId, employee.hotelId, requester);
    const departmentIds = await this.departmentsService.getDepartmentIds(requester.id);
    assertInDepartmentScope(employee.departmentId, departmentIds);
    if (dto.departmentId !== undefined) {
      assertInDepartmentScope(dto.departmentId, departmentIds);
    }

    await this.validateReferences(employee.hotelId, dto, employee.id);

    const updated = await this.prisma.employee.update({
      where: { id },
      data: {
        ...dto,
        hireDate: dto.hireDate ? new Date(dto.hireDate) : undefined,
        contractStartDate: dto.contractStartDate ? new Date(dto.contractStartDate) : undefined,
        contractEndDate: dto.contractEndDate ? new Date(dto.contractEndDate) : undefined,
        terminationDate: dto.terminationDate ? new Date(dto.terminationDate) : undefined,
      },
    });
    return toEmployeeResponse(updated);
  }

  private async validateReferences(hotelId: string, dto: EmployeeFields, excludeEmployeeId?: string): Promise<void> {
    if (dto.departmentId) {
      const department = await this.prisma.department.findUnique({ where: { id: dto.departmentId } });
      if (!department || department.hotelId !== hotelId) {
        throw new BadRequestException("Département invalide");
      }
    }
    if (dto.userId) {
      const existing = await this.prisma.employee.findUnique({ where: { userId: dto.userId } });
      if (existing && existing.id !== excludeEmployeeId) {
        throw new ConflictException("Cet utilisateur est déjà lié à un employé");
      }
      const hotel = await this.prisma.hotel.findUniqueOrThrow({ where: { id: hotelId } });
      const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
      if (!user || user.organizationId !== hotel.organizationId || (user.hotelId && user.hotelId !== hotelId)) {
        throw new BadRequestException("Utilisateur invalide");
      }
    }
  }

  private async findWithHotelOrThrow(id: string) {
    const employee = await this.prisma.employee.findUnique({ where: { id }, include: { hotel: true } });
    if (!employee) {
      throw new NotFoundException("Employé introuvable");
    }
    return employee;
  }
}
