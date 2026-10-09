const { config: loadDotenv } = require("dotenv");
const { defineConfig } = require("drizzle-kit");

loadDotenv({ path: [".env.local", ".env"] });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to configure Drizzle.");
}

module.exports = defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  strict: true,
  verbose: true,
  dbCredentials: { url: process.env.DATABASE_URL },
});
