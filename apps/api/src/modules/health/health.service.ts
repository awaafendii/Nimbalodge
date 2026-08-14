import { Injectable, Logger } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";

export interface HealthStatus {
  status: "ok" | "error";
  database: "connected" | "disconnected";
  timestamp: string;
  message?: string;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthStatus> {
    const timestamp = new Date().toISOString();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: "ok", database: "connected", timestamp };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      this.logger.error(`Échec de la vérification de connectivité DB: ${message}`);
      return { status: "error", database: "disconnected", timestamp, message };
    }
  }
}
