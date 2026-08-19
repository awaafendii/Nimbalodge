import { MetricsService } from "./metrics.service";

// Unit — pas de dépendance externe (compteurs en mémoire pure) : couvre la classification par
// classe de statut, le calcul d'erreur 5xx, et la moyenne/p95 de latence (voir metrics.service.ts).
describe("MetricsService", () => {
  it("démarre à zéro sans échantillon", () => {
    const metrics = new MetricsService();
    const snapshot = metrics.snapshot();

    expect(snapshot.requests.total).toBe(0);
    expect(snapshot.errors.total5xx).toBe(0);
    expect(snapshot.errors.ratePercent).toBe(0);
    expect(snapshot.latencyMs.avg).toBe(0);
    expect(snapshot.latencyMs.p95).toBe(0);
  });

  it("classe les requêtes par catégorie de code HTTP", () => {
    const metrics = new MetricsService();
    metrics.record(200, 10);
    metrics.record(201, 10);
    metrics.record(301, 5);
    metrics.record(404, 20);
    metrics.record(500, 30);

    const snapshot = metrics.snapshot();
    expect(snapshot.requests.total).toBe(5);
    expect(snapshot.requests.byStatusClass["2xx"]).toBe(2);
    expect(snapshot.requests.byStatusClass["3xx"]).toBe(1);
    expect(snapshot.requests.byStatusClass["4xx"]).toBe(1);
    expect(snapshot.requests.byStatusClass["5xx"]).toBe(1);
  });

  it("calcule le taux d'erreur 5xx en pourcentage du total", () => {
    const metrics = new MetricsService();
    metrics.record(200, 10);
    metrics.record(200, 10);
    metrics.record(200, 10);
    metrics.record(500, 10);

    expect(metrics.snapshot().errors.ratePercent).toBe(25);
  });

  it("calcule une moyenne et un p95 de latence cohérents", () => {
    const metrics = new MetricsService();
    for (let i = 1; i <= 100; i += 1) {
      metrics.record(200, i);
    }

    const snapshot = metrics.snapshot();
    expect(snapshot.latencyMs.avg).toBeCloseTo(50.5, 1);
    // p95 sur 1..100 : la 95e valeur triée.
    expect(snapshot.latencyMs.p95).toBe(95);
    expect(snapshot.latencyMs.sampleSize).toBe(100);
  });

  it("borne la fenêtre d'échantillons de latence pour éviter une fuite mémoire", () => {
    const metrics = new MetricsService();
    for (let i = 0; i < 1500; i += 1) {
      metrics.record(200, 1);
    }

    // Le compteur de requêtes totales n'est jamais tronqué, seule la fenêtre de latence l'est.
    expect(metrics.snapshot().requests.total).toBe(1500);
    expect(metrics.snapshot().latencyMs.sampleSize).toBeLessThanOrEqual(1000);
  });
});
