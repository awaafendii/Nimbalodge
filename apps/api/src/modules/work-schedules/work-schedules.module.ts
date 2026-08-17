import { Module } from "@nestjs/common";

import { DepartmentsModule } from "../departments/departments.module";
import { WorkSchedulesController } from "./work-schedules.controller";
import { WorkSchedulesService } from "./work-schedules.service";

@Module({
  imports: [DepartmentsModule],
  controllers: [WorkSchedulesController],
  providers: [WorkSchedulesService],
  exports: [WorkSchedulesService],
})
export class WorkSchedulesModule {}
