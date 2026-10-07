import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DRIZZLE_DB, type DrizzleDatabase } from "../../database/database.token.js";
import { auditLogs, modules } from "../../../../../src/db/schema.js";

@Injectable()
export class ModulePlatformService {
	constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

	async setActive(slug: string, active: boolean, actorId: bigint) {
		return this.db.transaction(async (tx) => {
			const [module] = await tx.update(modules).set({ isActive: active, activatedAt: active ? new Date() : null, updatedAt: new Date() }).where(eq(modules.slug, slug)).returning();
			if (!module) throw new NotFoundException("Module not found.");
			await tx.insert(auditLogs).values({ userId: actorId, actorName: "System", action: active ? "module.activated" : "module.deactivated", subjectType: "Module", subjectId: module.id, description: `${slug} ${active ? "activated" : "deactivated"}`, context: null, ipAddress: null, userAgent: null });
			return module;
		});
	}
}
