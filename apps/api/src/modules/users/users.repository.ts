import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import {
  DRIZZLE_DB,
  type DrizzleDatabase,
} from "../../database/database.token.js";
import { BaseRepository } from "../../common/repository/base.repository.js";
import { auditLogs, departments, users } from "../../../../../src/db/schema.js";

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

  runTransaction<T>(handler: (tx: DbTx) => Promise<T>) {
    return this.db.transaction(handler);
  }

  users = users;
  auditLogs = auditLogs;
  eq = eq;
}
