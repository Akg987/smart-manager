import { Inject, Injectable } from "@nestjs/common";
import { asc, eq } from "drizzle-orm";
import { DRIZZLE_DB, type DrizzleDatabase } from "../../database/database.token.js";
import { siteSettings } from "../../../../../src/db/schema.js";

@Injectable()
export class SettingsService {
	constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

	async getBranding() { return (await this.db.select().from(siteSettings).orderBy(asc(siteSettings.id)).limit(1))[0] ?? null; }

	async updateBranding(companyName: string, logoPath: string | null) {
		return this.db.transaction(async (tx) => {
			const current = (await tx.select({ id: siteSettings.id }).from(siteSettings).orderBy(asc(siteSettings.id)).limit(1))[0];
			if (current) return (await tx.update(siteSettings).set({ companyName, logoPath, updatedAt: new Date() }).where(eq(siteSettings.id, current.id)).returning())[0];
			return (await tx.insert(siteSettings).values({ companyName, logoPath }).returning())[0];
		});
	}
}
