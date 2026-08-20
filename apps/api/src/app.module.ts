import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";

import { AuditModule } from "./common/audit/audit.module";
import { AuthzAuditFilter } from "./common/audit/authz-audit.filter";
import { AuditInterceptor } from "./common/interceptors/audit.interceptor";
import { AppLoggingModule } from "./common/logging/logging.module";
import { IdempotencyInterceptor } from "./common/interceptors/idempotency.interceptor";
import { MetricsMiddleware } from "./common/monitoring/metrics.middleware";
import { MonitoringModule } from "./common/monitoring/monitoring.module";
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
import { DocumentsModule } from "./modules/documents/documents.module";
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
import { NimbaAiModule } from "./modules/nimba-ai/nimba-ai.module";
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
    // ignoreEnvFile en test (NODE_ENV=test, posé par `dotenv -e .env.test` avant même le boot de
    // Nest) : sinon ConfigModule retombe silencieusement sur le vrai `.env` du poste pour toute clé
    // absente de .env.test (ex. GEMINI_API_KEY) — process.env déjà peuplé par .env.test reste
    // l'unique source de vérité en test, jamais un vrai secret de dev qui ferait fuiter un vrai
    // appel réseau (Gemini) dans un test e2e (voir .env.test.example, Nimba AI Étape 9).
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv, ignoreEnvFile: process.env.NODE_ENV === "test" }),
    ThrottlerModule.forRoot([{ name: "default", ttl: 60_000, limit: 100 }]),
    AppLoggingModule,
    MonitoringModule,
    PrismaModule,
    AuditModule,
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
    DocumentsModule,
    AuthModule,
    NimbaAiModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    // Après AuditInterceptor : sur un cache-hit d'idempotence, la requête ne ré-exécute jamais le
    // handler réel, donc AuditInterceptor journalise quand même l'appel HTTP reçu (comportement
    // voulu — un replay reste une requête réelle du point de vue de l'audit), tandis que
    // IdempotencyInterceptor court-circuite uniquement l'exécution métier elle-même.
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
    // Étape 7 — capture les rejets 401/403 de Guard, qui n'atteignent jamais AuditInterceptor
    // (Guards avant interceptors dans le cycle de vie Nest). Voir authz-audit.filter.ts.
    { provide: APP_FILTER, useClass: AuthzAuditFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MetricsMiddleware).forRoutes("*");
  }
}
