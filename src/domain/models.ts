export interface Room {
  id: string;
  name: string;
  capacity: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
}

export type BookingStatus = "CONFIRMED" | "CANCELLED";

export interface Booking {
  id: string;
  userId: string;
  roomId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
}
