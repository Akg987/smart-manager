import { Injectable, UnauthorizedException } from "@nestjs/common";
import { randomBytes, randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import type { FastifyRequest } from "fastify";
import { users } from "../../../../src/db/schema.js";
import {
  hashSmartManagerRefreshToken,
  issueSmartManagerAccessToken,
  issueSmartManagerRefreshToken,
  verifySmartManagerAccessToken,
  verifySmartManagerRefreshToken,
} from "../module/auth/smart-manager-jwt.js";
import type { SmartManagerAuthContext } from "../module/permissions/smart-manager-authorization.js";
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
export const REFRESH_COOKIE = "smart_manager_refresh";
const rememberedLifetimeSeconds = 60 * 60 * 24 * 30;
const refreshLifetimeSeconds = 60 * 60 * 24 * 7;
const accessLifetimeSeconds = 60 * 15;

const cookieBase = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

@Injectable()
export class SessionService {
  constructor(private readonly sessions: SessionRepository) {}

  private async issueSession(
    userId: bigint,
    membershipId: bigint,
    request: FastifyRequest,
    response: CookieWriter,
    remember = false,
    activeCompanyId?: bigint | null,
  ) {
    const membershipRow = await this.sessions.membershipForUser(
      userId,
      membershipId,
    );
    if (!membershipRow?.user.approvedAt)
      throw new UnauthorizedException("Tenant membership required.");
    const membership = membershipRow.membership;
    const companyId = activeCompanyId ?? membership.companyId;
    if (companyId !== null) {
      const company = await this.sessions.activeCompanyInHolding(
        membership.holdingId,
        companyId,
      );
      if (
        !company ||
        (membership.companyId && membership.companyId !== companyId)
      )
        throw new UnauthorizedException("Tenant membership required.");
    }
    const roles = await this.sessions.rolesForMembership(membership.id);
    if (roles.length === 0)
      throw new UnauthorizedException("Tenant membership required.");

    const sessionId = randomUUID();
    const now = new Date();
    const sessionTtl = remember
      ? rememberedLifetimeSeconds
      : refreshLifetimeSeconds;
    const expiresAt = new Date(now.getTime() + sessionTtl * 1000);
    const tokenVersion = 1;
    await this.sessions.insertAuthSession({
      id: sessionId,
      userId,
      membershipId: membership.id,
      activeCompanyId: companyId,
      tokenVersion,
      ipAddress: requestIp(request),
      userAgent: requestUserAgent(request),
      expiresAt,
      lastActivityAt: now,
    });
    const claims = {
      sub: userId.toString(),
      sessionId,
      holdingId: membership.holdingId.toString(),
      membershipId: membership.id.toString(),
      activeCompanyId: companyId?.toString() ?? null,
      roleIds: roles.map((role) => role.id.toString()),
      scopeType: membership.scopeType,
      tokenVersion,
    };
    const accessToken = issueSmartManagerAccessToken(
      claims,
      accessLifetimeSeconds,
    );
    const refresh = issueSmartManagerRefreshToken(
      {
        sub: userId.toString(),
        sessionId,
        membershipId: membership.id.toString(),
        tokenVersion,
      },
      sessionTtl,
    );
    await this.sessions.insertRefreshToken({
      id: refresh.id,
      sessionId,
      tokenHash: refresh.tokenHash,
      expiresAt: new Date(Date.now() + sessionTtl * 1000),
    });
    writeCookie(response, SESSION_COOKIE, accessToken, {
      ...cookieBase,
      ...(remember ? { maxAge: accessLifetimeSeconds * 1000 } : {}),
    });
    writeCookie(response, REFRESH_COOKIE, refresh.token, {
      ...cookieBase,
      path: "/api/auth",
      ...(remember ? { maxAge: sessionTtl * 1000 } : {}),
    });
  }

  async create(
    userId: bigint,
    request: FastifyRequest,
    response: CookieWriter,
    remember = false,
  ) {
    const membership = await this.sessions.defaultMembershipForUser(userId);
    if (!membership)
      throw new UnauthorizedException("Tenant membership required.");
    await this.issueSession(userId, membership.id, request, response, remember);
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
      await tx
        .delete(this.sessions.sessions)
        .where(eq(this.sessions.sessions.id, id));
      return { userId, remember: payload.remember === true };
    });
    const membership = await this.sessions.defaultMembershipForUser(
      result.userId,
    );
    if (!membership)
      throw new UnauthorizedException("Tenant membership required.");
    await this.issueSession(
      result.userId,
      membership.id,
      request as FastifyRequest,
      response,
      result.remember,
    );
  }

  async user(
    request: FastifyRequest & { cookies?: Record<string, string | undefined> },
  ) {
    const id = request.cookies?.[SESSION_COOKIE];
    if (typeof id !== "string")
      throw new UnauthorizedException("Authentication required.");
    const claims = verifySmartManagerAccessToken(id);
    if (
      !claims ||
      !/^\d+$/.test(claims.sub) ||
      !/^\d+$/.test(claims.membershipId)
    )
      throw new UnauthorizedException("Authentication required.");
    const row = await this.sessions.findAuthSession(claims.sessionId);
    const now = new Date();
    if (
      !row?.user.approvedAt ||
      row.session.userId.toString() !== claims.sub ||
      row.session.membershipId.toString() !== claims.membershipId ||
      row.session.tokenVersion !== claims.tokenVersion ||
      row.session.revokedAt !== null ||
      row.session.expiresAt <= now ||
      row.membership.holdingId.toString() !== claims.holdingId ||
      row.membership.status !== "active"
    )
      throw new UnauthorizedException("Authentication required.");

    const activeCompanyId = claims.activeCompanyId
      ? BigInt(claims.activeCompanyId)
      : row.membership.companyId;
    if (activeCompanyId !== null) {
      const activeCompany = await this.sessions.activeCompanyInHolding(
        row.membership.holdingId,
        activeCompanyId,
      );
      if (
        !activeCompany ||
        (row.membership.companyId &&
          row.membership.companyId !== activeCompanyId)
      )
        throw new UnauthorizedException("Authentication required.");
    }
    if (row.session.activeCompanyId !== activeCompanyId)
      throw new UnauthorizedException("Authentication required.");

    const roles = await this.sessions.rolesForMembership(row.membership.id);
    const roleIds = roles.map((role) => role.id.toString());
    if (
      roleIds.length === 0 ||
      [...roleIds].sort().join(",") !== [...claims.roleIds].sort().join(",")
    )
      throw new UnauthorizedException("Authentication required.");

    const appRequest = request as AuthenticatedRequest;
    appRequest.authContext = {
      userId: row.user.id.toString(),
      holdingId: row.membership.holdingId.toString(),
      membershipId: row.membership.id.toString(),
      companyId: activeCompanyId?.toString() ?? null,
      branchId: row.membership.branchId?.toString() ?? null,
      businessUnitId: row.membership.businessUnitId?.toString() ?? null,
      roleIds,
      scopeType: row.membership.scopeType,
    };
    await this.sessions.runAuthTransaction(async (tx) => {
      await tx
        .update(this.sessions.authSessions)
        .set({ lastActivityAt: now })
        .where(eq(this.sessions.authSessions.id, claims.sessionId));
    });
    return row.user;
  }

  async membershipsForUser(userId: bigint) {
    const memberships = await this.sessions.listMembershipsForUser(userId);
    const result = [];
    for (const row of memberships) {
      const roles = await this.sessions.rolesForMembership(row.membership.id);
      if (
        row.membership.scopeType === "holding" &&
        row.membership.companyId === null
      ) {
        const companies = await this.sessions.listCompaniesInHolding(
          row.membership.holdingId,
        );
        result.push(
          ...companies.map((company) => ({
            membershipId: row.membership.id.toString(),
            holdingId: row.membership.holdingId.toString(),
            holdingName: row.holdingName,
            companyId: company.id.toString(),
            companyName: company.name,
            companyCode: company.code,
            roleIds: roles.map((role) => role.id.toString()),
          })),
        );
      } else if (row.membership.companyId && row.companyName) {
        result.push({
          membershipId: row.membership.id.toString(),
          holdingId: row.membership.holdingId.toString(),
          holdingName: row.holdingName,
          companyId: row.membership.companyId.toString(),
          companyName: row.companyName,
          companyCode: row.companyCode,
          roleIds: roles.map((role) => role.id.toString()),
        });
      }
    }
    return result;
  }

  async switchCompany(
    request: AuthenticatedRequest,
    response: CookieWriter,
    companyId: bigint,
  ) {
    const accessToken = request.cookies?.[SESSION_COOKIE];
    const claims =
      typeof accessToken === "string"
        ? verifySmartManagerAccessToken(accessToken)
        : null;
    if (!claims) throw new UnauthorizedException("Authentication required.");
    const session = await this.sessions.findAuthSession(claims.sessionId);
    if (
      !session ||
      session.session.revokedAt ||
      session.session.expiresAt <= new Date() ||
      session.session.userId.toString() !== claims.sub
    )
      throw new UnauthorizedException("Authentication required.");
    const target = await this.sessions.membershipForCompany(
      session.user.id,
      companyId,
    );
    if (
      !target ||
      !target.user.approvedAt ||
      target.holding.id !== target.membership.holdingId
    )
      throw new UnauthorizedException("Tenant membership required.");
    const roles = await this.sessions.rolesForMembership(target.membership.id);
    const company = await this.sessions.activeCompanyInHolding(
      target.membership.holdingId,
      companyId,
    );
    if (!company || roles.length === 0)
      throw new UnauthorizedException("Tenant membership required.");
    await this.sessions.auditCompanySwitch({
      userId: session.user.id,
      userName:
        [session.user.firstName, session.user.lastName]
          .filter(Boolean)
          .join(" ") || session.user.mobile,
      fromCompanyId: session.session.activeCompanyId,
      toCompanyId: company.id,
      holdingId: target.membership.holdingId,
      membershipId: target.membership.id,
      ipAddress: requestIp(request),
      userAgent: requestUserAgent(request),
    });
    await this.destroy(request, response);
    await this.issueSession(
      session.user.id,
      target.membership.id,
      request,
      response,
      false,
      company.id,
    );
    return { companyId: company.id.toString(), companyName: company.name };
  }

  async refresh(
    request: FastifyRequest & { cookies?: Record<string, string | undefined> },
    response: CookieWriter,
  ) {
    const token = request.cookies?.[REFRESH_COOKIE];
    const claims =
      typeof token === "string" ? verifySmartManagerRefreshToken(token) : null;
    if (!claims) throw new UnauthorizedException("Authentication required.");
    const tokenHash = hashSmartManagerRefreshToken(token as string);
    const result = await this.sessions.runAuthTransaction(async (tx) => {
      const [stored] = await tx
        .select()
        .from(this.sessions.refreshTokens)
        .where(eq(this.sessions.refreshTokens.tokenHash, tokenHash))
        .for("update")
        .limit(1);
      if (
        !stored ||
        stored.sessionId !== claims.sessionId ||
        stored.id !== claims.jti
      )
        return { invalid: true as const };
      if (stored.consumedAt || stored.revokedAt) {
        await tx
          .update(this.sessions.authSessions)
          .set({ revokedAt: new Date(), tokenVersion: claims.tokenVersion + 1 })
          .where(eq(this.sessions.authSessions.id, stored.sessionId));
        await tx
          .update(this.sessions.refreshTokens)
          .set({ revokedAt: new Date() })
          .where(eq(this.sessions.refreshTokens.sessionId, stored.sessionId));
        return { replay: true as const };
      }
      if (stored.expiresAt <= new Date()) return { invalid: true as const };
      const [session] = await tx
        .select()
        .from(this.sessions.authSessions)
        .where(eq(this.sessions.authSessions.id, stored.sessionId))
        .for("update")
        .limit(1);
      if (
        !session ||
        session.revokedAt ||
        session.expiresAt <= new Date() ||
        session.tokenVersion !== claims.tokenVersion
      )
        return { invalid: true as const };
      const [membership] = await tx
        .select()
        .from(this.sessions.memberships)
        .where(
          and(
            eq(this.sessions.memberships.id, session.membershipId),
            eq(this.sessions.memberships.status, "active"),
          ),
        )
        .limit(1);
      if (
        !membership ||
        membership.userId.toString() !== claims.sub ||
        membership.id.toString() !== claims.membershipId
      )
        return { invalid: true as const };
      const [user] = await tx
        .select()
        .from(this.sessions.users)
        .where(eq(this.sessions.users.id, session.userId))
        .limit(1);
      if (!user?.approvedAt) return { invalid: true as const };
      await tx
        .update(this.sessions.refreshTokens)
        .set({ consumedAt: new Date() })
        .where(eq(this.sessions.refreshTokens.id, stored.id));
      return { session, membership, tokenId: stored.id };
    });
    if ("invalid" in result || "replay" in result) {
      removeCookie(response, SESSION_COOKIE, cookieBase);
      removeCookie(response, REFRESH_COOKIE, {
        ...cookieBase,
        path: "/api/auth",
      });
      throw new UnauthorizedException("Authentication required.");
    }
    const context = await this.sessions.membershipForUser(
      result.session.userId,
      result.membership.id,
    );
    if (!context?.user.approvedAt)
      throw new UnauthorizedException("Authentication required.");
    const roleRows = await this.sessions.rolesForMembership(
      result.membership.id,
    );
    if (!roleRows.length)
      throw new UnauthorizedException("Authentication required.");
    const activeCompanyId = result.session.activeCompanyId;
    if (
      activeCompanyId &&
      !(await this.sessions.activeCompanyInHolding(
        result.membership.holdingId,
        activeCompanyId,
      ))
    )
      throw new UnauthorizedException("Authentication required.");
    const access = issueSmartManagerAccessToken(
      {
        sub: result.session.userId.toString(),
        sessionId: result.session.id,
        holdingId: result.membership.holdingId.toString(),
        membershipId: result.membership.id.toString(),
        activeCompanyId: activeCompanyId?.toString() ?? null,
        roleIds: roleRows.map((role) => role.id.toString()),
        scopeType: result.membership.scopeType,
        tokenVersion: result.session.tokenVersion,
      },
      accessLifetimeSeconds,
    );
    const nextRefresh = issueSmartManagerRefreshToken(
      {
        sub: result.session.userId.toString(),
        sessionId: result.session.id,
        membershipId: result.membership.id.toString(),
        tokenVersion: result.session.tokenVersion,
      },
      Math.max(
        1,
        Math.floor((result.session.expiresAt.getTime() - Date.now()) / 1000),
      ),
    );
    await this.sessions.runAuthTransaction(async (tx) => {
      await tx
        .update(this.sessions.refreshTokens)
        .set({ replacedById: nextRefresh.id })
        .where(eq(this.sessions.refreshTokens.id, result.tokenId));
      await tx.insert(this.sessions.refreshTokens).values({
        id: nextRefresh.id,
        sessionId: result.session.id,
        tokenHash: nextRefresh.tokenHash,
        expiresAt: new Date(
          nextRefresh.token
            ? Date.now() +
                Math.max(
                  1,
                  Math.floor(
                    (result.session.expiresAt.getTime() - Date.now()) / 1000,
                  ),
                ) *
                  1000
            : result.session.expiresAt,
        ),
      });
      await tx
        .update(this.sessions.authSessions)
        .set({ lastActivityAt: new Date() })
        .where(eq(this.sessions.authSessions.id, result.session.id));
    });
    writeCookie(response, SESSION_COOKIE, access, cookieBase);
    writeCookie(response, REFRESH_COOKIE, nextRefresh.token, {
      ...cookieBase,
      path: "/api/auth",
    });
  }

  async destroy(
    request: FastifyRequest & { cookies?: Record<string, string | undefined> },
    response: CookieWriter,
  ) {
    const id = request.cookies?.[SESSION_COOKIE];
    const refreshToken = request.cookies?.[REFRESH_COOKIE];
    if (typeof id === "string" || typeof refreshToken === "string") {
      const claims =
        typeof id === "string" ? verifySmartManagerAccessToken(id) : null;
      const refreshClaims =
        typeof refreshToken === "string"
          ? verifySmartManagerRefreshToken(refreshToken)
          : null;
      const refreshSessionId =
        typeof refreshToken === "string"
          ? await this.sessions.sessionIdForRefreshHash(
              hashSmartManagerRefreshToken(refreshToken),
            )
          : null;
      const sessionId =
        claims?.sessionId ?? refreshClaims?.sessionId ?? refreshSessionId;
      if (sessionId) {
        await this.sessions.runAuthTransaction(async (tx) => {
          await tx
            .update(this.sessions.authSessions)
            .set({ revokedAt: new Date() })
            .where(eq(this.sessions.authSessions.id, sessionId));
          await tx
            .update(this.sessions.refreshTokens)
            .set({ revokedAt: new Date() })
            .where(eq(this.sessions.refreshTokens.sessionId, sessionId));
        });
      }
      if (typeof id === "string" && !claims && !refreshClaims) {
        await this.sessions.deleteById(id);
      }
    }
    removeCookie(response, SESSION_COOKIE, cookieBase);
    removeCookie(response, REFRESH_COOKIE, {
      ...cookieBase,
      path: "/api/auth",
    });
  }

  async regenerate(
    request: FastifyRequest & { cookies?: Record<string, string | undefined> },
    response: CookieWriter,
    userId: bigint,
  ) {
    const previous = request.cookies?.[SESSION_COOKIE];
    if (typeof previous === "string" || request.cookies?.[REFRESH_COOKIE])
      await this.destroy(request, response);
    const membership = await this.sessions.defaultMembershipForUser(userId);
    if (!membership)
      throw new UnauthorizedException("Tenant membership required.");
    await this.issueSession(userId, membership.id, request, response, false);
  }
}

export interface AuthenticatedRequest extends AppRequest {
  currentUser: typeof users.$inferSelect;
  authContext: SmartManagerAuthContext;
}
