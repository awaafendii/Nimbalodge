import type { Employee } from "@prisma/client";

export function toEmployeeResponse(employee: Employee) {
  return {
    id: employee.id,
    hotelId: employee.hotelId,
    userId: employee.userId,
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.email,
    phone: employee.phone,
    position: employee.position,
    departmentId: employee.departmentId,
    employeeNumber: employee.employeeNumber,
    hireDate: employee.hireDate,
    contractType: employee.contractType,
    contractStartDate: employee.contractStartDate,
    contractEndDate: employee.contractEndDate,
    baseSalary: employee.baseSalary,
    currency: employee.currency,
    isActive: employee.isActive,
    terminationDate: employee.terminationDate,
    terminationReason: employee.terminationReason,
    createdAt: employee.createdAt,
  };
}
