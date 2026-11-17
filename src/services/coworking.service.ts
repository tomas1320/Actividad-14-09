import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { AppError } from "../domain/app-error";
import { Booking, PublicUser, Room, User, UserRole } from "../domain/models";
import { CoworkingRepository } from "../repositories/coworking.repository";
import { toPublicUser } from "../domain/user-utils";

export class CoworkingService {
  constructor(private readonly repository: CoworkingRepository) {}

  listRooms(date?: string, startTime?: string, endTime?: string): Room[] {
    const hasAvailabilityQuery = date !== undefined || startTime !== undefined || endTime !== undefined;
    if (!hasAvailabilityQuery) {
      return this.repository.listRooms();
    }

    if (!date || !startTime || !endTime || !isValidDate(date) || !isValidTime(startTime) || !isValidTime(endTime)) {
      throw new AppError(400, "INVALID_INTERVAL", "La fecha y el horario deben ser válidos.");
    }
    if (endTime <= startTime) {
      throw new AppError(400, "INVALID_INTERVAL", "La hora final debe ser posterior a la inicial.");
    }

    return this.repository.listRooms().filter((room) =>
      this.repository
        .listConfirmedBookingsForRoom(room.id, date)
        .every((booking) => !intervalsOverlap(startTime, endTime, booking.startTime, booking.endTime))
    );
  }

  async registerUser(name: unknown, email: unknown, password: unknown): Promise<PublicUser> {
    if (
      typeof name !== "string" ||
      name.trim().length === 0 ||
      typeof email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      typeof password !== "string" ||
      password.length < 8
    ) {
      throw new AppError(400, "INVALID_USER", "Nombre, email válido y contraseña de al menos 8 caracteres son requeridos.");
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (this.repository.findUserByEmail(normalizedEmail)) {
      throw new AppError(409, "EMAIL_IN_USE", "El email ya está registrado.");
    }

    const user: User = {
      id: randomUUID(),
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: await bcrypt.hash(password, 10),
      role: "USER"
    };
    this.repository.createUser(user);
    return toPublicUser(user);
  }

  async createBooking(
    userId: unknown,
    roomId: unknown,
    date: unknown,
    startTime: unknown,
    endTime: unknown
  ): Promise<Booking> {
    if (
      typeof userId !== "string" ||
      typeof roomId !== "string" ||
      typeof date !== "string" ||
      typeof startTime !== "string" ||
      typeof endTime !== "string" ||
      !isValidDate(date) ||
      !isValidTime(startTime) ||
      !isValidTime(endTime) ||
      endTime <= startTime
    ) {
      throw new AppError(400, "INVALID_BOOKING", "Los datos y el intervalo de la reserva deben ser válidos.");
    }
    if (!this.repository.findUserById(userId) || !this.repository.findRoomById(roomId)) {
      throw new AppError(404, "RESOURCE_NOT_FOUND", "El usuario o la sala no existe.");
    }

    const overlaps = this.repository
      .listConfirmedBookingsForRoom(roomId, date)
      .some((booking) => intervalsOverlap(startTime, endTime, booking.startTime, booking.endTime));
    if (overlaps) {
      throw new AppError(409, "ROOM_UNAVAILABLE", "La sala ya está reservada durante ese intervalo.");
    }

    return this.repository.createBooking({
      id: randomUUID(),
      userId,
      roomId,
      date,
      startTime,
      endTime,
      status: "CONFIRMED"
    });
  }

  cancelBooking(bookingId: string, userId: string, role: UserRole): Booking {
    const booking = this.repository.findBookingById(bookingId);
    if (!booking || (role !== "ADMIN" && booking.userId !== userId)) {
      throw new AppError(404, "RESOURCE_NOT_FOUND", "La reserva no existe.");
    }
    if (booking.status === "CANCELLED") {
      throw new AppError(409, "BOOKING_ALREADY_CANCELLED", "La reserva ya está cancelada.");
    }

    return this.repository.updateBooking({ ...booking, status: "CANCELLED" });
  }

  listBookings(userId: string, requestingUserId: string, role: UserRole): Booking[] {
    if (!this.repository.findUserById(userId)) {
      throw new AppError(404, "RESOURCE_NOT_FOUND", "El usuario no existe.");
    }
    if (role === "USER" && userId !== requestingUserId) {
      throw new AppError(404, "RESOURCE_NOT_FOUND", "El usuario no existe.");
    }
    return this.repository.listBookingsForUser(userId);
  }

  listAllBookings(): Booking[] {
    return this.repository.listAllBookings();
  }
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isValidTime(value: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function intervalsOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  return startA < endB && endA > startB;
}
