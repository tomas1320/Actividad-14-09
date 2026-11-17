import { NextFunction, Request, RequestHandler, Response } from "express";
import jwt from "jsonwebtoken";
import { UserRole } from "../domain/models";

declare module "express-serve-static-core" {
  interface Request {
    auth?: AuthenticatedUser;
  }
}

export interface AuthenticatedUser {
  userId: string;
  role: UserRole;
}

export function createAuthMiddleware(jwtSecret: string): RequestHandler {
  return (request, response, next) => {
    const token = request.header("authorization")?.match(/^Bearer\s+([^\s]+)$/i)?.[1];
    if (!token) {
      sendUnauthorized(response);
      return;
    }

    try {
      const payload = jwt.verify(token, jwtSecret, { algorithms: ["HS256"] });
      if (
        typeof payload === "string" ||
        typeof payload.sub !== "string" ||
        !isUserRole(payload.role)
      ) {
        sendInvalidToken(response);
        return;
      }

      request.auth = { userId: payload.sub, role: payload.role };
      next();
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        sendInvalidToken(response);
        return;
      }
      next(error);
    }
  };
}

export function requireRoles(...roles: UserRole[]): RequestHandler {
  return (request: Request, response: Response, next: NextFunction): void => {
    if (!request.auth) {
      sendUnauthorized(response);
      return;
    }
    if (!roles.includes(request.auth.role)) {
      response.status(403).json({
        error: "FORBIDDEN",
        message: "No tienes los permisos necesarios."
      });
      return;
    }
    next();
  };
}

function isUserRole(value: unknown): value is UserRole {
  return value === "USER" || value === "EDITOR" || value === "ADMIN";
}

function sendUnauthorized(response: Response): void {
  response.status(401).json({
    error: "UNAUTHORIZED",
    message: "Se requiere un token Bearer válido."
  });
}

function sendInvalidToken(response: Response): void {
  response.status(403).json({
    error: "INVALID_TOKEN",
    message: "El token es inválido o expiró."
  });
}
