import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AppError } from "../domain/app-error";
import { PublicUser } from "../domain/models";
import { toPublicUser } from "../domain/user-utils";
import { CoworkingRepository } from "../repositories/coworking.repository";

export class AuthService {
  constructor(
    private readonly repository: CoworkingRepository,
    private readonly jwtSecret: string
  ) {}

  async login(email: unknown, password: unknown): Promise<{ token: string; user: PublicUser }> {
    if (typeof email !== "string" || typeof password !== "string") {
      throw invalidCredentialsError();
    }

    const user = this.repository.findUserByEmail(email.trim().toLowerCase());
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw invalidCredentialsError();
    }

    const token = jwt.sign(
      { role: user.role },
      this.jwtSecret,
      { algorithm: "HS256", subject: user.id, expiresIn: "1h" }
    );
    return { token, user: toPublicUser(user) };
  }

  getProfile(userId: string): PublicUser {
    const user = this.repository.findUserById(userId);
    if (!user) {
      throw new AppError(404, "RESOURCE_NOT_FOUND", "El usuario no existe.");
    }
    return toPublicUser(user);
  }
}

function invalidCredentialsError(): AppError {
  return new AppError(401, "INVALID_CREDENTIALS", "Email o contraseña incorrectos.");
}
