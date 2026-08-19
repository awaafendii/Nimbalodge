import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";
import { Logger } from "nestjs-pino";

import { AppModule } from "./app.module";

async function bootstrap() {
  // bufferLogs : les logs émis avant que le logger pino ne soit attaché (ex. pendant
  // NestFactory.create lui-même) sont mis en attente puis rejoués via pino, au lieu d'utiliser le
  // Logger console par défaut de Nest pour cette courte fenêtre — un seul format de log du début à
  // la fin du cycle de vie du process.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  const config = app.get(ConfigService);

  app.use(helmet());
  app.enableCors({ origin: config.get<string>("CORS_ORIGIN"), credentials: true });
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  // Render (et la plupart des PaaS) assignent le port d'écoute dynamiquement via process.env.PORT
  // — prioritaire sur API_PORT (dev local uniquement) quand présent.
  const port = process.env.PORT ? Number(process.env.PORT) : (config.get<number>("API_PORT") ?? 4000);
  await app.listen(port, "0.0.0.0");
  app.get(Logger).log(`NimbaLodge API démarrée sur le port ${port}`);
}

bootstrap();
