import assert from "node:assert/strict";
import { describe, it } from "node:test";
import request from "supertest";
import { createTestApp } from "../support/test-app";

describe("Swagger API documentation", () => {
  it("serves the OpenAPI definition with all REST endpoints", async () => {
    const response = await request(createTestApp()).get("/api-docs.json");

    assert.equal(response.status, 200);
    assert.equal(response.body.openapi, "3.0.3");
    assert.ok(response.body.paths["/rooms"]);
    assert.ok(response.body.paths["/users"]);
    assert.ok(response.body.paths["/bookings"]);
    assert.ok(response.body.paths["/bookings/{id}/cancel"]);
    assert.ok(response.body.paths["/auth/login"]);
    assert.ok(response.body.paths["/auth/refresh"]);
    assert.ok(response.body.paths["/auth/logout"]);
    assert.ok(response.body.paths["/management/bookings"]);
    assert.deepEqual(response.body.paths["/bookings"].post.security, [{ bearerAuth: [] }]);
    assert.equal(response.body.components.securitySchemes.bearerAuth.scheme, "bearer");
  });

  it("serves the Swagger UI to explore and call the API", async () => {
    const response = await request(createTestApp()).get("/api-docs/");

    assert.equal(response.status, 200);
    assert.match(response.headers["content-type"], /text\/html/);
    assert.match(response.text, /Swagger UI/);
  });
});
