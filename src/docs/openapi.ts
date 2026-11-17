const timePattern = "^([01]\\d|2[0-3]):[0-5]\\d$";

const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Coworking Reservations API",
    version: "1.0.0",
    description: "API para consultar salas y administrar reservas de coworking."
  },
  servers: [{ url: "/", description: "Servidor actual" }],
  tags: [
    { name: "Rooms", description: "Consulta de salas y disponibilidad" },
    { name: "Users", description: "Registro y reservas por usuario" },
    { name: "Bookings", description: "Creación y cancelación de reservas" }
  ],
  paths: {
    "/rooms": {
      get: {
        tags: ["Rooms"],
        summary: "Listar salas o consultar disponibilidad",
        description: "Sin parámetros lista todas las salas. Para consultar disponibilidad envía los tres parámetros.",
        parameters: [
          {
            name: "date",
            in: "query",
            required: false,
            schema: { type: "string", format: "date", example: "2026-10-15" }
          },
          {
            name: "startTime",
            in: "query",
            required: false,
            schema: { type: "string", pattern: timePattern, example: "10:00" }
          },
          {
            name: "endTime",
            in: "query",
            required: false,
            schema: { type: "string", pattern: timePattern, example: "11:00" }
          }
        ],
        responses: {
          "200": {
            description: "Salas disponibles o salas registradas",
            content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Room" } } } }
          },
          "400": { $ref: "#/components/responses/BadRequest" }
        }
      }
    },
    "/users": {
      post: {
        tags: ["Users"],
        summary: "Registrar usuario",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/UserRegistration" } } }
        },
        responses: {
          "201": {
            description: "Usuario creado; no incluye la contraseña ni su hash",
            content: { "application/json": { schema: { $ref: "#/components/schemas/PublicUser" } } }
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "409": { description: "El email ya está registrado", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } }
        }
      }
    },
    "/users/{userId}/bookings": {
      get: {
        tags: ["Users"],
        summary: "Listar reservas de un usuario",
        parameters: [
          {
            name: "userId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" }
          }
        ],
        responses: {
          "200": {
            description: "Reservas del usuario",
            content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Booking" } } } }
          },
          "404": { $ref: "#/components/responses/NotFound" }
        }
      }
    },
    "/bookings": {
      post: {
        tags: ["Bookings"],
        summary: "Crear reserva",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/BookingRequest" } } }
        },
        responses: {
          "201": {
            description: "Reserva confirmada",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Booking" } } }
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "404": { $ref: "#/components/responses/NotFound" },
          "409": { description: "La sala ya está reservada en ese intervalo", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } }
        }
      }
    },
    "/bookings/{id}/cancel": {
      post: {
        tags: ["Bookings"],
        summary: "Cancelar reserva",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" }
          }
        ],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CancelBookingRequest" } } }
        },
        responses: {
          "200": {
            description: "Reserva cancelada",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Booking" } } }
          },
          "404": { $ref: "#/components/responses/NotFound" },
          "409": { description: "La reserva ya estaba cancelada", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } }
        }
      }
    }
  },
  components: {
    schemas: {
      Room: {
        type: "object",
        required: ["id", "name", "capacity"],
        properties: {
          id: { type: "string", example: "room-a" },
          name: { type: "string", example: "Sala A" },
          capacity: { type: "integer", example: 6 }
        }
      },
      UserRegistration: {
        type: "object",
        required: ["name", "email", "password"],
        properties: {
          name: { type: "string", example: "Ana" },
          email: { type: "string", format: "email", example: "ana@example.com" },
          password: { type: "string", format: "password", minLength: 8, writeOnly: true }
        }
      },
      PublicUser: {
        type: "object",
        required: ["id", "name", "email"],
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          email: { type: "string", format: "email" }
        }
      },
      BookingRequest: {
        type: "object",
        required: ["userId", "roomId", "date", "startTime", "endTime"],
        properties: {
          userId: { type: "string", format: "uuid" },
          roomId: { type: "string", example: "room-a" },
          date: { type: "string", format: "date", example: "2026-10-15" },
          startTime: { type: "string", example: "10:00" },
          endTime: { type: "string", example: "11:00" }
        }
      },
      CancelBookingRequest: {
        type: "object",
        required: ["userId"],
        properties: { userId: { type: "string", format: "uuid" } }
      },
      Booking: {
        type: "object",
        required: ["id", "userId", "roomId", "date", "startTime", "endTime", "status"],
        properties: {
          id: { type: "string", format: "uuid" },
          userId: { type: "string", format: "uuid" },
          roomId: { type: "string" },
          date: { type: "string", format: "date" },
          startTime: { type: "string" },
          endTime: { type: "string" },
          status: { type: "string", enum: ["CONFIRMED", "CANCELLED"] }
        }
      },
      Error: {
        type: "object",
        required: ["error", "message"],
        properties: {
          error: { type: "string", example: "INVALID_BOOKING" },
          message: { type: "string", example: "Los datos y el intervalo de la reserva deben ser válidos." }
        }
      }
    },
    responses: {
      BadRequest: {
        description: "Datos de entrada inválidos",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } }
      },
      NotFound: {
        description: "No se encontró el recurso",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } }
      }
    }
  }
};

export default openApiSpec;
