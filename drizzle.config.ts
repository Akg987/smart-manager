import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

loadEnvConfig(process.cwd());

if (!process.env.DATABASE_URL) {
	throw new Error("DATABASE_URL is required to configure Drizzle.");
}

export default defineConfig({
	dialect: "postgresql",
	schema: "./src/db/schema.ts",
	out: "./drizzle",
	strict: true,
	verbose: true,
	dbCredentials: {
		url: process.env.DATABASE_URL,
	},
});
