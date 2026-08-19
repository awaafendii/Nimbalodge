import { Module } from "@nestjs/common";

import { HospitalityInsightsService } from "./hospitality-insights.service";

@Module({
  providers: [HospitalityInsightsService],
  exports: [HospitalityInsightsService],
})
export class HospitalityInsightsModule {}
