import { Inject, Injectable } from "@nestjs/common";
import { and, asc, desc, eq, isNull, or } from "drizzle-orm";
import {
  DRIZZLE_DB,
  type DrizzleDatabase,
} from "../database/database.token.js";
import { BaseRepository } from "./repository/base.repository.js";
import {
  authSessions,
  auditLogs,
  companies,
  holdings,
  membershipRoles,
  memberships,
  refreshTokens,
  roles,
  sessions,
  users,
} from "../../../../src/db/schema.js";

type DbTx = Parameters<Parameters<DrizzleDatabase["transaction"]>[0]>[0];

@Injectable()
export class SessionRepository extends BaseRepository {
  constructor(@Inject(DRIZZLE_DB) db: DrizzleDatabase) {
    super(db);
  }

  insertSession(values: typeof sessions.$inferInsert) {
    return this.db.insert(sessions).values(values);
  }

  findById(id: string) {
    return this.db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
  }

  findUserById(userId: bigint) {
    return this.db.select().from(users).where(eq(users.id, userId)).limit(1);
  }

  findActive(id: string) {
    return this.db
      .select({ session: sessions, user: users })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(eq(sessions.id, id))
      .limit(1);
  }

  touch(id: string, lastActivity: number) {
    return this.db
      .update(sessions)
      .set({ lastActivity })
      .where(eq(sessions.id, id));
  }

  deleteById(id: string) {
    return this.db.delete(sessions).where(eq(sessions.id, id));
  }

  async defaultMembershipForUser(userId: bigint) {
    return (
      (
        await this.db
          .select({ membership: memberships })
          .from(memberships)
          .innerJoin(holdings, eq(memberships.holdingId, holdings.id))
          .where(
            and(
              eq(memberships.userId, userId),
              eq(memberships.status, "active"),
              eq(holdings.status, "active"),
            ),
          )
          .orderBy(desc(memberships.isDefault), asc(memberships.createdAt))
          .limit(1)
      )[0]?.membership ?? null
    );
  }

  async membershipForUser(userId: bigint, membershipId: bigint) {
    return (
      (
        await this.db
          .select({
            membership: memberships,
            holding: holdings,
            company: companies,
            user: users,
          })
          .from(memberships)
          .innerJoin(holdings, eq(memberships.holdingId, holdings.id))
          .leftJoin(companies, eq(memberships.companyId, companies.id))
          .innerJoin(users, eq(memberships.userId, users.id))
          .where(
            and(
              eq(memberships.id, membershipId),
              eq(memberships.userId, userId),
              eq(memberships.status, "active"),
              eq(holdings.status, "active"),
            ),
          )
          .limit(1)
      )[0] ?? null
    );
  }

  async membershipForCompany(userId: bigint, companyId: bigint) {
    return (
      (
        await this.db
          .select({
            membership: memberships,
            holding: holdings,
            company: companies,
            user: users,
          })
          .from(memberships)
          .innerJoin(holdings, eq(memberships.holdingId, holdings.id))
          .leftJoin(companies, eq(memberships.companyId, companies.id))
          .innerJoin(users, eq(memberships.userId, users.id))
          .where(
            and(
              eq(memberships.userId, userId),
              eq(memberships.status, "active"),
              eq(holdings.status, "active"),
              or(
                eq(memberships.companyId, companyId),
                and(
                  eq(memberships.scopeType, "holding"),
                  isNull(memberships.companyId),
                ),
              ),
            ),
          )
          .orderBy(desc(memberships.isDefault))
          .limit(5)
      ).find(
        (row) =>
          row.membership.companyId === companyId ||
          row.membership.scopeType === "holding",
      ) ?? null
    );
  }

  async activeCompanyInHolding(holdingId: bigint, companyId: bigint) {
    return (
      (
        await this.db
          .select()
          .from(companies)
          .where(
            and(
              eq(companies.id, companyId),
              eq(companies.holdingId, holdingId),
              eq(companies.status, "active"),
              isNull(companies.archivedAt),
            ),
          )
          .limit(1)
      )[0] ?? null
    );
  }

