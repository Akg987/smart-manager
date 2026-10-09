import { Inject, Injectable } from "@nestjs/common";
import { and, eq, isNotNull, isNull, lt, type SQL } from "drizzle-orm";
import { BaseRepository } from "../../common/repository/base.repository.js";
import {
  DRIZZLE_DB,
  type DrizzleDatabase,
} from "../../database/database.token.js";
import {
  auditLogs,
  inboxNotifications,
  users,
  type NotificationType,
} from "../../../../../src/db/schema.js";

@Injectable()
export class InboxAuditRepository extends BaseRepository {
  constructor(@Inject(DRIZZLE_DB) db: DrizzleDatabase) {
    super(db);
  }

  findUserApproval(userId: bigint) {
    return this.db
      .select({ approvedAt: users.approvedAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
  }

  createNotification(values: {
    userId: bigint;
    type: NotificationType;
    title: string;
    body: string;
    href: string;
  }) {
    return this.db.insert(inboxNotifications).values(values).returning();
  }

  static readRetentionPredicate(cutoff: Date): SQL {
    return and(
      isNotNull(inboxNotifications.readAt),
      lt(inboxNotifications.readAt, cutoff),
    )!;
  }

  markRead(userId: bigint, notificationId: bigint) {
    return this.db.transaction(async (tx) => {
      const [notification] = await tx
        .select()
        .from(inboxNotifications)
        .where(
          and(
            eq(inboxNotifications.id, notificationId),
            eq(inboxNotifications.userId, userId),
          ),
        )
        .for("update")
        .limit(1);
      if (!notification || notification.readAt) return notification ?? null;
      return (
        (
          await tx
            .update(inboxNotifications)
            .set({ readAt: new Date(), updatedAt: new Date() })
            .where(eq(inboxNotifications.id, notification.id))
            .returning()
        )[0] ?? null
      );
    });
  }

  markAllRead(userId: bigint) {
    return this.db
      .update(inboxNotifications)
      .set({ readAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(inboxNotifications.userId, userId),
          isNull(inboxNotifications.readAt),
        ),
      )
      .returning({ id: inboxNotifications.id });
  }

  deleteReadBefore(cutoff: Date) {
    return this.db
      .delete(inboxNotifications)
      .where(InboxAuditRepository.readRetentionPredicate(cutoff))
      .returning({ id: inboxNotifications.id });
  }

  createAuditLog(values: typeof auditLogs.$inferInsert) {
    return this.db.insert(auditLogs).values(values).returning();
  }
}
