import { Global, Module } from "@nestjs/common";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../../../../src/db/schema.js";
import { DRIZZLE_DB } from "./database.token.js";

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE_DB,
      useFactory: () => {
        const url = process.env.DATABASE_URL;
        if (!url)
          throw new Error(
            "DATABASE_URL is required for the API database connection.",
          );
        return drizzle(postgres(url, { max: 10 }), { schema });
      },
    },
  ],
  exports: [DRIZZLE_DB],
})
export class DatabaseModule {}
