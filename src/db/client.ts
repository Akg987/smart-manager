import "server-only";

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
	throw new Error("DATABASE_URL must be set before the PostgreSQL client is used.");
}

const client = postgres(connectionString, { max: 10 });

export const db = drizzle(client, { schema });
export { client as postgresClient };
