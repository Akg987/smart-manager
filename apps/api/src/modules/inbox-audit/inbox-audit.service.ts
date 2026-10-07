import { Inject, Injectable } from "@nestjs/common";
import { and, eq, isNotNull, isNull, lt, type SQL } from "drizzle-orm";
import { DRIZZLE_DB, type DrizzleDatabase } from "../../database/database.token.js";
import { auditLogs, inboxNotifications, users, type JsonValue, type NotificationType } from "../../../../../src/db/schema.js";

const secretKey = /(password|token|secret|api[_-]?key|apikey|credential)/i;
const redact = (input: Record<string, unknown>, depth = 0): JsonValue => Object.fromEntries(Object.entries(input).map(([key, value]) => [
	key,
	secretKey.test(key) || depth >= 4 ? "[redacted]" : value && typeof value === "object" && !Array.isArray(value)
		? redact(value as Record<string, unknown>, depth + 1)
		: Array.isArray(value) ? value.map((item) => item === null || ["string", "number", "boolean"].includes(typeof item) ? item as JsonValue : "[object]")
		: value === null || ["string", "number", "boolean"].includes(typeof value) ? value as JsonValue : "[object]",
])) as JsonValue;

@Injectable()
export class InboxAuditService {
	constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

	static safeInternalHref(href: string): string {
		const value = href.trim();
		if (!value.startsWith("/") || value.startsWith("//") || /[\\\x00-\x1f\x7f]/.test(value) || /^\/*(?:javascript|data|vbscript)\s*:/i.test(value.replace(/^\/+/, ""))) return "";
		return value.slice(0, 255);
	}

	static readRetentionPredicate(cutoff: Date): SQL {
		return and(isNotNull(inboxNotifications.readAt), lt(inboxNotifications.readAt, cutoff))!;
	}

	async notify(userId: bigint, type: NotificationType, title: string, body = "", href = "") {
		const safeTitle = title.trim().slice(0, 160);
		if (!safeTitle) return null;
		const [user] = await this.db.select({ approvedAt: users.approvedAt }).from(users).where(eq(users.id, userId)).limit(1);
		if (!user?.approvedAt) return null;
		try { return (await this.db.insert(inboxNotifications).values({ userId, type, title: safeTitle, body: body.trim().slice(0, 500), href: InboxAuditService.safeInternalHref(href) }).returning())[0]; }
		catch { return null; }
	}

	async markRead(userId: bigint, notificationId: bigint) {
		return this.db.transaction(async (tx) => {
			const [notification] = await tx.select().from(inboxNotifications).where(and(eq(inboxNotifications.id, notificationId), eq(inboxNotifications.userId, userId))).for("update").limit(1);
			if (!notification) return null;
			if (notification.readAt) return notification;
			return (await tx.update(inboxNotifications).set({ readAt: new Date(), updatedAt: new Date() }).where(eq(inboxNotifications.id, notification.id)).returning())[0] ?? null;
		});
	}

	async markAllRead(userId: bigint) {
		return this.db.update(inboxNotifications).set({ readAt: new Date(), updatedAt: new Date() }).where(and(eq(inboxNotifications.userId, userId), isNull(inboxNotifications.readAt))).returning({ id: inboxNotifications.id });
	}

	/** Match Laravel readBefore(): unread messages are never pruned. */
	async pruneRead(cutoff: Date): Promise<number> {
		const removed = await this.db.delete(inboxNotifications)
			.where(InboxAuditService.readRetentionPredicate(cutoff))
			.returning({ id: inboxNotifications.id });
		return removed.length;
	}

	async record(input: { userId?: bigint | null; actorName: string; action: string; subjectType?: string | null; subjectId?: bigint | null; description: string; context?: Record<string, unknown>; ipAddress?: string | null; userAgent?: string | null }) {
		try {
			return (await this.db.insert(auditLogs).values({
				userId: input.userId ?? null, actorName: input.actorName.slice(0, 150), action: input.action.slice(0, 64),
				subjectType: input.subjectType ?? null, subjectId: input.subjectId ?? null, description: input.description.slice(0, 500),
				context: input.context ? redact(input.context) : null, ipAddress: input.ipAddress ?? null, userAgent: input.userAgent?.slice(0, 500) ?? null,
			}).returning())[0];
		} catch { return null; }
	}
}
