import { INestApplication } from "@nestjs/common";

import { resetDatabase } from "./support/database";
import { createTenant, seedPermissionCatalog } from "./support/fixtures";
import { authed, loginAndGetToken } from "./support/http";
import { createTestApp } from "./support/test-app";
import { PrismaService } from "../src/database/prisma.service";

// GET /hospitality-insights/occupancy — endpoint REST direct ajouté pour brancher le KPI
// Occupation du tableau de bord général (jusqu'ici, HospitalityInsightsService n'était consommé
// qu'à travers /nimba-ai/insights/hospitality, gardé par nimba-ai.use ; un rôle avec
// reservations.view mais sans nimba-ai.use, ex. RECEPTIONNISTE, doit pouvoir voir l'occupation
// sans dépendre de Nimba AI).
describe("Hospitality insights — GET /hospitality-insights/occupancy", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await resetDatabase(prisma);
    await seedPermissionCatalog(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it("renvoie un résumé d'occupation réel pour un utilisateur avec reservations.view", async () => {
    const tenant = await createTenant(prisma, "hospitality-insights-ok", [
      "reservations.view",
      "reservations.create",
      "room-types.create",
      "rooms.create",
      "guests.create",
    ]);
    const token = await loginAndGetToken(app, tenant.email, tenant.password);
    const client = authed(app, token);

    const roomType = await client
      .post("/api/v1/room-types")
      .send({ name: "Standard", baseRate: 300000, capacity: 2 })
      .expect(201);
    const room = await client.post("/api/v1/rooms").send({ roomTypeId: roomType.body.id, number: "101" }).expect(201);
    const guest = await client.post("/api/v1/guests").send({ firstName: "Test", lastName: "Client" }).expect(201);

    const now = new Date();
    const checkInDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 2)).toISOString();
    const checkOutDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 5)).toISOString();
    await client
      .post("/api/v1/reservations")
      .send({ roomId: room.body.id, guestId: guest.body.id, checkInDate, checkOutDate, agreedRate: 300000 })
      .expect(201);

    const response = await client.get("/api/v1/hospitality-insights/occupancy").expect(200);
    expect(response.body.current.availableRooms).toBe(1);
    expect(response.body.current.occupiedRoomNights).toBe(3);
    expect(response.body.current.occupancyRate).toBeGreaterThan(0);
    expect(response.body.current.adr).toBe("300000");
  });

  it("refuse 403 pour un utilisateur sans reservations.view", async () => {
    const tenant = await createTenant(prisma, "hospitality-insights-403", ["hotels.view"]);
    const token = await loginAndGetToken(app, tenant.email, tenant.password);
    await authed(app, token).get("/api/v1/hospitality-insights/occupancy").expect(403);
  });
});
