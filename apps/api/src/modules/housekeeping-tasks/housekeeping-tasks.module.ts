import { Module } from "@nestjs/common";

import { HousekeepingTasksController } from "./housekeeping-tasks.controller";
import { HousekeepingTasksService } from "./housekeeping-tasks.service";

@Module({
  controllers: [HousekeepingTasksController],
  providers: [HousekeepingTasksService],
})
export class HousekeepingTasksModule {}
