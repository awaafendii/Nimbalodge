import { Module } from "@nestjs/common";

import { HrInsightsService } from "./hr-insights.service";

@Module({
  providers: [HrInsightsService],
  exports: [HrInsightsService],
})
export class HrInsightsModule {}
