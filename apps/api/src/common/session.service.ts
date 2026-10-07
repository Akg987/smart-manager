import { Injectable, UnauthorizedException } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import type { FastifyRequest } from "fastify";
import { users } from "../../../../src/db/schema.js";
import { SessionRepository } from "./session.repository.js";
import {
  removeCookie,
  requestIp,
  requestUserAgent,
  writeCookie,
  type AppRequest,
  type CookieWriter,
} from "./http.js";

export const SESSION_COOKIE = "smart_manager_session";
const sessionLifetimeSeconds = 60 * 60 * 12;
const rememberedLifetimeSeconds = 60 * 60 * 24 * 30;

const cookieBase = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

@Injectable()
export class SessionService {
  constructor(private readonly sessions: SessionRepository) {}

  async create(
    userId: bigint,
    request: FastifyRequest,
    response: CookieWriter,
    remember = false,
  ) {
    const id = randomBytes(32).toString("base64url");
    const now = Math.floor(Date.now() / 1000);
    await this.sessions.insertSession({
      id,
      userId,
      ipAddress: requestIp(request),
      userAgent: requestUserAgent(request),
      payload: JSON.stringify({ remember }),
      lastActivity: now,
    });
    writeCookie(response, SESSION_COOKIE, id, {
      ...cookieBase,
      ...(remember ? { maxAge: rememberedLifetimeSeconds * 1000 } : {}),
    });
  }

  async createPending(
    userId: bigint,
    request: FastifyRequest,
    response: CookieWriter,
    remember: boolean,
  ) {
    const id = randomBytes(32).toString("base64url");
    const now = Math.floor(Date.now() / 1000);
    await this.sessions.insertSession({
      id,
      userId: null,
      ipAddress: requestIp(request),
      userAgent: requestUserAgent(request),
      payload: JSON.stringify({
        purpose: "two-factor",
        pendingUserId: userId.toString(),
        remember,
        expiresAt: now + 10 * 60,
      }),
      lastActivity: now,
    });
    writeCookie(response, SESSION_COOKIE, id, {
      ...cookieBase,
      maxAge: 10 * 60 * 1000,
    });
  }

  async pendingUser(
    request: FastifyRequest & { cookies?: Record<string, string | undefined> },
  ) {
    const id = request.cookies?.[SESSION_COOKIE];
    if (typeof id !== "string")
      throw new UnauthorizedException("A two-factor challenge is not pending.");
    const [session] = await this.sessions.findById(id);
    let payload: {
      purpose?: string;
      pendingUserId?: string;
      remember?: boolean;
      expiresAt?: number;
    };
    try {
      payload = JSON.parse(session?.payload ?? "{}");
    } catch {
      throw new UnauthorizedException("A two-factor challenge is not pending.");
    }
    if (
      !session ||
      session.userId !== null ||
      payload.purpose !== "two-factor" ||
      !payload.pendingUserId ||
      !payload.expiresAt ||
      payload.expiresAt <= Math.floor(Date.now() / 1000)
    )
      throw new UnauthorizedException("A two-factor challenge is not pending.");
    const [user] = await this.sessions.findUserById(
      BigInt(payload.pendingUserId),
    );
    if (!user?.approvedAt)
      throw new UnauthorizedException("A two-factor challenge is not pending.");
    return { user, remember: payload.remember === true };
  }

