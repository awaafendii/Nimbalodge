import { INestApplication } from "@nestjs/common";
import request from "supertest";

// Passe toujours par le vrai flux HTTP /auth/login (bcrypt + émission JWT réels) plutôt que de
// signer un token directement — exerce le même chemin qu'un appel réel, cohérent avec le principe
// du projet de vérifier contre le comportement réel plutôt que de le court-circuiter.
export async function loginAndGetToken(app: INestApplication, email: string, password: string): Promise<string> {
  const response = await request(app.getHttpServer())
    .post("/api/v1/auth/login")
    .send({ email, password })
    .expect(200);
  return response.body.accessToken as string;
}

export function authed(app: INestApplication, token: string) {
  const agent = request(app.getHttpServer());
  return {
    get: (url: string) => agent.get(url).set("Authorization", `Bearer ${token}`),
    post: (url: string) => agent.post(url).set("Authorization", `Bearer ${token}`),
    patch: (url: string) => agent.patch(url).set("Authorization", `Bearer ${token}`),
  };
}
