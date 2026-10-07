import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, between, count, desc, eq, max, ne, sql } from "drizzle-orm";
import { DRIZZLE_DB, type DrizzleDatabase } from "../../database/database.token.js";
import { AuthorizationService } from "../authorization/authorization.service.js";
import { jalaliDateToGregorian } from "../../shared/jalali.js";
import { actionPriorities, auditLogs, correctiveActions, correctiveAlerts, inboxNotifications, users, type ActionStatus } from "../../../../../src/db/schema.js";

@Injectable()
export class CorrectiveActionsService {
	constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase, private readonly authorization: AuthorizationService) {}

	async dashboardSnapshot(actorId: bigint, now = new Date()) {
		const [viewer] = await this.db.select({ departmentId: users.departmentId, approvedAt: users.approvedAt }).from(users).where(eq(users.id, actorId)).limit(1);
		if (!viewer?.approvedAt) return null;
		const globalScope = await this.authorization.hasPermission(actorId, "access-all-departments");
		const departmentScope = globalScope ? undefined : viewer.departmentId === null ? sql`false` : eq(correctiveAlerts.departmentId, viewer.departmentId);
		const alertRows = await this.db.select().from(correctiveAlerts).where(and(ne(correctiveAlerts.status, "resolved"), departmentScope)).orderBy(sql`case when ${correctiveAlerts.severity} in ('urgent', 'high') then 0 else 1 end`, desc(correctiveAlerts.id));
		const canManage = await this.authorization.hasPermission(actorId, "actions.manage");
		const canView = await this.authorization.hasPermission(actorId, "actions.view");
		const actionScope = canManage ? (globalScope ? undefined : viewer.departmentId === null ? sql`false` : eq(correctiveActions.departmentId, viewer.departmentId)) : eq(correctiveActions.ownerUserId, actorId);
		const openRows = await this.db.select({ action: correctiveActions, firstName: users.firstName, lastName: users.lastName }).from(correctiveActions).leftJoin(users, eq(correctiveActions.ownerUserId, users.id)).where(and(ne(correctiveActions.status, "done"), canView || canManage ? actionScope : eq(correctiveActions.ownerUserId, actorId))).orderBy(asc(correctiveActions.dueAt), desc(correctiveActions.id));
		const critical = alertRows.filter((alert) => alert.severity === "urgent" || alert.severity === "high").length;
		const overdue = openRows.filter(({ action }) => action.dueAt !== null && action.dueAt < now).length;
		return {
			openAlerts: alertRows.length,
			critical,
			overdue,
			priorities: alertRows.slice(0, 3).map((alert) => ({ id: alert.id, title: alert.title || alert.description || "نیازمند تصمیم مدیر", severity: alert.severity, tone: alert.severity === "urgent" || alert.severity === "high" ? "high" : "normal" })),
			teamActions: openRows.slice(0, 5).map(({ action, firstName, lastName }) => ({ id: action.id, title: action.title, owner: [firstName, lastName].filter(Boolean).join(" ") || "تعیین نشده", dueAt: action.dueAt ? new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: "Asia/Tehran", day: "2-digit", month: "long", year: "numeric" }).format(action.dueAt) : "بدون موعد", overdue: action.dueAt !== null && action.dueAt < now })),
		};
	}

	async weeklySnapshot(actorId: bigint, from: Date, to: Date) {
		const [viewer] = await this.db.select({ departmentId: users.departmentId, approvedAt: users.approvedAt }).from(users).where(eq(users.id, actorId)).limit(1);
		if (!viewer?.approvedAt) return null;
		const globalScope = await this.authorization.hasPermission(actorId, "access-all-departments");
		const canViewAlerts = await this.authorization.hasPermission(actorId, "alerts.view");
		const canViewActions = await this.authorization.hasPermission(actorId, "actions.view");
		const canManageActions = await this.authorization.hasPermission(actorId, "actions.manage");
		const alertScope = globalScope ? undefined : viewer.departmentId === null ? sql`false` : eq(correctiveAlerts.departmentId, viewer.departmentId);
		const priorities = canViewAlerts ? await this.db.select().from(correctiveAlerts).where(and(ne(correctiveAlerts.status, "resolved"), alertScope)).orderBy(sql`case when ${correctiveAlerts.severity} in ('urgent', 'high') then 0 else 1 end`, desc(correctiveAlerts.id)).limit(3) : [];
		const actionScope = canManageActions ? (globalScope ? undefined : viewer.departmentId === null ? sql`false` : eq(correctiveActions.departmentId, viewer.departmentId)) : eq(correctiveActions.ownerUserId, actorId);
		const nextActions = canViewActions || canManageActions ? await this.db.select({ action: correctiveActions, firstName: users.firstName, lastName: users.lastName }).from(correctiveActions).leftJoin(users, eq(correctiveActions.ownerUserId, users.id)).where(and(ne(correctiveActions.status, "done"), actionScope)).orderBy(asc(correctiveActions.dueAt), desc(correctiveActions.id)).limit(3) : [];
		const [resolved] = await this.db.select({ value: count() }).from(correctiveAlerts).where(and(eq(correctiveAlerts.status, "resolved"), between(correctiveAlerts.resolvedAt, from, to), alertScope));
		const [completed] = await this.db.select({ value: count() }).from(correctiveActions).where(and(eq(correctiveActions.status, "done"), between(correctiveActions.updatedAt, from, to), canManageActions ? actionScope : eq(correctiveActions.ownerUserId, actorId)));
		return {
			priorities,
			nextActions: nextActions.map(({ action, firstName, lastName }) => ({ ...action, owner: [firstName, lastName].filter(Boolean).join(" ") || "تعیین نشده" })),
			resolvedAlerts: resolved.value,
			completedActions: completed.value,
		};
	}

	async listPriorities() {
		return this.db.select().from(actionPriorities).orderBy(asc(actionPriorities.position), asc(actionPriorities.id));
	}

	async defaultPriority() {
		const [medium] = await this.db.select({ name: actionPriorities.name }).from(actionPriorities).where(eq(actionPriorities.name, "متوسط")).limit(1);
		return medium?.name ?? (await this.listPriorities())[0]?.name ?? "";
	}

	async addPriority(name: string) {
		const normalized = name.trim().slice(0, 80);
		if (!normalized) throw new BadRequestException("Priority name is required.");
		return this.db.transaction(async (tx) => {
			const [position] = await tx.select({ value: max(actionPriorities.position) }).from(actionPriorities);
			return (await tx.insert(actionPriorities).values({ name: normalized, position: (position.value ?? 0) + 1 }).returning())[0];
		});
	}

	async renamePriority(priorityId: bigint, name: string) {
		const normalized = name.trim().slice(0, 80);
		if (!normalized) throw new BadRequestException("Priority name is required.");
		return this.db.transaction(async (tx) => {
			const [current] = await tx.select().from(actionPriorities).where(eq(actionPriorities.id, priorityId)).for("update").limit(1);
			if (!current) throw new NotFoundException("Priority not found.");
			if (current.name !== normalized) await tx.update(correctiveActions).set({ priority: normalized, updatedAt: new Date() }).where(eq(correctiveActions.priority, current.name));
			return (await tx.update(actionPriorities).set({ name: normalized, updatedAt: new Date() }).where(eq(actionPriorities.id, priorityId)).returning())[0];
		});
	}

	async create(input: { departmentId: bigint; alertId?: bigint | null; title: string; description?: string; successMetric: string; ownerUserId: bigint; createdBy: bigint; priority: string; dueAt: string }) {
		if (!(await this.authorization.hasPermission(input.createdBy, "actions.manage"))) throw new ForbiddenException("You cannot create actions.");
		const globalScope = await this.authorization.hasPermission(input.createdBy, "access-all-departments");
		if (!(await this.authorization.canAccessDepartment(input.createdBy, input.departmentId, globalScope))) throw new ForbiddenException("Department access denied.");
		return this.db.transaction(async (tx) => {
			const [owner] = await tx.select({ departmentId: users.departmentId, approvedAt: users.approvedAt }).from(users).where(eq(users.id, input.ownerUserId)).limit(1);
			if (!owner?.approvedAt || (!globalScope && owner.departmentId !== input.departmentId)) throw new ForbiddenException("Action owner is outside the actor's accessible departments.");
			if (input.alertId) {
				const [alert] = await tx.select({ id: correctiveAlerts.id, departmentId: correctiveAlerts.departmentId }).from(correctiveAlerts).where(eq(correctiveAlerts.id, input.alertId)).limit(1);
				if (!alert || alert.departmentId !== input.departmentId) throw new NotFoundException("Alert not found in the selected department.");
			}
			const [priority] = await tx.select({ id: actionPriorities.id }).from(actionPriorities).where(eq(actionPriorities.name, input.priority.trim())).limit(1);
			if (!priority) throw new BadRequestException("Action priority does not exist.");
			const dueDate = jalaliDateToGregorian(input.dueAt);
			if (!dueDate) throw new BadRequestException("Invalid Jalali due date.");
			const [action] = await tx.insert(correctiveActions).values({ departmentId: input.departmentId, alertId: input.alertId ?? null, title: input.title.slice(0, 240), description: input.description?.slice(0, 2000) ?? "", successMetric: input.successMetric.slice(0, 240), ownerUserId: input.ownerUserId, createdBy: input.createdBy, priority: input.priority, dueAt: new Date(`${dueDate}T00:00:00.000Z`), status: "open" }).returning();
			await tx.insert(auditLogs).values({ userId: input.createdBy, actorName: "System", action: "corrective_action.created", subjectType: "CorrectiveAction", subjectId: action.id, description: "Corrective action created", context: null, ipAddress: null, userAgent: null });
			if (input.ownerUserId !== input.createdBy) await tx.insert(inboxNotifications).values({ userId: input.ownerUserId, type: "action", title: action.title, body: action.description.slice(0, 500), href: "/actions" });
			return action;
		});
	}

	async updateStatus(actionId: bigint, status: ActionStatus, actorId: bigint) {
		return this.db.transaction(async (tx) => {
			const [action] = await tx.select().from(correctiveActions).where(eq(correctiveActions.id, actionId)).for("update").limit(1);
			if (!action) throw new NotFoundException("Action not found.");
			const manage = await this.authorization.hasPermission(actorId, "actions.manage");
			const updateOwn = await this.authorization.hasPermission(actorId, "actions.update-own");
			const globalScope = manage && await this.authorization.hasPermission(actorId, "access-all-departments");
			const inDepartment = manage && await this.authorization.canAccessDepartment(actorId, action.departmentId, globalScope);
			if (!inDepartment && !(updateOwn && action.ownerUserId === actorId)) throw new ForbiddenException("You cannot change this action.");
			const [updated] = await tx.update(correctiveActions).set({ status, updatedAt: new Date() }).where(eq(correctiveActions.id, actionId)).returning();
			await tx.insert(auditLogs).values({ userId: actorId, actorName: "System", action: "corrective_action.status_changed", subjectType: "CorrectiveAction", subjectId: actionId, description: `Status changed to ${status}`, context: null, ipAddress: null, userAgent: null });
			return updated;
		});
	}

	async acknowledgeAlert(alertId: bigint, actorId: bigint) { return this.setAlertStatus(alertId, actorId, "acknowledged", ""); }

	async resolveAlert(alertId: bigint, actorId: bigint, note: string) { return this.setAlertStatus(alertId, actorId, "resolved", note); }

	private async setAlertStatus(alertId: bigint, actorId: bigint, next: "acknowledged" | "resolved", note: string) {
		return this.db.transaction(async (tx) => {
			const [alert] = await tx.select().from(correctiveAlerts).where(eq(correctiveAlerts.id, alertId)).for("update").limit(1);
			if (!alert) throw new NotFoundException("Alert not found.");
			const globalScope = await this.authorization.hasPermission(actorId, "access-all-departments");
			if (!(await this.authorization.canAccessDepartment(actorId, alert.departmentId, globalScope))) throw new ForbiddenException("Department access denied.");
			if (alert.status === "resolved") throw new ForbiddenException("Alert is already resolved.");
			if (next === "acknowledged" && alert.status === "acknowledged") return alert;
			const now = new Date();
			const [updated] = await tx.update(correctiveAlerts).set(next === "acknowledged"
				? { status: next, acknowledgedAt: now, acknowledgedBy: actorId, updatedAt: now }
				: { status: next, resolvedAt: now, resolvedBy: actorId, acknowledgedAt: alert.acknowledgedAt ?? now, acknowledgedBy: alert.acknowledgedBy ?? actorId, resolutionNote: note.slice(0, 1000), updatedAt: now },
			).where(eq(correctiveAlerts.id, alertId)).returning();
			await tx.insert(auditLogs).values({ userId: actorId, actorName: "System", action: `alert.${next}`, subjectType: "CorrectiveAlert", subjectId: alertId, description: next === "resolved" ? "Alert resolved" : "Alert acknowledged", context: next === "resolved" ? { note: note.slice(0, 1000) } : null, ipAddress: null, userAgent: null });
			return updated;
		});
	}
}
