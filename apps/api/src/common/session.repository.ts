import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import {
  DRIZZLE_DB,
  type DrizzleDatabase,
} from "../database/database.token.js";
import { BaseRepository } from "./repository/base.repository.js";
import { sessions, users } from "../../../../src/db/schema.js";

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

  runTransaction<T>(handler: (tx: DbTx) => Promise<T>) {
    return this.db.transaction(handler);
  }

  sessions = sessions;
  users = users;
  eq = eq;
}
