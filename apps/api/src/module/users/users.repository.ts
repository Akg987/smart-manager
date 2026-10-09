import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import {
  DRIZZLE_DB,
  type DrizzleDatabase,
} from "../../database/database.token.js";
import { BaseRepository } from "../../common/repository/base.repository.js";
import {
  auditLogs,
  departments,
  memberships,
  users,
} from "../../../../../src/db/schema.js";

type DbTx = Parameters<Parameters<DrizzleDatabase["transaction"]>[0]>[0];

@Injectable()
export class UsersRepository extends BaseRepository {
  constructor(@Inject(DRIZZLE_DB) db: DrizzleDatabase) {
    super(db);
  }

  findById(userId: bigint) {
    return this.db.select().from(users).where(eq(users.id, userId)).limit(1);
  }

  findDepartmentName(departmentId: bigint) {
    return this.db
      .select({ name: departments.name })
      .from(departments)
      .where(eq(departments.id, departmentId))
      .limit(1);
  }

  updateById(userId: bigint, values: Partial<typeof users.$inferInsert>) {
    return this.db
      .update(users)
      .set(values)
      .where(eq(users.id, userId))
      .returning();
  }

  approveForCompany(
    userId: bigint,
    approverId: bigint,
    holdingId: bigint,
    companyId: bigint,
  ) {
    return this.db.transaction(async (tx) => {
      const membershipsForUser = await tx
        .select({
          id: memberships.id,
          holdingId: memberships.holdingId,
          companyId: memberships.companyId,
          status: memberships.status,
        })
        .from(memberships)
        .where(eq(memberships.userId, userId))
        .for("update");
      const unrelatedActive = membershipsForUser.some(
        (membership) =>
          membership.status === "active" &&
          (membership.holdingId !== holdingId ||
            membership.companyId !== companyId),
      );
      if (unrelatedActive) return { unrelatedActiveMembership: true as const };
      const [user] = await tx
        .update(users)
        .set({
          approvedAt: new Date(),
          approvedBy: approverId,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning();
      if (!user) return { missingUser: true as const };
      const pending = membershipsForUser.filter(
        (membership) =>
          membership.status === "pending" &&
          membership.holdingId === holdingId &&
          membership.companyId === companyId,
      );
      if (pending.length)
        await tx
          .update(memberships)
          .set({ status: "active", updatedAt: new Date() })
          .where(
            and(
              eq(memberships.userId, userId),
              eq(memberships.holdingId, holdingId),
              eq(memberships.companyId, companyId),
              eq(memberships.status, "pending"),
            ),
          );
      await tx.insert(auditLogs).values({
        userId: approverId,
        holdingId,
        companyId,
        actorName: "System",
        action: "user.approved",
        subjectType: "User",
        subjectId: userId,
        description: "User registration approved for company",
        context: {
          actorUserId: approverId.toString(),
          recipientUserId: userId.toString(),
          approvedAt:
            user.approvedAt?.toISOString() ?? new Date().toISOString(),
          activatedMembershipIds: pending.map((row) => row.id.toString()),
        },
        ipAddress: null,
        userAgent: null,
      });
      return { user };
    });
  }

  runTransaction<T>(handler: (tx: DbTx) => Promise<T>) {
    return this.db.transaction(handler);
  }

  users = users;
  auditLogs = auditLogs;
  eq = eq;
}
