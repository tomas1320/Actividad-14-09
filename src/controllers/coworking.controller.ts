import { NextFunction, Request, Response } from "express";
import { AppError } from "../domain/app-error";
import { AuthenticatedUser } from "../middlewares/auth.middleware";
import { AuthService } from "../services/auth.service";
import { CoworkingService } from "../services/coworking.service";

export class CoworkingController {
  constructor(
    private readonly service: CoworkingService,
    private readonly authService: AuthService
  ) {}

  listRooms = (request: Request, response: Response, next: NextFunction): void => {
    try {
      const queryKeys = Object.keys(request.query);
      const availabilityKeys = ["date", "startTime", "endTime"];
      if (
        queryKeys.some((key) => !availabilityKeys.includes(key)) ||
        (queryKeys.length > 0 &&
          availabilityKeys.some((key) => typeof request.query[key] !== "string"))
      ) {
        throw new AppError(400, "INVALID_INTERVAL", "La consulta de disponibilidad no es válida.");
      }
      response.json(
        this.service.listRooms(
          queryString(request.query.date),
          queryString(request.query.startTime),
          queryString(request.query.endTime)
        )
      );
    } catch (error) {
      next(error);
    }
  };

  registerUser = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await this.service.registerUser(
        request.body?.name,
        request.body?.email,
        request.body?.password
      );
      response.status(201).json(user);
    } catch (error) {
      next(error);
    }
  };

  login = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.authService.login(request.body?.email, request.body?.password);
      response.json(result);
    } catch (error) {
      next(error);
    }
  };

  refresh = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const tokens = await this.authService.refresh(request.body?.refreshToken);
      response.json(tokens);
    } catch (error) {
      next(error);
    }
  };

  logout = (request: Request, response: Response, next: NextFunction): void => {
    try {
      this.authService.logout(request.body?.refreshToken);
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  };

  profile = (request: Request, response: Response, next: NextFunction): void => {
    try {
      const principal = getPrincipal(request);
      response.json(this.authService.getProfile(principal.userId));
    } catch (error) {
      next(error);
    }
  };

  createBooking = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const principal = getPrincipal(request);
      const booking = await this.service.createBooking(
        principal.userId,
        request.body?.roomId,
        request.body?.date,
        request.body?.startTime,
        request.body?.endTime
      );
      response.status(201).json(booking);
    } catch (error) {
      next(error);
    }
  };

  cancelBooking = (request: Request, response: Response, next: NextFunction): void => {
    try {
      const principal = getPrincipal(request);
      const booking = this.service.cancelBooking(
        pathParameter(request.params.id),
        principal.userId,
        principal.role
      );
      response.json(booking);
    } catch (error) {
      next(error);
    }
  };

  listBookings = (request: Request, response: Response, next: NextFunction): void => {
    try {
      const principal = getPrincipal(request);
      response.json(
        this.service.listBookings(
          pathParameter(request.params.userId),
          principal.userId,
          principal.role
        )
      );
    } catch (error) {
      next(error);
    }
  };

  listAllBookings = (_request: Request, response: Response, next: NextFunction): void => {
    try {
      response.json(this.service.listAllBookings());
    } catch (error) {
      next(error);
    }
  };
}

function queryString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function pathParameter(value: string | string[]): string {
  return typeof value === "string" ? value : "";
}

function getPrincipal(request: Request): AuthenticatedUser {
  if (!request.auth) {
    throw new AppError(401, "UNAUTHORIZED", "Se requiere un token Bearer válido.");
  }
  return request.auth;
}
