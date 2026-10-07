import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { DRIZZLE_DB, type DrizzleDatabase } from "../../database/database.token.js";
import { auditLogs, users } from "../../../../../src/db/schema.js";

@Injectable()
export class UsersService {
	constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

	async approve(userId: bigint, approverId: bigint) {
		const [user] = await this.db.update(users).set({ approvedAt: new Date(), approvedBy: approverId, updatedAt: new Date() }).where(eq(users.id, userId)).returning();
		if (!user) throw new NotFoundException("User not found.");
		return user;
	}

	async updateProfile(userId: bigint, input: { firstName?: string; lastName?: string; birthDate?: string | null; nationalCode?: string | null; address?: string | null; jobTitle?: string | null }, actorId = userId) {
		return this.db.transaction(async (tx) => {
			const [user] = await tx.update(users).set({ ...input, updatedAt: new Date() }).where(eq(users.id, userId)).returning();
			if (!user) throw new NotFoundException("User not found.");
			await tx.insert(auditLogs).values({ userId: actorId, actorName: "System", action: "user.profile.updated", subjectType: "User", subjectId: userId, description: "Profile updated", context: null, ipAddress: null, userAgent: null });
			return user;
		});
	}

	async assignOrganization(userId: bigint, departmentId: bigint | null, accessLevelId: bigint | null, jobTitle: string | null, actorId: bigint) {
		return this.db.transaction(async (tx) => {
			const [user] = await tx.update(users).set({ departmentId, accessLevelId, jobTitle, updatedAt: new Date() }).where(eq(users.id, userId)).returning();
			if (!user) throw new NotFoundException("User not found.");
			await tx.insert(auditLogs).values({ userId: actorId, actorName: "System", action: "user.organization.updated", subjectType: "User", subjectId: userId, description: "Organization assignment updated", context: null, ipAddress: null, userAgent: null });
			return user;
		});
	}

	async setPassword(userId: bigint, passwordHash: string, actorId = userId) {
		return this.db.transaction(async (tx) => {
			const [user] = await tx.update(users).set({ password: passwordHash, updatedAt: new Date() }).where(eq(users.id, userId)).returning();
			if (!user) throw new NotFoundException("User not found.");
			await tx.insert(auditLogs).values({ userId: actorId, actorName: "System", action: "user.password.changed", subjectType: "User", subjectId: userId, description: "Password changed", context: null, ipAddress: null, userAgent: null });
			return user;
		});
	}

	async setAvatar(userId: bigint, avatarPath: string | null, actorId = userId) {
		return this.db.transaction(async (tx) => {
			const [user] = await tx.update(users).set({ avatarPath, updatedAt: new Date() }).where(eq(users.id, userId)).returning();
			if (!user) throw new NotFoundException("User not found.");
			await tx.insert(auditLogs).values({ userId: actorId, actorName: "System", action: "user.avatar.updated", subjectType: "User", subjectId: userId, description: "Profile avatar updated", context: null, ipAddress: null, userAgent: null });
			return user;
		});
	}

	async findById(userId: bigint) {
		return this.db.select().from(users).where(eq(users.id, userId)).limit(1);
	}
}
