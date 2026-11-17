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
    { name: "Auth", description: "Autenticación con JWT" },
    { name: "Rooms", description: "Consulta de salas y disponibilidad" },
    { name: "Users", description: "Registro y reservas por usuario" },
    { name: "Bookings", description: "Creación y cancelación de reservas" },
    { name: "Management", description: "Consulta global de reservas para EDITOR y ADMIN" }
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
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Iniciar sesión y obtener access y refresh tokens",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } } }
        },
        responses: {
          "200": {
            description: "Token firmado y perfil público",
            content: { "application/json": { schema: { $ref: "#/components/schemas/LoginResponse" } } }
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "429": { $ref: "#/components/responses/TooManyRequests" }
        }
      }
    },
    "/auth/refresh": {
      post: {
        tags: ["Auth"],
        summary: "Rotar access y refresh tokens",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/RefreshRequest" } } }
        },
        responses: {
          "200": {
            description: "Nuevo par de tokens; el refresh token anterior queda revocado",
            content: { "application/json": { schema: { $ref: "#/components/schemas/TokenPair" } } }
          },
          "401": { $ref: "#/components/responses/Unauthorized" }
        }
      }
    },
    "/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Revocar un refresh token",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/RefreshRequest" } } }
        },
        responses: {
          "204": { description: "Refresh token revocado" },
          "400": { $ref: "#/components/responses/BadRequest" }
        }
      }
    },
    "/auth/profile": {
      get: {
        tags: ["Auth"],
        summary: "Consultar el perfil asociado al token",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Perfil público del usuario autenticado",
            content: { "application/json": { schema: { $ref: "#/components/schemas/PublicUser" } } }
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" }
        }
      }
    },
    "/users/{userId}/bookings": {
      get: {
        tags: ["Users"],
        summary: "Listar reservas de un usuario",
        security: [{ bearerAuth: [] }],
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
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" }
        }
      }
    },
    "/bookings": {
      post: {
        tags: ["Bookings"],
        summary: "Crear reserva",
        security: [{ bearerAuth: [] }],
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
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
          "409": { description: "La sala ya está reservada en ese intervalo", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } }
        }
      }
    },
    "/bookings/{id}/cancel": {
      post: {
        tags: ["Bookings"],
        summary: "Cancelar reserva",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" }
          }
        ],
        responses: {
          "200": {
            description: "Reserva cancelada",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Booking" } } }
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
          "409": { description: "La reserva ya estaba cancelada", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } }
        }
      }
    },
    "/management/bookings": {
      get: {
        tags: ["Management"],
        summary: "Listar todas las reservas (EDITOR o ADMIN)",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Todas las reservas",
            content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Booking" } } } }
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" }
        }
      }
    }
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT"
      }
    },
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
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email", example: "ana@example.com" },
          password: { type: "string", format: "password", writeOnly: true }
        }
      },
      LoginResponse: {
        type: "object",
        required: ["accessToken", "refreshToken", "tokenType", "expiresIn", "user"],
        properties: {
          accessToken: { type: "string", description: "JWT Bearer token válido durante 15 minutos" },
          refreshToken: { type: "string", description: "Token opaco de un solo uso, válido durante siete días" },
          tokenType: { type: "string", enum: ["Bearer"] },
          expiresIn: { type: "integer", example: 900 },
          user: { $ref: "#/components/schemas/PublicUser" }
        }
      },
      TokenPair: {
        $ref: "#/components/schemas/LoginResponse"
      },
      RefreshRequest: {
        type: "object",
        required: ["refreshToken"],
        properties: { refreshToken: { type: "string", writeOnly: true } }
      },
      PublicUser: {
        type: "object",
        required: ["id", "name", "email", "role"],
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          email: { type: "string", format: "email" },
          role: { type: "string", enum: ["USER", "EDITOR", "ADMIN"] }
        }
      },
      BookingRequest: {
        type: "object",
        required: ["roomId", "date", "startTime", "endTime"],
        properties: {
          roomId: { type: "string", example: "room-a" },
          date: { type: "string", format: "date", example: "2026-10-15" },
          startTime: { type: "string", example: "10:00" },
          endTime: { type: "string", example: "11:00" }
        }
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
      Unauthorized: {
        description: "Se requiere un token válido",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } }
      },
      Forbidden: {
        description: "Token inválido o rol sin permisos",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } }
      },
      TooManyRequests: {
        description: "Se excedió el límite de intentos de inicio de sesión",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } }
      },
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
