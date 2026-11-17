import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import {
  Given,
  Then,
  When,
  World,
  setWorldConstructor
} from "@cucumber/cucumber";
import request, { Response } from "supertest";
import { randomUUID } from "node:crypto";
import { createTestApp } from "../support/test-app";
import { InMemoryCoworkingRepository } from "../../src/repositories/in-memory-coworking.repository";

class CoworkingWorld extends World {
  repository = new InMemoryCoworkingRepository();
  app = createTestApp(this.repository);
  response?: Response;
  userIds = new Map<string, string>();
  tokens = new Map<string, string>();
  activeToken?: string;
  bookingId?: string;
}

setWorldConstructor(CoworkingWorld);

async function registerUser(world: CoworkingWorld, name: string, email: string): Promise<string> {
  const response = await request(world.app)
    .post("/users")
    .send({ name, email, password: "secret123" });
  assert.equal(response.status, 201);
  assert.equal(typeof response.body.id, "string");
  world.userIds.set(email, response.body.id);
  const login = await request(world.app)
    .post("/auth/login")
    .send({ email, password: "secret123" });
  assert.equal(login.status, 200);
  world.tokens.set(email, login.body.token);
  return response.body.id;
}

async function createBooking(
  world: CoworkingWorld,
  email: string,
  roomName: string,
  date: string,
  startTime: string,
  endTime: string
): Promise<Response> {
  if (!world.userIds.has(email)) {
    await registerUser(world, email.split("@")[0], email);
  }
  const token = world.tokens.get(email);
  assert.ok(token);
  const roomsResponse = await request(world.app).get("/rooms");
  const room = roomsResponse.body.find((candidate: { name: string }) => candidate.name === roomName);
  assert.ok(room);
  const response = await request(world.app)
    .post("/bookings")
    .set("Authorization", `Bearer ${token}`)
    .send({ roomId: room.id, date, startTime, endTime });
  if (response.status === 201) {
    world.bookingId = response.body.id;
  }
  return response;
}

Given(
  "no account exists with email {string}",
  function (this: CoworkingWorld, email: string) {
    assert.equal(this.userIds.has(email), false);
  }
);

When(
  "I register {string} with email {string} and password {string}",
  async function (this: CoworkingWorld, name: string, email: string, password: string) {
    this.response = await request(this.app).post("/users").send({ name, email, password });
  }
);

Given(
  "an account exists with email {string}",
  async function (this: CoworkingWorld, email: string) {
    await registerUser(this, "Ana", email);
  }
);

When(
  "I register {string} with email {string}, password {string}, and requested role {string}",
  async function (
    this: CoworkingWorld,
    name: string,
    email: string,
    password: string,
    role: string
  ) {
    this.response = await request(this.app)
      .post("/users")
      .send({ name, email, password, role });
  }
);

Then("the response status should be {int}", function (this: CoworkingWorld, status: number) {
  assert.equal(this.response?.status, status);
});

Then(
  "the response should not expose a password or password hash",
  function (this: CoworkingWorld) {
    assert.equal("password" in (this.response?.body ?? {}), false);
    assert.equal("passwordHash" in (this.response?.body ?? {}), false);
  }
);

Then(
  "the stored password for {string} should be hashed",
  async function (this: CoworkingWorld, email: string) {
    const user = this.repository.findUserByEmail(email);
    assert.ok(user);
    assert.notEqual(user.passwordHash, "secret123");
    assert.equal(await bcrypt.compare("secret123", user.passwordHash), true);
  }
);

Given("the coworking rooms are available", function () {});

When(
  "I search rooms on {string} from {string} to {string}",
  async function (this: CoworkingWorld, date: string, startTime: string, endTime: string) {
    this.response = await request(this.app)
      .get("/rooms")
      .query({ date, startTime, endTime });
  }
);

Given(
  "{string} has a confirmed booking on {string} from {string} to {string}",
  async function (
    this: CoworkingWorld,
    room: string,
    date: string,
    start: string,
    end: string
  ) {
    const response = await createBooking(this, "ana@example.com", room, date, start, end);
    assert.equal(response.status, 201);
  }
);

Then(
  "the available rooms should include {string}",
  function (this: CoworkingWorld, roomName: string) {
    assert.ok(this.response?.body.some((room: { name: string }) => room.name === roomName));
  }
);

Then(
  "the available rooms should not include {string}",
  function (this: CoworkingWorld, roomName: string) {
    assert.equal(
      this.response?.body.some((room: { name: string }) => room.name === roomName),
      false
    );
  }
);

Given("user {string} exists", async function (this: CoworkingWorld, email: string) {
  await registerUser(this, "Ana", email);
});

When(
  "that user books {string} on {string} from {string} to {string}",
  async function (
    this: CoworkingWorld,
    room: string,
    date: string,
    start: string,
    end: string
  ) {
    this.response = await createBooking(this, "ana@example.com", room, date, start, end);
  }
);

When(
  "I attempt to book {string} without authentication on {string} from {string} to {string}",
  async function (
    this: CoworkingWorld,
    roomName: string,
    date: string,
    startTime: string,
    endTime: string
  ) {
    const roomsResponse = await request(this.app).get("/rooms");
    const room = roomsResponse.body.find((candidate: { name: string }) => candidate.name === roomName);
    assert.ok(room);
    this.response = await request(this.app)
      .post("/bookings")
      .send({ roomId: room.id, date, startTime, endTime });
  }
);

