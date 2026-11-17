import { Router } from "express";
import { CoworkingController } from "../controllers/coworking.controller";
import { createAuthMiddleware, requireRoles } from "../middlewares/auth.middleware";

export function createCoworkingRouter(controller: CoworkingController, jwtSecret: string): Router {
  const router = Router();
  const authenticate = createAuthMiddleware(jwtSecret);

  router.get("/rooms", controller.listRooms);
  router.post("/users", controller.registerUser);
  router.post("/auth/login", controller.login);
  router.get("/auth/profile", authenticate, controller.profile);
  router.get("/users/:userId/bookings", authenticate, controller.listBookings);
  router.post("/bookings", authenticate, controller.createBooking);
  router.post("/bookings/:id/cancel", authenticate, controller.cancelBooking);
  router.get(
    "/management/bookings",
    authenticate,
    requireRoles("EDITOR", "ADMIN"),
    controller.listAllBookings
  );

  return router;
}
