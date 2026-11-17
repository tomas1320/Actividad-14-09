import { Booking, RefreshTokenRecord, Room, User } from "../domain/models";

export interface CoworkingRepository {
  listRooms(): Room[];
  findRoomById(id: string): Room | undefined;
  findUserById(id: string): User | undefined;
  findUserByEmail(email: string): User | undefined;
  createUser(user: User): User;
  listBookingsForUser(userId: string): Booking[];
  listAllBookings(): Booking[];
  findBookingById(id: string): Booking | undefined;
  listConfirmedBookingsForRoom(roomId: string, date: string): Booking[];
  createBooking(booking: Booking): Booking;
  updateBooking(booking: Booking): Booking;
  createRefreshToken(token: RefreshTokenRecord): RefreshTokenRecord;
  findRefreshTokenByHash(tokenHash: string): RefreshTokenRecord | undefined;
  consumeRefreshToken(tokenHash: string, now: number): RefreshTokenRecord | undefined;
  revokeRefreshTokenByHash(tokenHash: string, now: number): void;
}
