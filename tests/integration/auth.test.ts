import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import request from "supertest";
import { createApp } from "../../src/app";
import { InMemoryCoworkingRepository } from "../../src/repositories/in-memory-coworking.repository";

const jwtSecret = "integration-test-secret-with-at-least-32-bytes";

describe("JWT authentication and role authorization", () => {
  it("fails fast when the JWT secret is missing the required length", () => {
    assert.throws(
      () => createApp(new InMemoryCoworkingRepository(), "short"),
      /JWT_SECRET/
    );
  });

  it("always registers public users as USER, ignoring a submitted role", async () => {
    const repository = new InMemoryCoworkingRepository();
    const response = await request(createApp(repository, jwtSecret))
      .post("/users")
      .send({
        name: "Ana",
        email: "ana@example.com",
        password: "secret123",
        role: "ADMIN"
      });

    assert.equal(response.status, 201);
    assert.equal(response.body.role, "USER");
  });

  it("requires a valid bearer token to create a booking and takes its owner from the token", async () => {
    const app = createApp(new InMemoryCoworkingRepository(), jwtSecret);
    await request(app)
      .post("/users")
      .send({ name: "Ana", email: "ana@example.com", password: "secret123" });
    const login = await request(app)
      .post("/auth/login")
      .send({ email: "ana@example.com", password: "secret123" });

    assert.equal(login.status, 200);
    assert.equal(typeof login.body.accessToken, "string");

    const unauthenticated = await request(app)
      .post("/bookings")
      .send({
        userId: "forged-user-id",
        roomId: "room-a",
        date: "2026-10-15",
        startTime: "10:00",
        endTime: "11:00"
      });
    assert.equal(unauthenticated.status, 401);

    const authenticated = await request(app)
      .post("/bookings")
      .set("Authorization", `Bearer ${login.body.accessToken}`)
      .send({
        userId: "forged-user-id",
        roomId: "room-a",
        date: "2026-10-15",
        startTime: "10:00",
        endTime: "11:00"
      });
    assert.equal(authenticated.status, 201);
    assert.equal(authenticated.body.userId, login.body.user.id);
  });

  it("returns the same unauthorized response for unknown users and wrong passwords", async () => {
    const app = createApp(new InMemoryCoworkingRepository(), jwtSecret);
    await request(app)
      .post("/users")
      .send({ name: "Ana", email: "ana@example.com", password: "secret123" });

    const wrongPassword = await request(app)
      .post("/auth/login")
      .send({ email: "ana@example.com", password: "incorrect" });
    const unknownUser = await request(app)
      .post("/auth/login")
      .send({ email: "missing@example.com", password: "secret123" });

    assert.equal(wrongPassword.status, 401);
    assert.deepEqual(wrongPassword.body, unknownUser.body);
  });

  it("rejects expired tokens", async () => {
    const app = createApp(new InMemoryCoworkingRepository(), jwtSecret);
    const registration = await request(app)
      .post("/users")
      .send({ name: "Ana", email: "ana@example.com", password: "secret123" });
    const expiredToken = jwt.sign(
      { role: "USER" },
      jwtSecret,
      { algorithm: "HS256", subject: registration.body.id, expiresIn: -1 }
    );

    const response = await request(app)
      .get("/auth/profile")
      .set("Authorization", `Bearer ${expiredToken}`);

    assert.equal(response.status, 403);
    assert.equal(response.body.error, "INVALID_TOKEN");
  });

  it("allows an ADMIN to cancel another user's booking", async () => {
    const repository = new InMemoryCoworkingRepository();
    const app = createApp(repository, jwtSecret);
    const registration = await request(app)
      .post("/users")
      .send({ name: "Ana", email: "ana@example.com", password: "secret123" });
    const userLogin = await request(app)
      .post("/auth/login")
      .send({ email: "ana@example.com", password: "secret123" });
    const booking = await request(app)
      .post("/bookings")
      .set("Authorization", `Bearer ${userLogin.body.accessToken}`)
      .send({
        roomId: "room-a",
        date: "2026-10-15",
        startTime: "10:00",
        endTime: "11:00"
      });

    repository.createUser({
      id: randomUUID(),
      name: "Admin",
      email: "admin@example.com",
      passwordHash: await bcrypt.hash("admin-secret123", 10),
      role: "ADMIN"
    });
    const adminLogin = await request(app)
      .post("/auth/login")
      .send({ email: "admin@example.com", password: "admin-secret123" });
    const cancellation = await request(app)
      .post(`/bookings/${booking.body.id}/cancel`)
      .set("Authorization", `Bearer ${adminLogin.body.accessToken}`);

    assert.equal(registration.status, 201);
    assert.equal(booking.status, 201);
    assert.equal(cancellation.status, 200);
    assert.equal(cancellation.body.status, "CANCELLED");
  });

  it("allows an EDITOR to read bookings and denies that access to a USER", async () => {
    const repository = new InMemoryCoworkingRepository();
    const app = createApp(repository, jwtSecret);
    await request(app)
      .post("/users")
      .send({ name: "Ana", email: "ana@example.com", password: "secret123" });
    const login = await request(app)
      .post("/auth/login")
      .send({ email: "ana@example.com", password: "secret123" });

    const userResponse = await request(app)
      .get("/management/bookings")
      .set("Authorization", `Bearer ${login.body.accessToken}`);
    assert.equal(userResponse.status, 403);

    repository.createUser({
      id: randomUUID(),
      name: "Editor",
      email: "editor@example.com",
      passwordHash: await bcrypt.hash("editor-secret123", 10),
      role: "EDITOR"
    });

    const editorLogin = await request(app)
      .post("/auth/login")
      .send({ email: "editor@example.com", password: "editor-secret123" });
    const editorResponse = await request(app)
      .get("/management/bookings")
      .set("Authorization", `Bearer ${editorLogin.body.accessToken}`);

    assert.equal(editorResponse.status, 200);
    assert.deepEqual(editorResponse.body, []);
  });
});
