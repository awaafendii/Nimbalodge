import { Module } from "@nestjs/common";

import { AnomalyDetectionService } from "./anomaly-detection.service";

@Module({
  providers: [AnomalyDetectionService],
  exports: [AnomalyDetectionService],
})
export class AnomalyDetectionModule {}
