import { Router } from "express";
import { CoworkingController } from "../controllers/coworking.controller";

export function createCoworkingRouter(controller: CoworkingController): Router {
  const router = Router();

  router.get("/rooms", controller.listRooms);
  router.post("/users", controller.registerUser);
  router.get("/users/:userId/bookings", controller.listBookings);
  router.post("/bookings", controller.createBooking);
  router.post("/bookings/:id/cancel", controller.cancelBooking);

  return router;
}
