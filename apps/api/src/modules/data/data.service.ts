import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { and, asc, count, eq, inArray, ne, sql } from "drizzle-orm";
import { DRIZZLE_DB, type DrizzleDatabase } from "../../database/database.token.js";
import { accessLevelPermissions, accessLevels, actionPriorities, auditLogs, correctiveActions, correctiveAlerts, departments, inboxNotifications, kpiManagementCheckins, kpiManagementKpis, modules, users } from "../../../../../src/db/schema.js";
import { AuthorizationService } from "../authorization/authorization.service.js";

type Collection = "users" | "departments" | "access-levels" | "audit" | "modules" | "kpis" | "checkins" | "actions" | "alerts" | "inbox" | "priorities";
const jsonSafe = <T>(value: T): T => JSON.parse(JSON.stringify(value, (_key, item) => typeof item === "bigint" ? item.toString() : item)) as T;

@Injectable()
export class DataService {
	constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase, private readonly authorization: AuthorizationService) {}

	async list(collection: Collection, userId: bigint) {
		const [viewer] = await this.db.select({ departmentId: users.departmentId, role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
		if (!viewer) throw new ForbiddenException();
		const global = viewer.role === "admin" || await this.authorization.hasPermission(userId, "access-all-departments");
		const requirePermission = async (permission: string) => { if (!(await this.authorization.hasPermission(userId, permission))) throw new ForbiddenException("Permission denied."); };
		switch (collection) {
			case "users": {
				await requirePermission("users.view");
				const query = this.db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName, mobile: users.mobile, role: users.role, departmentId: users.departmentId, accessLevelId: users.accessLevelId, jobTitle: users.jobTitle, approvedAt: users.approvedAt, createdAt: users.createdAt }).from(users);
				const rows = await (global ? query : query.where(eq(users.departmentId, viewer.departmentId ?? -1n))).orderBy(asc(users.id)).limit(500);
				return jsonSafe(rows);
			}
			case "departments": {
				await requirePermission("organization.view");
				const query = this.db.select().from(departments);
				return jsonSafe(await (global ? query : query.where(eq(departments.id, viewer.departmentId ?? -1n))).orderBy(asc(departments.name)).limit(500));
			}
			case "access-levels": {
				await requirePermission("manage-roles");
				const query = this.db.select().from(accessLevels);
				const rows = await (global ? query : query.where(eq(accessLevels.departmentId, viewer.departmentId ?? -1n))).orderBy(asc(accessLevels.name)).limit(500);
				const permissionCounts = await this.db.select({ id: accessLevelPermissions.accessLevelId, total: count() }).from(accessLevelPermissions).groupBy(accessLevelPermissions.accessLevelId);
				const userCounts = await this.db.select({ id: users.accessLevelId, total: count() }).from(users).where(sql`${users.accessLevelId} is not null`).groupBy(users.accessLevelId);
				const permissions = new Map(permissionCounts.map((row) => [row.id, row.total]));
				const assigned = new Map(userCounts.filter((row) => row.id !== null).map((row) => [row.id as bigint, row.total]));
				return jsonSafe(rows.map((row) => ({ ...row, permissionsCount: permissions.get(row.id) ?? 0, usersCount: assigned.get(row.id) ?? 0 })));
			}
			case "audit":
				await requirePermission("audit.view");
				return jsonSafe(await this.db.select().from(auditLogs).where(global ? undefined : eq(auditLogs.userId, userId)).orderBy(sql`${auditLogs.id} desc`).limit(500));
			case "modules":
				await requirePermission("modules.view");
				return jsonSafe(await this.db.select({ id: modules.id, slug: modules.slug, name: modules.name, version: modules.version, isActive: modules.isActive, activatedAt: modules.activatedAt }).from(modules).orderBy(asc(modules.name)).limit(500));
			case "kpis": {
				await requirePermission("kpis.view");
				const query = this.db.select().from(kpiManagementKpis);
				return jsonSafe(await (global ? query : query.where(eq(kpiManagementKpis.departmentId, viewer.departmentId ?? -1n))).orderBy(asc(kpiManagementKpis.name)).limit(500));
			}
			case "checkins": {
				await requirePermission("kpis.view");
				const visible = await this.db.select({ id: kpiManagementKpis.id }).from(kpiManagementKpis).where(global ? undefined : eq(kpiManagementKpis.departmentId, viewer.departmentId ?? -1n));
				const ids = visible.map(({ id }) => id);
				return jsonSafe(ids.length ? await this.db.select().from(kpiManagementCheckins).where(inArray(kpiManagementCheckins.kpiId, ids)).orderBy(sql`${kpiManagementCheckins.id} desc`).limit(500) : []);
			}
			case "actions": {
				const canManage = await this.authorization.hasPermission(userId, "actions.manage");
				const predicate = canManage ? global ? undefined : eq(correctiveActions.departmentId, viewer.departmentId ?? -1n) : eq(correctiveActions.ownerUserId, userId);
				return jsonSafe(await this.db.select().from(correctiveActions).where(predicate).orderBy(sql`${correctiveActions.id} desc`).limit(500));
			}
			case "alerts": {
				await requirePermission("alerts.view");
				const predicate = global ? ne(correctiveAlerts.status, "resolved") : and(ne(correctiveAlerts.status, "resolved"), eq(correctiveAlerts.departmentId, viewer.departmentId ?? -1n));
				return jsonSafe(await this.db.select().from(correctiveAlerts).where(predicate).orderBy(sql`${correctiveAlerts.id} desc`).limit(500));
			}
			case "inbox":
				return jsonSafe(await this.db.select().from(inboxNotifications).where(eq(inboxNotifications.userId, userId)).orderBy(sql`${inboxNotifications.id} desc`).limit(500));
			case "priorities":
				await requirePermission("actions.view");
				return jsonSafe(await this.db.select().from(actionPriorities).orderBy(asc(actionPriorities.position), asc(actionPriorities.id)).limit(200));
		}
	}
}
