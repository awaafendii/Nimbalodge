import { Module } from "@nestjs/common";

import { DepartmentsModule } from "../departments/departments.module";
import { ExpensesController } from "./expenses.controller";
import { ExpensesService } from "./expenses.service";

@Module({
  imports: [DepartmentsModule],
  controllers: [ExpensesController],
  providers: [ExpensesService],
})
export class ExpensesModule {}
