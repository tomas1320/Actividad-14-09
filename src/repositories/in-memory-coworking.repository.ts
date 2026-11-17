import { Booking, RefreshTokenRecord, Room, User } from "../domain/models";
import { CoworkingRepository } from "./coworking.repository";

export class InMemoryCoworkingRepository implements CoworkingRepository {
  private readonly rooms: Room[] = [
    { id: "room-a", name: "Sala A", capacity: 6 },
    { id: "room-b", name: "Sala B", capacity: 4 }
  ];

  private readonly users: User[] = [];
  private readonly bookings: Booking[] = [];
  private readonly refreshTokens: RefreshTokenRecord[] = [];

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

  createRefreshToken(token: RefreshTokenRecord): RefreshTokenRecord {
    this.removeInactiveRefreshTokens(Date.now());
    this.refreshTokens.push(token);
    return { ...token };
  }

  findRefreshTokenByHash(tokenHash: string): RefreshTokenRecord | undefined {
    const token = this.refreshTokens.find((record) => record.tokenHash === tokenHash);
    return token ? { ...token } : undefined;
  }

  consumeRefreshToken(tokenHash: string, now: number): RefreshTokenRecord | undefined {
    this.removeInactiveRefreshTokens(now);
    const token = this.refreshTokens.find((record) => record.tokenHash === tokenHash);
    if (!token || token.revokedAt !== undefined || token.expiresAt <= now) {
      return undefined;
    }

    token.revokedAt = now;
    return { ...token };
  }

  revokeRefreshTokenByHash(tokenHash: string, now: number): void {
    const token = this.refreshTokens.find((record) => record.tokenHash === tokenHash);
    if (token && token.revokedAt === undefined) {
      token.revokedAt = now;
    }
  }

  private removeInactiveRefreshTokens(now: number): void {
    for (let index = this.refreshTokens.length - 1; index >= 0; index -= 1) {
      const token = this.refreshTokens[index];
      if (token.revokedAt !== undefined || token.expiresAt <= now) {
        this.refreshTokens.splice(index, 1);
      }
    }
  }
}
