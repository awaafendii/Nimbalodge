import { Injectable } from "@nestjs/common";

export interface MetricsSnapshot {
  uptimeSeconds: number;
  timestamp: string;
  memory: {
    rssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
  };
  requests: {
    total: number;
    byStatusClass: Record<"2xx" | "3xx" | "4xx" | "5xx" | "other", number>;
  };
  errors: {
    total5xx: number;
    ratePercent: number;
  };
  latencyMs: {
    avg: number;
    p95: number;
    sampleSize: number;
  };
}

// Fenêtre glissante bornée : évite une fuite mémoire sur un process longue durée tout en gardant un
// échantillon assez large pour un p95 représentatif (voir record()).
const LATENCY_SAMPLE_LIMIT = 1000;

@Injectable()
export class MetricsService {
  private readonly startedAt = Date.now();
  private requestCount = 0;
  private readonly statusClassCounts: Record<"2xx" | "3xx" | "4xx" | "5xx" | "other", number> = {
    "2xx": 0,
    "3xx": 0,
    "4xx": 0,
    "5xx": 0,
    other: 0,
  };
  private readonly latencySamples: number[] = [];

  record(statusCode: number, durationMs: number): void {
    this.requestCount += 1;
    this.statusClassCounts[classifyStatus(statusCode)] += 1;

    this.latencySamples.push(durationMs);
    if (this.latencySamples.length > LATENCY_SAMPLE_LIMIT) {
      this.latencySamples.shift();
    }
  }

  snapshot(): MetricsSnapshot {
    const memory = process.memoryUsage();
    const total5xx = this.statusClassCounts["5xx"];

    return {
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      timestamp: new Date().toISOString(),
      memory: {
        rssMb: toMb(memory.rss),
        heapUsedMb: toMb(memory.heapUsed),
        heapTotalMb: toMb(memory.heapTotal),
      },
      requests: {
        total: this.requestCount,
        byStatusClass: { ...this.statusClassCounts },
      },
      errors: {
        total5xx,
        ratePercent: this.requestCount > 0 ? round(( total5xx / this.requestCount) * 100) : 0,
      },
      latencyMs: {
        avg: average(this.latencySamples),
        p95: percentile(this.latencySamples, 95),
        sampleSize: this.latencySamples.length,
      },
    };
  }
}

function classifyStatus(statusCode: number): "2xx" | "3xx" | "4xx" | "5xx" | "other" {
  if (statusCode >= 200 && statusCode < 300) return "2xx";
  if (statusCode >= 300 && statusCode < 400) return "3xx";
  if (statusCode >= 400 && statusCode < 500) return "4xx";
  if (statusCode >= 500 && statusCode < 600) return "5xx";
  return "other";
}

function toMb(bytes: number): number {
  return round(bytes / (1024 * 1024));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function average(samples: number[]): number {
  if (samples.length === 0) return 0;
  return round(samples.reduce((sum, value) => sum + value, 0) / samples.length);
}

function percentile(samples: number[], p: number): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)] ?? 0;
}
