import { Booking, Room, User } from "../domain/models";
import { CoworkingRepository } from "./coworking.repository";

export class InMemoryCoworkingRepository implements CoworkingRepository {
  private readonly rooms: Room[] = [
    { id: "room-a", name: "Sala A", capacity: 6 },
    { id: "room-b", name: "Sala B", capacity: 4 }
  ];

  private readonly users: User[] = [];
  private readonly bookings: Booking[] = [];

  listRooms(): Room[] {
    return [...this.rooms];
  }

  findRoomById(id: string): Room | undefined {
    return this.rooms.find((room) => room.id === id);
  }

  findUserById(id: string): User | undefined {
    return this.users.find((user) => user.id === id);
  }

  findUserByEmail(email: string): User | undefined {
    return this.users.find((user) => user.email === email);
  }

  createUser(user: User): User {
    this.users.push(user);
    return user;
  }

  listBookingsForUser(userId: string): Booking[] {
    return this.bookings
      .filter((booking) => booking.userId === userId)
      .map((booking) => ({ ...booking }));
  }

  listAllBookings(): Booking[] {
    return this.bookings.map((booking) => ({ ...booking }));
  }

  findBookingById(id: string): Booking | undefined {
    return this.bookings.find((booking) => booking.id === id);
  }

  listConfirmedBookingsForRoom(roomId: string, date: string): Booking[] {
    return this.bookings.filter(
      (booking) =>
        booking.roomId === roomId &&
        booking.date === date &&
        booking.status === "CONFIRMED"
    );
  }

  createBooking(booking: Booking): Booking {
    this.bookings.push(booking);
    return booking;
  }

  updateBooking(booking: Booking): Booking {
    const index = this.bookings.findIndex((existing) => existing.id === booking.id);
    this.bookings[index] = booking;
    return booking;
  }
}
