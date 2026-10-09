import { Inject, Injectable } from "@nestjs/common";
import { asc, eq, sql } from "drizzle-orm";
import { BaseRepository } from "../../common/repository/base.repository.js";
import {
  DRIZZLE_DB,
  type DrizzleDatabase,
} from "../../database/database.token.js";
import {
  smsIppanelCreditAlerts,
  smsIppanelSendCounters,
  smsIppanelSettings,
} from "../../../../../src/db/schema.js";

export class SmsTestDailyLimitExceeded extends Error {}

@Injectable()
export class SmsIppanelHubRepository extends BaseRepository {
  constructor(@Inject(DRIZZLE_DB) db: DrizzleDatabase) {
    super(db);
  }

  async findSettings() {
    return (
      (
        await this.db
          .select()
          .from(smsIppanelSettings)
          .orderBy(asc(smsIppanelSettings.id))
          .limit(1)
      )[0] ?? null
    );
  }

  saveSettings(sender: string, encryptedKey?: string) {
    return this.db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(smsIppanelSettings)
        .orderBy(asc(smsIppanelSettings.id))
        .limit(1)
        .for("update");
      if (current) {
        const [updated] = await tx
          .update(smsIppanelSettings)
          .set({
            sender,
            updatedAt: new Date(),
            ...(encryptedKey ? { apiKey: encryptedKey } : {}),
          })
          .where(eq(smsIppanelSettings.id, current.id))
          .returning({
            id: smsIppanelSettings.id,
            sender: smsIppanelSettings.sender,
            apiKey: smsIppanelSettings.apiKey,
          });
        return updated;
      }
      const [created] = await tx
        .insert(smsIppanelSettings)
        .values({ sender, apiKey: encryptedKey ?? null })
        .returning({
          id: smsIppanelSettings.id,
          sender: smsIppanelSettings.sender,
          apiKey: smsIppanelSettings.apiKey,
        });
      return created;
    });
  }

  deleteCreditAlert(userId: bigint) {
    return this.db
      .delete(smsIppanelCreditAlerts)
      .where(eq(smsIppanelCreditAlerts.userId, userId));
  }

  async findCreditAlert(userId: bigint) {
    return (
      (
        await this.db
          .select()
          .from(smsIppanelCreditAlerts)
          .where(eq(smsIppanelCreditAlerts.userId, userId))
          .limit(1)
      )[0] ?? null
    );
  }

  upsertCreditAlert(userId: bigint, threshold: string) {
    return this.db
      .insert(smsIppanelCreditAlerts)
      .values({ userId, threshold })
      .onConflictDoUpdate({
        target: smsIppanelCreditAlerts.userId,
        set: { threshold, updatedAt: new Date() },
      });
  }

  recordAcceptedTestSend(day: string, dailyLimit: number) {
    return this.db.transaction(async (tx) => {
      await tx
        .insert(smsIppanelSendCounters)
        .values({ sentOn: day, sentCount: 0 })
        .onConflictDoNothing();
      const [updated] = await tx
        .update(smsIppanelSendCounters)
        .set({ sentCount: sql.raw('"sent_count" + 1'), updatedAt: new Date() })
        .where(eq(smsIppanelSendCounters.sentOn, day))
        .returning();
      if (updated.sentCount > dailyLimit) {
        await tx
          .update(smsIppanelSendCounters)
          .set({ sentCount: sql.raw('"sent_count" - 1') })
          .where(eq(smsIppanelSendCounters.id, updated.id));
        throw new SmsTestDailyLimitExceeded();
      }
      return updated.sentCount;
    });
  }
}
