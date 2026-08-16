import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";

import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.use(helmet());
  app.enableCors({ origin: config.get<string>("CORS_ORIGIN"), credentials: true });
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  // Render (et la plupart des PaaS) assignent le port d'écoute dynamiquement via process.env.PORT
  // — prioritaire sur API_PORT (dev local uniquement) quand présent.
  const port = process.env.PORT ? Number(process.env.PORT) : (config.get<number>("API_PORT") ?? 4000);
  await app.listen(port, "0.0.0.0");
  // eslint-disable-next-line no-console
  console.log(`NimbaLodge API démarrée sur le port ${port}`);
}

bootstrap();
