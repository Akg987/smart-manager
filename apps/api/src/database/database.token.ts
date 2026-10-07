import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "../../../../src/db/schema.js";

export const DRIZZLE_DB = Symbol("DRIZZLE_DB");
export type DrizzleDatabase = PostgresJsDatabase<typeof schema>;
