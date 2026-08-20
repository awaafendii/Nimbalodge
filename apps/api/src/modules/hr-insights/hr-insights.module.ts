import { Module } from "@nestjs/common";

import { DepartmentsModule } from "../departments/departments.module";
import { HrInsightsService } from "./hr-insights.service";

@Module({
  imports: [DepartmentsModule],
  providers: [HrInsightsService],
  exports: [HrInsightsService],
})
export class HrInsightsModule {}
