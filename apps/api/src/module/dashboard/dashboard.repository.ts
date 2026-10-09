import { Inject, Injectable } from "@nestjs/common";
import { and, count, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { BaseRepository } from "../../common/repository/base.repository.js";
import {
  DRIZZLE_DB,
  type DrizzleDatabase,
} from "../../database/database.token.js";
import {
  correctiveActions,
  correctiveAlerts,
  inboxNotifications,
  kpiManagementKpis,
  kpiManagementValues,
  users,
} from "../../../../../src/db/schema.js";

@Injectable()
export class DashboardRepository extends BaseRepository {
  constructor(@Inject(DRIZZLE_DB) db: DrizzleDatabase) {
    super(db);
  }

  async findViewer(userId: bigint) {
    return (
      (
        await this.db
          .select({
            departmentId: users.departmentId,
            approvedAt: users.approvedAt,
          })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1)
      )[0] ?? null
    );
  }

  async snapshotCounts(
    userId: bigint,
    kpiDepartmentIds: bigint[],
    alertDepartmentIds: bigint[],
  ) {
    const kpiScope = kpiDepartmentIds.length
      ? inArray(kpiManagementKpis.departmentId, kpiDepartmentIds)
      : sql.raw("false");
    const alertScope = alertDepartmentIds.length
      ? inArray(correctiveAlerts.departmentId, alertDepartmentIds)
      : sql.raw("false");
    const [kpis] = await this.db
      .select({ total: count() })
      .from(kpiManagementKpis)
      .where(and(eq(kpiManagementKpis.active, true), kpiScope));
    const [red] = await this.db
      .select({ total: count() })
      .from(kpiManagementValues)
      .innerJoin(
        kpiManagementKpis,
        eq(kpiManagementValues.kpiId, kpiManagementKpis.id),
      )
      .where(and(eq(kpiManagementValues.status, "red"), kpiScope));
    const [alerts] = await this.db
      .select({ total: count() })
      .from(correctiveAlerts)
      .where(and(ne(correctiveAlerts.status, "resolved"), alertScope));
    const [actions] = await this.db
      .select({ total: count() })
      .from(correctiveActions)
      .where(eq(correctiveActions.ownerUserId, userId));
    const [unread] = await this.db
      .select({ total: count() })
      .from(inboxNotifications)
      .where(
        and(
          eq(inboxNotifications.userId, userId),
          isNull(inboxNotifications.readAt),
        ),
      );
    return {
      activeKpis: kpis.total,
      redKpis: red.total,
      openAlerts: alerts.total,
      ownedActions: actions.total,
      notifications: unread.total,
    };
  }
}
