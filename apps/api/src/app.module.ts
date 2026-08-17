import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";

import { AuditInterceptor } from "./common/interceptors/audit.interceptor";
import { IdempotencyInterceptor } from "./common/interceptors/idempotency.interceptor";
import { validateEnv } from "./config/env.validation";
import { PrismaModule } from "./database/prisma.module";
import { ActivitiesModule } from "./modules/activities/activities.module";
import { AssetsModule } from "./modules/assets/assets.module";
import { AttendanceModule } from "./modules/attendance/attendance.module";
import { AuditLogsModule } from "./modules/audit-logs/audit-logs.module";
import { AuthModule } from "./modules/auth/auth.module";
import { BankAccountsModule } from "./modules/bank-accounts/bank-accounts.module";
import { BudgetsModule } from "./modules/budgets/budgets.module";
import { CashAccountsModule } from "./modules/cash-accounts/cash-accounts.module";
import { CostCentersModule } from "./modules/cost-centers/cost-centers.module";
import { DepartmentsModule } from "./modules/departments/departments.module";
import { EmployeesModule } from "./modules/employees/employees.module";
import { ExpensesModule } from "./modules/expenses/expenses.module";
import { FinanceSummaryModule } from "./modules/finance-summary/finance-summary.module";
import { FinancialCategoriesModule } from "./modules/financial-categories/financial-categories.module";
import { GuestsModule } from "./modules/guests/guests.module";
import { HealthModule } from "./modules/health/health.module";
import { HotelsModule } from "./modules/hotels/hotels.module";
import { HousekeepingTasksModule } from "./modules/housekeeping-tasks/housekeeping-tasks.module";
import { InvoicesModule } from "./modules/invoices/invoices.module";
import { LeaveRequestsModule } from "./modules/leave-requests/leave-requests.module";
import { MaintenanceInterventionsModule } from "./modules/maintenance-interventions/maintenance-interventions.module";
import { MaintenanceRequestsModule } from "./modules/maintenance-requests/maintenance-requests.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { OrganizationsModule } from "./modules/organizations/organizations.module";
import { PayslipsModule } from "./modules/payslips/payslips.module";
import { PermissionsModule } from "./modules/permissions/permissions.module";
import { ProductsModule } from "./modules/products/products.module";
import { PurchaseOrdersModule } from "./modules/purchase-orders/purchase-orders.module";
import { PurchaseRequestsModule } from "./modules/purchase-requests/purchase-requests.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { ReservationsModule } from "./modules/reservations/reservations.module";
import { RevenuesModule } from "./modules/revenues/revenues.module";
import { RolesModule } from "./modules/roles/roles.module";
import { RoomTypesModule } from "./modules/room-types/room-types.module";
import { RoomsModule } from "./modules/rooms/rooms.module";
import { StockMovementsModule } from "./modules/stock-movements/stock-movements.module";
import { SuppliersModule } from "./modules/suppliers/suppliers.module";
import { UsersModule } from "./modules/users/users.module";
import { WarehousesModule } from "./modules/warehouses/warehouses.module";
import { WorkSchedulesModule } from "./modules/work-schedules/work-schedules.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot([{ name: "default", ttl: 60_000, limit: 100 }]),
    PrismaModule,
    HealthModule,
    PermissionsModule,
    RolesModule,
    UsersModule,
    OrganizationsModule,
    HotelsModule,
    DepartmentsModule,
    ActivitiesModule,
    CostCentersModule,
    FinancialCategoriesModule,
    CashAccountsModule,
    BankAccountsModule,
    RevenuesModule,
    ExpensesModule,
    BudgetsModule,
    InvoicesModule,
    RoomTypesModule,
    RoomsModule,
    GuestsModule,
    ReservationsModule,
    EmployeesModule,
    WorkSchedulesModule,
    AttendanceModule,
    LeaveRequestsModule,
    PayslipsModule,
    FinanceSummaryModule,
    SuppliersModule,
    PurchaseRequestsModule,
    PurchaseOrdersModule,
    HousekeepingTasksModule,
    AssetsModule,
    MaintenanceRequestsModule,
    MaintenanceInterventionsModule,
    ReportsModule,
    NotificationsModule,
    AuditLogsModule,
    WarehousesModule,
    StockMovementsModule,
    ProductsModule,
    AuthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    // Après AuditInterceptor : sur un cache-hit d'idempotence, la requête ne ré-exécute jamais le
    // handler réel, donc AuditInterceptor journalise quand même l'appel HTTP reçu (comportement
    // voulu — un replay reste une requête réelle du point de vue de l'audit), tandis que
    // IdempotencyInterceptor court-circuite uniquement l'exécution métier elle-même.
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
  ],
})
export class AppModule {}
