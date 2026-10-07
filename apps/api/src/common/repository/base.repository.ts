import { Inject } from "@nestjs/common";
import {
  DRIZZLE_DB,
  type DrizzleDatabase,
} from "../../database/database.token.js";

export abstract class BaseRepository {
  constructor(@Inject(DRIZZLE_DB) protected readonly db: DrizzleDatabase) {}
}
