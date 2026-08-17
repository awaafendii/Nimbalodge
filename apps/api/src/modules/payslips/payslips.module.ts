import { Module } from "@nestjs/common";

import { DepartmentsModule } from "../departments/departments.module";
import { PayslipsController } from "./payslips.controller";
import { PayslipsService } from "./payslips.service";

@Module({
  imports: [DepartmentsModule],
  controllers: [PayslipsController],
  providers: [PayslipsService],
  exports: [PayslipsService],
})
export class PayslipsModule {}
