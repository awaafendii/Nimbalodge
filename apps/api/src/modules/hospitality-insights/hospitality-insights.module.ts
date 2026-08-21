import { Module } from "@nestjs/common";

import { HospitalityInsightsController } from "./hospitality-insights.controller";
import { HospitalityInsightsService } from "./hospitality-insights.service";

@Module({
  controllers: [HospitalityInsightsController],
  providers: [HospitalityInsightsService],
  exports: [HospitalityInsightsService],
})
export class HospitalityInsightsModule {}
