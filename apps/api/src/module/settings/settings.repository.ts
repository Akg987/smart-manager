import { Inject, Injectable } from "@nestjs/common";
import { asc, eq } from "drizzle-orm";
import { BaseRepository } from "../../common/repository/base.repository.js";
import {
  DRIZZLE_DB,
  type DrizzleDatabase,
} from "../../database/database.token.js";
import { siteSettings } from "../../../../../src/db/schema.js";

@Injectable()
export class SettingsRepository extends BaseRepository {
  constructor(@Inject(DRIZZLE_DB) db: DrizzleDatabase) {
    super(db);
  }

  async getBranding() {
    return (
      (
        await this.db
          .select()
          .from(siteSettings)
          .orderBy(asc(siteSettings.id))
          .limit(1)
      )[0] ?? null
    );
  }

  updateBranding(companyName: string, logoPath: string | null) {
    return this.db.transaction(async (tx) => {
      const [current] = await tx
        .select({ id: siteSettings.id })
        .from(siteSettings)
        .orderBy(asc(siteSettings.id))
        .limit(1);
      if (current) {
        const [updated] = await tx
          .update(siteSettings)
          .set({ companyName, logoPath, updatedAt: new Date() })
          .where(eq(siteSettings.id, current.id))
          .returning();
        return updated;
      }
      const [created] = await tx
        .insert(siteSettings)
        .values({ companyName, logoPath })
        .returning();
      return created;
    });
  }
}