  async rolesForMembership(membershipId: bigint) {
    return this.db
      .select({ id: roles.id, key: roles.key })
      .from(membershipRoles)
      .innerJoin(roles, eq(membershipRoles.roleId, roles.id))
      .where(eq(membershipRoles.membershipId, membershipId))
      .orderBy(asc(roles.key));
  }

  async listMembershipsForUser(userId: bigint) {
    return this.db
      .select({
        membership: memberships,
        holdingName: holdings.name,
        companyName: companies.name,
        companyCode: companies.code,
      })
      .from(memberships)
      .innerJoin(holdings, eq(memberships.holdingId, holdings.id))
      .leftJoin(companies, eq(memberships.companyId, companies.id))
      .where(
        and(
          eq(memberships.userId, userId),
          eq(memberships.status, "active"),
          eq(holdings.status, "active"),
        ),
      )
      .orderBy(desc(memberships.isDefault), asc(companies.name));
  }

  async listCompaniesInHolding(holdingId: bigint) {
    return this.db
      .select({ id: companies.id, name: companies.name, code: companies.code })
      .from(companies)
      .where(
        and(
          eq(companies.holdingId, holdingId),
          eq(companies.status, "active"),
          isNull(companies.archivedAt),
        ),
      )
      .orderBy(asc(companies.name));
  }

  auditCompanySwitch(input: {
    userId: bigint;
    userName: string;
    fromCompanyId: bigint | null;
    toCompanyId: bigint;
    holdingId: bigint;
    membershipId: bigint;
    ipAddress: string | null;
    userAgent: string | null;
  }) {
    return this.db.insert(auditLogs).values({
      userId: input.userId,
      holdingId: input.holdingId,
      companyId: input.toCompanyId,
      membershipId: input.membershipId,
      actorName: input.userName,
      action: "auth.company-switched",
      subjectType: "Company",
      subjectId: input.toCompanyId,
      description: "Active company switched",
      context: {
        fromCompanyId: input.fromCompanyId?.toString() ?? null,
        toCompanyId: input.toCompanyId.toString(),
        membershipId: input.membershipId.toString(),
      },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
  }

  insertAuthSession(values: typeof authSessions.$inferInsert) {
    return this.db.insert(authSessions).values(values);
  }

  async findAuthSession(id: string) {
    return (
      (
        await this.db
          .select({
            session: authSessions,
            membership: memberships,
            holding: holdings,
            user: users,
          })
          .from(authSessions)
          .innerJoin(memberships, eq(authSessions.membershipId, memberships.id))
          .innerJoin(holdings, eq(memberships.holdingId, holdings.id))
          .innerJoin(users, eq(authSessions.userId, users.id))
          .where(
            and(
              eq(authSessions.id, id),
              eq(memberships.status, "active"),
              eq(holdings.status, "active"),
            ),
          )
          .limit(1)
      )[0] ?? null
    );
  }

  insertRefreshToken(values: typeof refreshTokens.$inferInsert) {
    return this.db.insert(refreshTokens).values(values);
  }

  findRefreshToken(tokenHash: string) {
    return this.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1);
  }

  async sessionIdForRefreshHash(tokenHash: string) {
    return (
      (
        await this.db
          .select({ sessionId: refreshTokens.sessionId })
          .from(refreshTokens)
          .where(eq(refreshTokens.tokenHash, tokenHash))
          .limit(1)
      )[0]?.sessionId ?? null
    );
  }

  runAuthTransaction<T>(handler: (tx: DbTx) => Promise<T>) {
    return this.db.transaction(handler);
  }

  runTransaction<T>(handler: (tx: DbTx) => Promise<T>) {
    return this.db.transaction(handler);
  }

  sessions = sessions;
  users = users;
  authSessions = authSessions;
  refreshTokens = refreshTokens;
  memberships = memberships;
  companies = companies;
  roles = roles;
  membershipRoles = membershipRoles;
  holdings = holdings;
  auditLogs = auditLogs;
  eq = eq;
}
