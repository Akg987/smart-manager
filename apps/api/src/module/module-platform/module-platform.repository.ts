import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { BaseRepository } from "../../common/repository/base.repository.js";
import {
  DRIZZLE_DB,
  type DrizzleDatabase,
} from "../../database/database.token.js";
import { auditLogs, modules } from "../../../../../src/db/schema.js";

@Injectable()
export class ModulePlatformRepository extends BaseRepository {
  constructor(@Inject(DRIZZLE_DB) db: DrizzleDatabase) {
    super(db);
  }

  remove(slug: string, actorId: bigint) {
    return this.db.transaction(async (tx) => {
      const [module] = await tx
        .delete(modules)
        .where(eq(modules.slug, slug))
        .returning();
      if (!module) return undefined;
      await tx
        .insert(auditLogs)
        .values({
          userId: actorId,
          actorName: "System",
          action: "module.removed",
          subjectType: "Module",
          subjectId: module.id,
          description: slug + " removed",
          context: null,
          ipAddress: null,
          userAgent: null,
        });
      return module;
    });
  }

  setActive(slug: string, active: boolean, actorId: bigint) {
    return this.db.transaction(async (tx) => {
      const [module] = await tx
        .update(modules)
        .set({
          isActive: active,
          activatedAt: active ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(modules.slug, slug))
        .returning();
      if (!module) return undefined;
      await tx
        .insert(auditLogs)
        .values({
          userId: actorId,
          actorName: "System",
          action: active ? "module.activated" : "module.deactivated",
          subjectType: "Module",
          subjectId: module.id,
          description: slug + (active ? " activated" : " deactivated"),
          context: null,
          ipAddress: null,
          userAgent: null,
        });
      return module;
    });
  }
}
