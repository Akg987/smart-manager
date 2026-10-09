import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import type { FastifyRequest } from "fastify";
import { ExtractJwt, Strategy } from "passport-jwt";
import { AppException } from "../../../../../../common/http/app.exception";
import type { EnvironmentVariables } from "../../../../../../core/config/env.validation";
import { SessionService } from "../../session/session.service";
import { UserRepository } from "../../users/infrastructure/persistence/user.repository";
import type { AuthUser, JwtPayload } from "../auth.types";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService<EnvironmentVariables, true>,
    private readonly sessions: SessionService,
    private readonly users: UserRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get("JWT_ACCESS_SECRET", { infer: true }),
      passReqToCallback: true,
      ignoreExpiration: false,
    });
  }

  async validate(
    request: FastifyRequest,
    payload: JwtPayload,
  ): Promise<AuthUser> {
    const token = bearerToken(request);
    if (!token) {
      throw AppException.missingAuth();
    }
    const session = await this.sessions.findByAccessToken(token);
    if (!session || session.revokedAt) {
      throw AppException.sessionInvalid();
    }
    const user = await this.users.findById(payload.user_id);
    if (!user) {
      throw AppException.unauthorized();
    }
    if (!user.isActive) {
      throw AppException.userInactive();
    }
    return { userId: user.id, phone: user.phone, role: user.role };
  }
}

function bearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) {
    return null;
  }
  const [scheme, token] = value.split(" ");
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") {
    return null;
  }
  return token;
}
