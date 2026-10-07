import { Inject, Injectable } from "@nestjs/common";
import { and, count, eq, isNull, sql } from "drizzle-orm";
import { DRIZZLE_DB, type DrizzleDatabase } from "../../database/database.token.js";
import { AuthorizationService } from "../authorization/authorization.service.js";
import { correctiveActions, correctiveAlerts, inboxNotifications, kpiManagementKpis, kpiManagementValues, users } from "../../../../../src/db/schema.js";

@Injectable()
export class DashboardService {
	constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase, private readonly authorization: AuthorizationService) {}

	async snapshot(userId: bigint) {
		const [viewer] = await this.db.select({ departmentId: users.departmentId, approvedAt: users.approvedAt }).from(users).where(eq(users.id, userId)).limit(1);
		if (!viewer?.approvedAt) return null;
		const globalScope = await this.authorization.hasPermission(userId, "access-all-departments");
		const departmentId = globalScope ? null : viewer.departmentId;
		const deptScope = departmentId === null ? sql`false` : eq(kpiManagementKpis.departmentId, departmentId);
		const [kpis] = await this.db.select({ total: count() }).from(kpiManagementKpis).where(and(eq(kpiManagementKpis.active, true), globalScope ? undefined : deptScope));
		const [red] = await this.db.select({ total: count() }).from(kpiManagementValues).innerJoin(kpiManagementKpis, eq(kpiManagementValues.kpiId, kpiManagementKpis.id)).where(and(eq(kpiManagementValues.status, "red"), globalScope ? undefined : deptScope));
		const [alerts] = await this.db.select({ total: count() }).from(correctiveAlerts).where(and(sql`${correctiveAlerts.status} <> 'resolved'`, globalScope ? undefined : departmentId === null ? sql`false` : eq(correctiveAlerts.departmentId, departmentId)));
		const [actions] = await this.db.select({ total: count() }).from(correctiveActions).where(eq(correctiveActions.ownerUserId, userId));
		const [unread] = await this.db.select({ total: count() }).from(inboxNotifications).where(and(eq(inboxNotifications.userId, userId), isNull(inboxNotifications.readAt)));
		return { departmentId, activeKpis: kpis.total, redKpis: red.total, openAlerts: alerts.total, ownedActions: actions.total, notifications: unread.total };
	}
}
