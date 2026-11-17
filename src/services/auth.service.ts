import bcrypt from "bcryptjs";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { AppError } from "../domain/app-error";
import { PublicUser, User } from "../domain/models";
import { toPublicUser } from "../domain/user-utils";
import { CoworkingRepository } from "../repositories/coworking.repository";

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  user: PublicUser;
}

export class AuthService {
  constructor(
    private readonly repository: CoworkingRepository,
    private readonly jwtSecret: string
  ) {}

  async login(email: unknown, password: unknown): Promise<TokenPair> {
    if (typeof email !== "string" || typeof password !== "string") {
      throw invalidCredentialsError();
    }

    const user = this.repository.findUserByEmail(email.trim().toLowerCase());
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw invalidCredentialsError();
    }
    return this.issueTokenPair(user);
  }

  async refresh(refreshToken: unknown): Promise<TokenPair> {
    if (!isRefreshToken(refreshToken)) {
      throw invalidRefreshTokenError();
    }

    const now = Date.now();
    const tokenRecord = this.repository.consumeRefreshToken(hashToken(refreshToken), now);
    if (!tokenRecord) {
      throw invalidRefreshTokenError();
    }

    const user = this.repository.findUserById(tokenRecord.userId);
    if (!user) {
      throw invalidRefreshTokenError();
    }
    return this.issueTokenPair(user, now);
  }

  logout(refreshToken: unknown): void {
    if (!isRefreshToken(refreshToken)) {
      throw new AppError(400, "INVALID_REFRESH_TOKEN", "Se requiere un refresh token válido.");
    }
    this.repository.revokeRefreshTokenByHash(hashToken(refreshToken), Date.now());
  }

  getProfile(userId: string): PublicUser {
    const user = this.repository.findUserById(userId);
    if (!user) {
      throw new AppError(404, "RESOURCE_NOT_FOUND", "El usuario no existe.");
    }
    return toPublicUser(user);
  }

  private issueTokenPair(user: User, now = Date.now()): TokenPair {
    const accessToken = jwt.sign(
      { role: user.role, jti: randomUUID() },
      this.jwtSecret,
      {
        algorithm: "HS256",
        subject: user.id,
        expiresIn: ACCESS_TOKEN_TTL_SECONDS
      }
    );
    const refreshToken = randomBytes(32).toString("base64url");
    this.repository.createRefreshToken({
      id: randomUUID(),
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: now + REFRESH_TOKEN_TTL_MS
    });

    return {
      accessToken,
      refreshToken,
      tokenType: "Bearer",
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      user: toPublicUser(user)
    };
  }
}

function isRefreshToken(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[A-Za-z0-9_-]{43}$/.test(value)
  );
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function invalidCredentialsError(): AppError {
  return new AppError(401, "INVALID_CREDENTIALS", "Email o contraseña incorrectos.");
}

function invalidRefreshTokenError(): AppError {
  return new AppError(401, "INVALID_REFRESH_TOKEN", "El refresh token no es válido o expiró.");
}
