import { createApp } from "../../src/app";
import { CoworkingRepository } from "../../src/repositories/coworking.repository";
import { InMemoryCoworkingRepository } from "../../src/repositories/in-memory-coworking.repository";

export const testJwtSecret = "test-only-coworking-secret-with-at-least-32-bytes";

export function createTestApp(
  repository: CoworkingRepository = new InMemoryCoworkingRepository()
) {
  return createApp(repository, testJwtSecret);
}
