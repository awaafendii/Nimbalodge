import { Module } from "@nestjs/common";

import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { BudgetsModule } from "../budgets/budgets.module";
import { CashAccountsModule } from "../cash-accounts/cash-accounts.module";
import { HrInsightsModule } from "../hr-insights/hr-insights.module";
import { ProductsModule } from "../products/products.module";
import { ReportsModule } from "../reports/reports.module";
import { AnomalyDetectionService } from "./anomaly-detection.service";
import { ANOMALY_DETECTORS, type AnomalyDetector } from "./detectors/anomaly-detector.interface";
import { AuditTrailAnomalyDetector } from "./detectors/audit-trail-anomaly.detector";
import { BudgetOverspendDetector } from "./detectors/budget-overspend.detector";
import { CashAnomalyDetector } from "./detectors/cash-anomaly.detector";
import { HrAnomalyDetector } from "./detectors/hr-anomaly.detector";
import { RevenueExpenseTrendDetector } from "./detectors/revenue-expense-trend.detector";
import { StockAnomalyDetector } from "./detectors/stock-anomaly.detector";

// Nimba AI (Étape 8). Suit le même pattern multi-provider que AI_TOOLS dans nimba-ai.module.ts
// (voir ai-tool.interface.ts) — un détecteur par source de données, agrégés derrière le token
// ANOMALY_DETECTORS. Autonome, en dehors de nimba-ai (réutilisable plus tard hors IA, même
// raisonnement que HospitalityInsightsModule/HrInsightsModule).
@Module({
  imports: [BudgetsModule, ReportsModule, CashAccountsModule, ProductsModule, HrInsightsModule, AuditLogsModule],
  providers: [
    BudgetOverspendDetector,
    RevenueExpenseTrendDetector,
    CashAnomalyDetector,
    StockAnomalyDetector,
    HrAnomalyDetector,
    AuditTrailAnomalyDetector,
    {
      provide: ANOMALY_DETECTORS,
      useFactory: (
        budgetOverspend: BudgetOverspendDetector,
        revenueExpenseTrend: RevenueExpenseTrendDetector,
        cashAnomaly: CashAnomalyDetector,
        stockAnomaly: StockAnomalyDetector,
        hrAnomaly: HrAnomalyDetector,
        auditTrailAnomaly: AuditTrailAnomalyDetector
      ): AnomalyDetector[] => [budgetOverspend, revenueExpenseTrend, cashAnomaly, stockAnomaly, hrAnomaly, auditTrailAnomaly],
      inject: [
        BudgetOverspendDetector,
        RevenueExpenseTrendDetector,
        CashAnomalyDetector,
        StockAnomalyDetector,
        HrAnomalyDetector,
        AuditTrailAnomalyDetector,
      ],
    },
    AnomalyDetectionService,
  ],
  exports: [AnomalyDetectionService],
})
export class AnomalyDetectionModule {}
