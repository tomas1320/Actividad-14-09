import express, { ErrorRequestHandler } from "express";
import { AppError } from "./domain/app-error";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { CoworkingRepository } from "./repositories/coworking.repository";
import { InMemoryCoworkingRepository } from "./repositories/in-memory-coworking.repository";
import { createCoworkingRouter } from "./routes/coworking.routes";
import { AuthService } from "./services/auth.service";
import { CoworkingService } from "./services/coworking.service";
import { CoworkingController } from "./controllers/coworking.controller";
import openApiSpec from "./docs/openapi";

export interface AppOptions {
  allowedOrigins?: string[];
}

export function createApp(
  repository: CoworkingRepository = new InMemoryCoworkingRepository(),
  jwtSecret: string | undefined = process.env.JWT_SECRET,
  options: AppOptions = {}
): express.Express {
  if (!jwtSecret || Buffer.byteLength(jwtSecret) < 32) {
    throw new Error("JWT_SECRET debe configurarse con al menos 32 bytes.");
  }

  const allowedOrigins = resolveAllowedOrigins(options.allowedOrigins);
  const app = express();
  const service = new CoworkingService(repository);
  const authService = new AuthService(repository, jwtSecret);
  const controller = new CoworkingController(service, authService);

  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new AppError(403, "CORS_ORIGIN_DENIED", "El origen no está permitido."));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
    maxAge: 600
  }));
  app.use(express.json({ limit: "10kb" }));
  app.get("/api-docs.json", (_request, response) => {
    response.json(openApiSpec);
  });
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));
  app.use(createCoworkingRouter(controller, jwtSecret));
  app.use((_request, response) => {
    response.status(404).json({ error: "NOT_FOUND", message: "La ruta solicitada no existe." });
  });
  app.use(errorHandler);

  return app;
}

function resolveAllowedOrigins(override?: string[]): string[] {
  const configuredOrigins = override ??
    process.env.CORS_ALLOWED_ORIGINS?.split(",").map((origin) => origin.trim());
  if (!configuredOrigins) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("CORS_ALLOWED_ORIGINS debe configurarse en producción.");
    }
    return ["http://localhost:3000", "http://127.0.0.1:3000"];
  }
  if (configuredOrigins.length === 0 || configuredOrigins.includes("*")) {
    throw new Error("CORS_ALLOWED_ORIGINS debe contener orígenes explícitos; '*' no está permitido.");
  }

  const origins = configuredOrigins.map((origin) => {
    let parsedOrigin: URL;
    try {
      parsedOrigin = new URL(origin);
    } catch {
      throw new Error(`Origen CORS inválido: ${origin}`);
    }
    if (
      parsedOrigin.origin !== origin ||
      !["http:", "https:"].includes(parsedOrigin.protocol) ||
      (process.env.NODE_ENV === "production" && parsedOrigin.protocol !== "https:")
    ) {
      throw new Error(`Origen CORS no seguro: ${origin}`);
    }
    return origin;
  });
  return [...new Set(origins)];
}

const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, next) => {
  void next;
  if (error instanceof AppError) {
    response.status(error.statusCode).json({ error: error.code, message: error.message });
    return;
  }
  if (error instanceof SyntaxError && "status" in error && error.status === 400) {
    response.status(400).json({ error: "INVALID_JSON", message: "El cuerpo JSON no es válido." });
    return;
  }
  console.error(error);
  response.status(500).json({ error: "INTERNAL_ERROR", message: "Ocurrió un error interno." });
};
