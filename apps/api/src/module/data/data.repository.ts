import { Inject, Injectable } from "@nestjs/common";
import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { BaseRepository } from "../../common/repository/base.repository.js";
import {
  DRIZZLE_DB,
  type DrizzleDatabase,
} from "../../database/database.token.js";
import {
  accessLevelPermissions,
  accessLevels,
  actionPriorities,
  auditLogs,
  correctiveActions,
  correctiveAlerts,
  departments,
  inboxNotifications,
  kpiManagementCheckins,
  kpiManagementKpis,
  modules,
  users,
} from "../../../../../src/db/schema.js";
import type { SmartManagerAuthContext } from "../permissions/smart-manager-authorization.js";

export type DataCollection =
  | "users"
  | "departments"
  | "access-levels"
  | "audit"
  | "modules"
  | "kpis"
  | "checkins"
  | "actions"
  | "alerts"
  | "inbox"
  | "priorities";

@Injectable()
export class DataRepository extends BaseRepository {
  constructor(@Inject(DRIZZLE_DB) db: DrizzleDatabase) {
    super(db);
  }

  async findViewer(userId: bigint) {
    return (
      (
        await this.db
          .select({ departmentId: users.departmentId, role: users.role })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1)
      )[0] ?? null
    );
  }

  async list(
    collection: DataCollection,
    userId: bigint,
    context: SmartManagerAuthContext,
    departmentIds: bigint[],
    canManageActions: boolean,
  ) {
    switch (collection) {
      case "users": {
        const query = this.db
          .select({
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            mobile: users.mobile,
            role: users.role,
            departmentId: users.departmentId,
            accessLevelId: users.accessLevelId,
            jobTitle: users.jobTitle,
            approvedAt: users.approvedAt,
            createdAt: users.createdAt,
          })
          .from(users);
        const scope = departmentIds.length
          ? inArray(users.departmentId, departmentIds)
          : sql.raw("false");
        return await query
          .where(or(eq(users.id, userId), scope))
          .orderBy(asc(users.id))
          .limit(500);
      }
      case "departments": {
        const query = this.db.select().from(departments);
        const scope = departmentIds.length
          ? inArray(departments.id, departmentIds)
          : sql.raw("false");
        return await query
          .where(scope)
          .orderBy(asc(departments.name))
          .limit(500);
      }
      case "access-levels": {
        const query = this.db.select().from(accessLevels);
        const scope = departmentIds.length
          ? inArray(accessLevels.departmentId, departmentIds)
          : sql.raw("false");
        const rows = await query
          .where(scope)
          .orderBy(asc(accessLevels.name))
          .limit(500);
        const permissionCounts = await this.db
          .select({ id: accessLevelPermissions.accessLevelId, total: count() })
          .from(accessLevelPermissions)
          .groupBy(accessLevelPermissions.accessLevelId);
        const userCounts = await this.db
          .select({ id: users.accessLevelId, total: count() })
          .from(users)
          .where(isNotNull(users.accessLevelId))
          .groupBy(users.accessLevelId);
        const permissions = new Map(
          permissionCounts.map((row) => [row.id, row.total]),
        );
        const assigned = new Map(
          userCounts
            .filter((row) => row.id !== null)
            .map((row) => [row.id as bigint, row.total]),
        );
        return rows.map((row) => ({
          ...row,
          permissionsCount: permissions.get(row.id) ?? 0,
          usersCount: assigned.get(row.id) ?? 0,
        }));
      }
      case "audit":
        return this.db
          .select()
          .from(auditLogs)
          .where(eq(auditLogs.userId, userId))
          .orderBy(desc(auditLogs.id))
          .limit(500);
      case "modules":
        return this.db
          .select({
            id: modules.id,
            slug: modules.slug,
            name: modules.name,
            version: modules.version,
            isActive: modules.isActive,
            activatedAt: modules.activatedAt,
          })
          .from(modules)
          .orderBy(asc(modules.name))
          .limit(500);
      case "kpis": {
        const query = this.db.select().from(kpiManagementKpis);
        const scope = departmentIds.length
          ? inArray(kpiManagementKpis.departmentId, departmentIds)
          : sql.raw("false");
        return await query
          .where(scope)
          .orderBy(asc(kpiManagementKpis.name))
          .limit(500);
      }
      case "checkins": {
        const scope = departmentIds.length
          ? inArray(kpiManagementKpis.departmentId, departmentIds)
          : sql.raw("false");
        const visible = await this.db
          .select({ id: kpiManagementKpis.id })
          .from(kpiManagementKpis)
          .where(scope);
        const ids = visible.map(({ id }) => id);
        return ids.length
          ? this.db
              .select()
              .from(kpiManagementCheckins)
              .where(inArray(kpiManagementCheckins.kpiId, ids))
              .orderBy(desc(kpiManagementCheckins.id))
              .limit(500)
          : [];
      }
      case "actions": {
        const predicate = canManageActions
          ? departmentIds.length
            ? inArray(correctiveActions.departmentId, departmentIds)
            : sql.raw("false")
          : eq(correctiveActions.ownerUserId, userId);
        return this.db
          .select()
          .from(correctiveActions)
          .where(predicate)
          .orderBy(desc(correctiveActions.id))
          .limit(500);
      }
      case "alerts": {
        const scope = departmentIds.length
          ? inArray(correctiveAlerts.departmentId, departmentIds)
          : sql.raw("false");
        const predicate = and(ne(correctiveAlerts.status, "resolved"), scope);
        return this.db
          .select()
          .from(correctiveAlerts)
          .where(predicate)
          .orderBy(desc(correctiveAlerts.id))
          .limit(500);
      }
      case "inbox":
        return this.db
          .select()
          .from(inboxNotifications)
          .where(eq(inboxNotifications.userId, userId))
          .orderBy(desc(inboxNotifications.id))
          .limit(500);
      case "priorities":
        return this.db
          .select()
          .from(actionPriorities)
          .orderBy(asc(actionPriorities.position), asc(actionPriorities.id))
          .limit(200);
    }
  }
}
