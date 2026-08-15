import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { CreatePayslipDto } from "./dto/create-payslip.dto";
import { MarkPaidPayslipDto } from "./dto/mark-paid-payslip.dto";
import { UpdatePayslipDto } from "./dto/update-payslip.dto";
import { PayslipsService } from "./payslips.service";

@Controller("payslips")
export class PayslipsController {
  constructor(private readonly payslipsService: PayslipsService) {}

  @Get()
  @RequirePermissions("payslips.view")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.payslipsService.list(user);
  }

  @Get(":id")
  @RequirePermissions("payslips.view")
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.payslipsService.findOne(id, user);
  }

  @Post()
  @RequirePermissions("payslips.create")
  create(@Body() dto: CreatePayslipDto, @CurrentUser() user: AuthenticatedUser) {
    return this.payslipsService.create(dto, user);
  }

  @Patch(":id")
  @RequirePermissions("payslips.update")
  update(@Param("id") id: string, @Body() dto: UpdatePayslipDto, @CurrentUser() user: AuthenticatedUser) {
    return this.payslipsService.update(id, dto, user);
  }

  @Post(":id/finalize")
  @RequirePermissions("payslips.finalize")
  finalize(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.payslipsService.finalize(id, user);
  }

  @Post(":id/mark-paid")
  @RequirePermissions("payslips.mark-paid")
  markPaid(@Param("id") id: string, @Body() dto: MarkPaidPayslipDto, @CurrentUser() user: AuthenticatedUser) {
    return this.payslipsService.markPaid(id, dto, user);
  }
}
