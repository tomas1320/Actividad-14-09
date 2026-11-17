import express, { ErrorRequestHandler } from "express";
import { AppError } from "./domain/app-error";
import swaggerUi from "swagger-ui-express";
import { CoworkingRepository } from "./repositories/coworking.repository";
import { InMemoryCoworkingRepository } from "./repositories/in-memory-coworking.repository";
import { createCoworkingRouter } from "./routes/coworking.routes";
import { CoworkingService } from "./services/coworking.service";
import { CoworkingController } from "./controllers/coworking.controller";
import openApiSpec from "./docs/openapi";

export function createApp(
  repository: CoworkingRepository = new InMemoryCoworkingRepository()
): express.Express {
  const app = express();
  const service = new CoworkingService(repository);
  const controller = new CoworkingController(service);

  app.use(express.json({ limit: "10kb" }));
  app.get("/api-docs.json", (_request, response) => {
    response.json(openApiSpec);
  });
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));
  app.use(createCoworkingRouter(controller));
  app.use((_request, response) => {
    response.status(404).json({ error: "NOT_FOUND", message: "La ruta solicitada no existe." });
  });
  app.use(errorHandler);

  return app;
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