  async completePending(
    request: FastifyRequest & { cookies?: Record<string, string | undefined> },
    response: CookieWriter,
  ) {
    const id = request.cookies?.[SESSION_COOKIE];
    if (typeof id !== "string")
      throw new UnauthorizedException("A two-factor challenge is not pending.");
    const result = await this.sessions.runTransaction(async (tx) => {
      const [session] = await tx
        .select()
        .from(this.sessions.sessions)
        .where(eq(this.sessions.sessions.id, id))
        .for("update")
        .limit(1);
      let payload: {
        purpose?: string;
        pendingUserId?: string;
        remember?: boolean;
        expiresAt?: number;
      };
      try {
        payload = JSON.parse(session?.payload ?? "{}");
      } catch {
        throw new UnauthorizedException(
          "A two-factor challenge is not pending.",
        );
      }
      if (
        !session ||
        session.userId !== null ||
        payload.purpose !== "two-factor" ||
        !payload.pendingUserId ||
        !payload.expiresAt ||
        payload.expiresAt <= Math.floor(Date.now() / 1000)
      )
        throw new UnauthorizedException(
          "A two-factor challenge is not pending.",
        );
      const userId = BigInt(payload.pendingUserId);
      const [user] = await tx
        .select()
        .from(this.sessions.users)
        .where(eq(this.sessions.users.id, userId))
        .limit(1);
      if (!user?.approvedAt)
        throw new UnauthorizedException(
          "A two-factor challenge is not pending.",
        );
      const nextId = randomBytes(32).toString("base64url");
      const now = Math.floor(Date.now() / 1000);
      await tx
        .delete(this.sessions.sessions)
        .where(eq(this.sessions.sessions.id, id));
      await tx.insert(this.sessions.sessions).values({
        id: nextId,
        userId,
        ipAddress: requestIp(request),
        userAgent: requestUserAgent(request),
        payload: JSON.stringify({ remember: payload.remember === true }),
        lastActivity: now,
      });
      return { id: nextId, remember: payload.remember === true };
    });
    writeCookie(response, SESSION_COOKIE, result.id, {
      ...cookieBase,
      ...(result.remember ? { maxAge: rememberedLifetimeSeconds * 1000 } : {}),
    });
  }

  async user(
    request: FastifyRequest & { cookies?: Record<string, string | undefined> },
  ) {
    const id = request.cookies?.[SESSION_COOKIE];
    if (typeof id !== "string" || id.length < 40)
      throw new UnauthorizedException("Authentication required.");
    const [row] = await this.sessions.findActive(id);
    let remember = false;
    try {
      remember = JSON.parse(row?.session.payload ?? "{}").remember === true;
    } catch {
      /* invalid session payload expires by the short policy */
    }
    const cutoff =
      Math.floor(Date.now() / 1000) -
      (remember ? rememberedLifetimeSeconds : sessionLifetimeSeconds);
    if (!row?.user.approvedAt || row.session.lastActivity <= cutoff)
      throw new UnauthorizedException("Authentication required.");
    await this.sessions.touch(id, Math.floor(Date.now() / 1000));
    return row.user;
  }

  async destroy(
    request: FastifyRequest & { cookies?: Record<string, string | undefined> },
    response: CookieWriter,
  ) {
    const id = request.cookies?.[SESSION_COOKIE];
    if (typeof id === "string") await this.sessions.deleteById(id);
    removeCookie(response, SESSION_COOKIE, cookieBase);
  }

  async regenerate(
    request: FastifyRequest & { cookies?: Record<string, string | undefined> },
    response: CookieWriter,
    userId: bigint,
  ) {
    const previousId = request.cookies?.[SESSION_COOKIE];
    const nextId = randomBytes(32).toString("base64url");
    const now = Math.floor(Date.now() / 1000);
    const remember = await this.sessions.runTransaction(async (tx) => {
      let remember = false;
      if (typeof previousId === "string") {
        const [previous] = await tx
          .select()
          .from(this.sessions.sessions)
          .where(eq(this.sessions.sessions.id, previousId))
          .limit(1);
        try {
          remember = JSON.parse(previous?.payload ?? "{}").remember === true;
        } catch {
          /* use standard session lifetime */
        }
        await tx
          .delete(this.sessions.sessions)
          .where(eq(this.sessions.sessions.id, previousId));
      }
      await tx.insert(this.sessions.sessions).values({
        id: nextId,
        userId,
        ipAddress: requestIp(request),
        userAgent: requestUserAgent(request),
        payload: JSON.stringify({ remember }),
        lastActivity: now,
      });
      return remember;
    });
    writeCookie(response, SESSION_COOKIE, nextId, {
      ...cookieBase,
      ...(remember ? { maxAge: rememberedLifetimeSeconds * 1000 } : {}),
    });
  }
}

export interface AuthenticatedRequest extends AppRequest {
  currentUser: typeof users.$inferSelect;
}
