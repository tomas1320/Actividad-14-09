import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AppError } from "../../src/domain/app-error";
import { InMemoryCoworkingRepository } from "../../src/repositories/in-memory-coworking.repository";
import { CoworkingService } from "../../src/services/coworking.service";

describe("CoworkingService", () => {
  it("removes a room from availability after a confirmed booking", async () => {
    const service = new CoworkingService(new InMemoryCoworkingRepository());
    const user = await service.registerUser("Ana", "ana@example.com", "secret123");

    await service.createBooking(user.id, "room-a", "2026-10-15", "10:00", "11:00");

    assert.deepEqual(
      service.listRooms("2026-10-15", "10:30", "11:30").map((room) => room.id),
      ["room-b"]
    );
  });

  it("allows adjacent reservations without treating them as overlapping", async () => {
    const service = new CoworkingService(new InMemoryCoworkingRepository());
    const firstUser = await service.registerUser("Ana", "ana@example.com", "secret123");
    const secondUser = await service.registerUser("Bob", "bob@example.com", "secret456");

    await service.createBooking(firstUser.id, "room-a", "2026-10-15", "10:00", "11:00");
    const booking = await service.createBooking(
      secondUser.id,
      "room-a",
      "2026-10-15",
      "11:00",
      "12:00"
    );

    assert.equal(booking.status, "CONFIRMED");
  });

  it("rejects an invalid interval with a client error", async () => {
    const service = new CoworkingService(new InMemoryCoworkingRepository());
    const user = await service.registerUser("Ana", "ana@example.com", "secret123");

    await assert.rejects(
      service.createBooking(user.id, "room-a", "2026-10-15", "11:00", "10:00"),
      (error: unknown) => error instanceof AppError && error.statusCode === 400
    );
  });
});
