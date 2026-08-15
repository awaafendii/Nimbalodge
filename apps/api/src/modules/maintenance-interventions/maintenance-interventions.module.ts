import { Module } from "@nestjs/common";

import { MaintenanceInterventionsController } from "./maintenance-interventions.controller";
import { MaintenanceInterventionsService } from "./maintenance-interventions.service";

@Module({
  controllers: [MaintenanceInterventionsController],
  providers: [MaintenanceInterventionsService],
})
export class MaintenanceInterventionsModule {}
