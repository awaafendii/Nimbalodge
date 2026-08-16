import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { AppModule } from "../../src/app.module";
import { PrismaService } from "../../src/database/prisma.service";

// Boot de l'application réelle (AppModule complet, tous les guards/interceptors globaux actifs)
// contre la base de test — mêmes pipes/préfixe que main.ts, pour que le comportement testé soit
// celui qui tourne réellement en production, pas une version allégée.
export async function createTestApp(): Promise<{ app: INestApplication; prisma: PrismaService }> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}