When(
  "I attempt to book {string} with an invalid token on {string} from {string} to {string}",
  async function (
    this: CoworkingWorld,
    roomName: string,
    date: string,
    startTime: string,
    endTime: string
  ) {
    const roomsResponse = await request(this.app).get("/rooms");
    const room = roomsResponse.body.find((candidate: { name: string }) => candidate.name === roomName);
    assert.ok(room);
    this.response = await request(this.app)
      .post("/bookings")
      .set("Authorization", "Bearer invalid.token.value")
      .send({ roomId: room.id, date, startTime, endTime });
  }
);

Given(
  "user {string} has booked {string} on {string} from {string} to {string}",
  async function (this: CoworkingWorld, email: string, room: string, date: string, start: string, end: string) {
    await createBooking(this, email, room, date, start, end);
  }
);

When(
  "user {string} tries to book {string} on {string} from {string} to {string}",
  async function (
    this: CoworkingWorld,
    email: string,
    roomName: string,
    date: string,
    startTime: string,
    endTime: string
  ) {
    if (!this.userIds.has(email)) {
      await registerUser(this, email.split("@")[0], email);
    }
    const token = this.tokens.get(email);
    assert.ok(token);
    const roomsResponse = await request(this.app).get("/rooms");
    const room = roomsResponse.body.find((candidate: { name: string }) => candidate.name === roomName);
    assert.ok(room);
    this.response = await request(this.app)
      .post("/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({ roomId: room.id, date, startTime, endTime });
  }
);

Then(
  "the booking status should be {string}",
  function (this: CoworkingWorld, status: string) {
    assert.equal(this.response?.body.status, status);
  }
);

When(
  "user {string} cancels that booking",
  async function (this: CoworkingWorld, email: string) {
    if (!this.userIds.has(email)) {
      await registerUser(this, email.split("@")[0], email);
    }
    const token = this.tokens.get(email);
    assert.ok(token);
    this.response = await request(this.app)
      .post(`/bookings/${this.bookingId}/cancel`)
      .set("Authorization", `Bearer ${token}`);
  }
);

When(
  "I list bookings for user {string}",
  async function (this: CoworkingWorld, email: string) {
    const token = this.tokens.get(email) ?? this.tokens.values().next().value;
    if (!token) {
      await registerUser(this, "Caller", "caller@example.com");
    }
    const accessToken = this.tokens.get(email) ?? this.tokens.values().next().value;
    const userId = this.userIds.get(email);
    assert.ok(accessToken);
    this.response = await request(this.app)
      .get(`/users/${userId ?? "unknown"}/bookings`)
      .set("Authorization", `Bearer ${accessToken}`);
  }
);

When(
  "user {string} logs in with password {string}",
  async function (this: CoworkingWorld, email: string, password: string) {
    this.response = await request(this.app)
      .post("/auth/login")
      .send({ email, password });
    if (this.response.status === 200) {
      this.activeToken = this.response.body.token;
      this.tokens.set(email, this.response.body.token);
    }
  }
);

When(
  "I request the profile using that token",
  async function (this: CoworkingWorld) {
    assert.ok(this.activeToken);
    this.response = await request(this.app)
      .get("/auth/profile")
      .set("Authorization", `Bearer ${this.activeToken}`);
  }
);

Then("the response should contain a JWT token", function (this: CoworkingWorld) {
  assert.match(this.response?.body.token ?? "", /^[\w-]+\.[\w-]+\.[\w-]+$/);
});

Then("the profile role should be {string}", function (this: CoworkingWorld, role: string) {
  assert.equal(this.response?.body.role, role);
});

Then("the registered user role should be {string}", function (this: CoworkingWorld, role: string) {
  assert.equal(this.response?.body.role, role);
});

Given(
  "a trusted {string} account exists with email {string}",
  async function (this: CoworkingWorld, role: string, email: string) {
    const trustedRole = role === "ADMIN" ? "ADMIN" : role === "EDITOR" ? "EDITOR" : undefined;
    assert.ok(trustedRole);
    this.repository.createUser({
      id: randomUUID(),
      name: trustedRole,
      email,
      passwordHash: await bcrypt.hash("trusted-role-secret123", 10),
      role: trustedRole
    });
  }
);

When(
  "the {string} user {string} requests all bookings",
  async function (this: CoworkingWorld, _role: string, email: string) {
    const login = await request(this.app)
      .post("/auth/login")
      .send({ email, password: "trusted-role-secret123" });
    assert.equal(login.status, 200);
    this.response = await request(this.app)
      .get("/management/bookings")
      .set("Authorization", `Bearer ${login.body.token}`);
  }
);

When(
  "the USER {string} requests all bookings",
  async function (this: CoworkingWorld, email: string) {
    if (!this.userIds.has(email)) {
      await registerUser(this, email.split("@")[0], email);
    }
    const token = this.tokens.get(email);
    assert.ok(token);
    this.response = await request(this.app)
      .get("/management/bookings")
      .set("Authorization", `Bearer ${token}`);
  }
);

When(
  "user {string} tries to list bookings of user {string}",
  async function (this: CoworkingWorld, requesterEmail: string, targetEmail: string) {
    if (!this.userIds.has(requesterEmail)) {
      await registerUser(this, requesterEmail.split("@")[0], requesterEmail);
    }
    if (!this.userIds.has(targetEmail)) {
      await registerUser(this, targetEmail.split("@")[0], targetEmail);
    }
    const targetId = this.userIds.get(targetEmail);
    const token = this.tokens.get(requesterEmail);
    assert.ok(targetId);
    assert.ok(token);
    this.response = await request(this.app)
      .get(`/users/${targetId}/bookings`)
      .set("Authorization", `Bearer ${token}`);
  }
);

Then(
  "the response should contain {int} booking",
  function (this: CoworkingWorld, count: number) {
    assert.equal(this.response?.body.length, count);
  }
);
