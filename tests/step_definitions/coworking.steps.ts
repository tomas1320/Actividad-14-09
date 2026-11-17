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
import { createApp } from "../../src/app";
import { InMemoryCoworkingRepository } from "../../src/repositories/in-memory-coworking.repository";

class CoworkingWorld extends World {
  repository = new InMemoryCoworkingRepository();
  app = createApp(this.repository);
  response?: Response;
  userIds = new Map<string, string>();
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
  const userId = world.userIds.get(email) ?? await registerUser(world, email.split("@")[0], email);
  const roomsResponse = await request(world.app).get("/rooms");
  const room = roomsResponse.body.find((candidate: { name: string }) => candidate.name === roomName);
  assert.ok(room);
  const response = await request(world.app)
    .post("/bookings")
    .send({ userId, roomId: room.id, date, startTime, endTime });
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
  "I book {string} for unknown user {string} on {string} from {string} to {string}",
  async function (
    this: CoworkingWorld,
    roomName: string,
    email: string,
    date: string,
    startTime: string,
    endTime: string
  ) {
    const roomsResponse = await request(this.app).get("/rooms");
    const room = roomsResponse.body.find((candidate: { name: string }) => candidate.name === roomName);
    assert.ok(room);
    this.response = await request(this.app)
      .post("/bookings")
      .send({ userId: "unknown", roomId: room.id, date, startTime, endTime });
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
    const userId = this.userIds.get(email) ?? await registerUser(this, email.split("@")[0], email);
    const roomsResponse = await request(this.app).get("/rooms");
    const room = roomsResponse.body.find((candidate: { name: string }) => candidate.name === roomName);
    assert.ok(room);
    this.response = await request(this.app)
      .post("/bookings")
      .send({ userId, roomId: room.id, date, startTime, endTime });
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
    const userId = this.userIds.get(email) ?? await registerUser(this, email.split("@")[0], email);
    this.response = await request(this.app)
      .post(`/bookings/${this.bookingId}/cancel`)
      .send({ userId });
  }
);

When(
  "I list bookings for user {string}",
  async function (this: CoworkingWorld, email: string) {
    const userId = this.userIds.get(email);
    this.response = await request(this.app).get(`/users/${userId ?? "unknown"}/bookings`);
  }
);

Then(
  "the response should contain {int} booking",
  function (this: CoworkingWorld, count: number) {
    assert.equal(this.response?.body.length, count);
  }
);
