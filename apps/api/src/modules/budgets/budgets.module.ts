import { Module } from "@nestjs/common";

import { DepartmentsModule } from "../departments/departments.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { BudgetsController } from "./budgets.controller";
import { BudgetsService } from "./budgets.service";

@Module({
  imports: [NotificationsModule, DepartmentsModule],
  controllers: [BudgetsController],
  providers: [BudgetsService],
})
export class BudgetsModule {}
