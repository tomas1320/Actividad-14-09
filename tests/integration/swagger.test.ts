import assert from "node:assert/strict";
import { describe, it } from "node:test";
import request from "supertest";
import { createApp } from "../../src/app";

describe("Swagger API documentation", () => {
  it("serves the OpenAPI definition with all REST endpoints", async () => {
    const response = await request(createApp()).get("/api-docs.json");

    assert.equal(response.status, 200);
    assert.equal(response.body.openapi, "3.0.3");
    assert.ok(response.body.paths["/rooms"]);
    assert.ok(response.body.paths["/users"]);
    assert.ok(response.body.paths["/bookings"]);
    assert.ok(response.body.paths["/bookings/{id}/cancel"]);
  });

  it("serves the Swagger UI to explore and call the API", async () => {
    const response = await request(createApp()).get("/api-docs/");

    assert.equal(response.status, 200);
    assert.match(response.headers["content-type"], /text\/html/);
    assert.match(response.text, /Swagger UI/);
  });
});
