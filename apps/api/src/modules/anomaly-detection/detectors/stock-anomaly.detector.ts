import { Injectable } from "@nestjs/common";

import { ProductsService } from "../../products/products.service";
import type { AuthenticatedUser } from "../../../common/types/authenticated-request";
import type { Anomaly } from "../anomaly";
import type { AnomalyDetector } from "./anomaly-detector.interface";
import { fmtDecimal, severityForRatio } from "./severity";

// Réutilise ProductsService.findBelowThreshold() (extrait de checkLowStock() — lecture pure, sans
// déclencher de notification). Stock = état ponctuel, pas une agrégation sur période : `dateFrom`/
// `dateTo` ne servent qu'à horodater l'anomalie retournée.
@Injectable()
export class StockAnomalyDetector implements AnomalyDetector {
  readonly source = "stock-anomaly";
  readonly requiredPermission = "products.view";

  constructor(private readonly productsService: ProductsService) {}

  async detect(requester: AuthenticatedUser, dateFrom: Date, dateTo: Date): Promise<Anomaly[]> {
    const belowThreshold = await this.productsService.findBelowThreshold(requester);
    const period = { from: dateFrom.toISOString(), to: dateTo.toISOString() };

    return belowThreshold.map((item) => {
      const ratio = item.threshold.greaterThan(0)
        ? item.threshold.minus(item.onHand).dividedBy(item.threshold).toNumber()
        : 1;
      return {
        severity: severityForRatio(ratio),
        indicator: `Stock bas — ${item.name}`,
        period,
        observedValue: fmtDecimal(item.onHand),
        referenceValue: fmtDecimal(item.threshold),
        explanation: `Le stock de "${item.name}" (${fmtDecimal(item.onHand)}) est sous le seuil minimum défini (${fmtDecimal(item.threshold)}).`,
        recommendation: "Envisager un réapprovisionnement.",
        resourceType: "product",
        resourceId: item.productId,
      };
    });
  }
}
