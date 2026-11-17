import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import jwt from "jsonwebtoken";
import request from "supertest";
import { createApp } from "../../src/app";
import { InMemoryCoworkingRepository } from "../../src/repositories/in-memory-coworking.repository";

const jwtSecret = "security-hardening-test-secret-with-32-bytes";

describe("Authentication hardening", () => {
  it("uses short-lived access tokens and one-time hashed refresh tokens", async () => {
    const repository = new InMemoryCoworkingRepository();
    const app = createApp(repository, jwtSecret);
    await request(app)
      .post("/users")
      .send({ name: "Ana", email: "ana@example.com", password: "secret123" });
    const login = await request(app)
      .post("/auth/login")
      .send({ email: "ana@example.com", password: "secret123" });

    assert.equal(login.status, 200);
    assert.equal(typeof login.body.accessToken, "string");
    assert.equal(typeof login.body.refreshToken, "string");
    const accessClaims = jwt.verify(login.body.accessToken, jwtSecret);
    assert.equal(typeof accessClaims, "object");
    if (typeof accessClaims !== "string") {
      assert.equal((accessClaims.exp ?? 0) - (accessClaims.iat ?? 0), 15 * 60);
    }

    const refreshHash = createHash("sha256").update(login.body.refreshToken).digest("hex");
    const storedRefreshToken = repository.findRefreshTokenByHash(refreshHash);
    assert.ok(storedRefreshToken);
    assert.equal(storedRefreshToken.tokenHash, refreshHash);
    assert.notEqual(storedRefreshToken.tokenHash, login.body.refreshToken);
    assert.ok(storedRefreshToken.expiresAt > Date.now() + 6 * 24 * 60 * 60 * 1000);

    const malformedRefresh = await request(app)
      .post("/auth/refresh")
      .send({ refreshToken: "not-a-refresh-token" });
    const malformedLogout = await request(app)
      .post("/auth/logout")
      .send({ refreshToken: "not-a-refresh-token" });
    assert.equal(malformedRefresh.status, 401);
    assert.equal(malformedLogout.status, 400);

    const refresh = await request(app)
      .post("/auth/refresh")
      .send({ refreshToken: login.body.refreshToken });
    assert.equal(refresh.status, 200);
    assert.notEqual(refresh.body.accessToken, login.body.accessToken);
    assert.notEqual(refresh.body.refreshToken, login.body.refreshToken);

    const replay = await request(app)
      .post("/auth/refresh")
      .send({ refreshToken: login.body.refreshToken });
    assert.equal(replay.status, 401);

    const logout = await request(app)
      .post("/auth/logout")
      .send({ refreshToken: refresh.body.refreshToken });
    assert.equal(logout.status, 204);
    const revoked = await request(app)
      .post("/auth/refresh")
      .send({ refreshToken: refresh.body.refreshToken });
    assert.equal(revoked.status, 401);
  });

  it("limits failed login attempts to five per IP within the configured window", async () => {
    const app = createApp(new InMemoryCoworkingRepository(), jwtSecret);
    const attempts = [];
    for (let attempt = 0; attempt < 5; attempt += 1) {
      attempts.push(
        await request(app)
          .post("/auth/login")
          .send({ email: "missing@example.com", password: "wrong-password" })
      );
    }
    const blocked = await request(app)
      .post("/auth/login")
      .send({ email: "missing@example.com", password: "wrong-password" });

    assert.ok(attempts.every((response) => response.status === 401));
    assert.equal(blocked.status, 429);
  });

  it("allows only configured cross-origin browser requests", async () => {
    const app = createApp(
      new InMemoryCoworkingRepository(),
      jwtSecret,
      { allowedOrigins: ["https://frontend.example"] }
    );
    const allowed = await request(app)
      .options("/auth/login")
      .set("Origin", "https://frontend.example")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "content-type");
    const denied = await request(app)
      .get("/rooms")
      .set("Origin", "https://untrusted.example");

    assert.equal(allowed.status, 204);
    assert.equal(allowed.headers["access-control-allow-origin"], "https://frontend.example");
    assert.equal(denied.status, 403);
    assert.equal(denied.headers["access-control-allow-origin"], undefined);
  });
});
