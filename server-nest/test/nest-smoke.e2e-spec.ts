import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module.js";

/** Set `NEST_E2E=1` and a reachable `DATABASE_URL` (e.g. embedded Postgres from Express dev). */
const runE2e = process.env.NEST_E2E === "1" && Boolean(process.env.DATABASE_URL?.trim());

describe.skipIf(!runE2e)("Nest smoke (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.PAPERCLIP_MIGRATION_AUTO_APPLY ??= "true";
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    app.setGlobalPrefix("api");
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it("GET /api/health returns ok", async () => {
    const res = await request(app.getHttpServer()).get("/api/health").expect(200);
    expect(res.body).toMatchObject({ status: "ok" });
  });

  it("GET /api/auth/get-session succeeds in local_trusted", async () => {
    if (process.env.PAPERCLIP_DEPLOYMENT_MODE === "authenticated") {
      return;
    }
    const res = await request(app.getHttpServer()).get("/api/auth/get-session").expect(200);
    expect(res.body?.user?.id).toBe("local-board");
  });
});
