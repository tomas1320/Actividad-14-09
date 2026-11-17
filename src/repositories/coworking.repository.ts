import { Booking, Room, User } from "../domain/models";

export interface CoworkingRepository {
  listRooms(): Room[];
  findRoomById(id: string): Room | undefined;
  findUserById(id: string): User | undefined;
  findUserByEmail(email: string): User | undefined;
  createUser(user: User): User;
  listBookingsForUser(userId: string): Booking[];
  findBookingById(id: string): Booking | undefined;
  listConfirmedBookingsForRoom(roomId: string, date: string): Booking[];
  createBooking(booking: Booking): Booking;
  updateBooking(booking: Booking): Booking;
}
