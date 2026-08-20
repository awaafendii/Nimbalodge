import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { AppModule } from "../../src/app.module";
import { PrismaService } from "../../src/database/prisma.service";
import { FakeLLMProvider } from "../../src/modules/nimba-ai/providers/fake-llm.provider";
import { LLM_PROVIDER_TOKEN } from "../../src/modules/nimba-ai/providers/llm-provider.interface";

// Boot de l'application réelle (AppModule complet, tous les guards/interceptors globaux actifs)
// contre la base de test — mêmes pipes/préfixe que main.ts, pour que le comportement testé soit
// celui qui tourne réellement en production, pas une version allégée. Seule exception délibérée :
// LLM_PROVIDER_TOKEN est substitué par FakeLLMProvider (voir .env.test.example, "les tests
// utilisent FakeLLMProvider... jamais un vrai appel Gemini") — @prisma/client charge le vrai `.env`
// du poste comme effet de bord de sa propre résolution d'env(), indépendamment de
// ConfigModule.forRoot(), donc GEMINI_API_KEY ne peut pas être fiablement neutralisée par simple
// suppression de process.env ; RBAC/scope/orchestration/audit restent 100% réels, seul l'appel
// réseau sortant vers Gemini est remplacé par ce double programmable.
export async function createTestApp(): Promise<{ app: INestApplication; prisma: PrismaService; fakeLlmProvider: FakeLLMProvider }> {
  const fakeLlmProvider = new FakeLLMProvider();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(LLM_PROVIDER_TOKEN)
    .useValue(fakeLlmProvider)
    .compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  return { app, prisma: app.get(PrismaService), fakeLlmProvider };
}
