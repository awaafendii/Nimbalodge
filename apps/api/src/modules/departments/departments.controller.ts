import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { DepartmentsService } from "./departments.service";
import { CreateDepartmentDto } from "./dto/create-department.dto";
import { UpdateDepartmentDto } from "./dto/update-department.dto";

@Controller("departments")
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  @RequirePermissions("departments.view")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.departmentsService.list(user);
  }

  @Get(":id")
  @RequirePermissions("departments.view")
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.departmentsService.findOne(id, user);
  }

  @Post()
  @RequirePermissions("departments.create")
  create(@Body() dto: CreateDepartmentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.departmentsService.create(dto, user);
  }

  @Patch(":id")
  @RequirePermissions("departments.update")
  update(@Param("id") id: string, @Body() dto: UpdateDepartmentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.departmentsService.update(id, dto, user);
  }

  @Post(":id/users/:userId")
  @RequirePermissions("departments.update")
  assignUser(@Param("id") id: string, @Param("userId") userId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.departmentsService.assignUser(id, userId, user);
  }

  @Delete(":id/users/:userId")
  @RequirePermissions("departments.update")
  removeUser(@Param("id") id: string, @Param("userId") userId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.departmentsService.removeUser(id, userId, user);
  }
}
