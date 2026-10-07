import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, eq, sql } from "drizzle-orm";
import { DRIZZLE_DB, type DrizzleDatabase } from "../../database/database.token.js";
import { accessLevelPermissions, accessLevels, auditLogs, departments, rolePermissions, users } from "../../../../../src/db/schema.js";

export const knownPermissions = [
	"manage-modules", "manage-settings", "manage-users", "manage-roles", "view-audit-log", "manage-departments", "access-all-departments",
	"alerts.view", "alerts.acknowledge", "alerts.resolve", "actions.view", "actions.manage", "actions.update-own", "kpi.view", "kpi.manage", "kpi.submit",
] as const;

export const permissionGroups = [
	{ group: "سیستم", permissions: ["manage-modules", "manage-settings", "manage-users", "manage-roles", "view-audit-log"] },
	{ group: "سازمان", permissions: ["manage-departments", "access-all-departments"] },
	{ group: "شاخص‌ها", permissions: ["kpi.view", "kpi.manage", "kpi.submit"] },
	{ group: "اقدام اصلاحی", permissions: ["alerts.view", "alerts.acknowledge", "alerts.resolve", "actions.view", "actions.manage", "actions.update-own"] },
] as const;

const permissionAliases: Record<string, string> = {
	"settings.manage": "manage-settings", "organization.manage": "manage-departments", "organization.view": "manage-departments",
	"users.view": "manage-users", "users.approve": "manage-users", "users.assign-organization": "manage-users", "access-levels.view": "manage-roles",
	"audit.view": "view-audit-log", "modules.view": "manage-modules", "modules.manage": "manage-modules", "kpis.view": "kpi.view",
	"sms.view-settings": "manage-settings", "sms.manage-settings": "manage-settings",
};

export function canonicalPermission(permission: string): string {
	const normalized = permission.trim().toLowerCase();
	return permissionAliases[normalized] ?? normalized;
}

const jsonSafe = <T>(value: T): T => JSON.parse(JSON.stringify(value, (_key, item) => typeof item === "bigint" ? item.toString() : item)) as T;

@Injectable()
export class AuthorizationService {
	constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

	async listAccessLevels() {
		const rows = await this.db.select({ level: accessLevels, departmentName: departments.name }).from(accessLevels).leftJoin(departments, eq(accessLevels.departmentId, departments.id)).orderBy(asc(accessLevels.name));
		const grants = await this.db.select().from(accessLevelPermissions).orderBy(asc(accessLevelPermissions.permission));
		return jsonSafe(rows.map(({ level, departmentName }) => ({ ...level, departmentName, permissions: grants.filter((grant) => grant.accessLevelId === level.id).map((grant) => grant.permission) })));
	}

	async createAccessLevel(input: { name: string; departmentId: bigint | null; permissions?: string[] }, actorId: bigint) {
		return this.saveAccessLevel(input, actorId);
	}

	async updateAccessLevel(id: bigint, input: { name: string; departmentId: bigint | null; permissions?: string[] }, actorId: bigint) {
		return this.saveAccessLevel(input, actorId, id);
	}

	private async saveAccessLevel(input: { name: string; departmentId: bigint | null; permissions?: string[] }, actorId: bigint, id?: bigint) {
		const permissions = [...new Set((input.permissions ?? []).map((permission) => permission.trim().toLowerCase()).filter((permission) => (knownPermissions as readonly string[]).includes(permission)))];
		return this.db.transaction(async (tx) => {
			const name = input.name.trim();
			const [sameName] = await tx.select({ id: accessLevels.id }).from(accessLevels).where(sql`lower(${accessLevels.name}) = lower(${name})`).limit(1);
			if (sameName && sameName.id !== id) throw new ConflictException("An access level with this name already exists.");
			if (input.departmentId !== null) {
				const [department] = await tx.select({ id: departments.id }).from(departments).where(eq(departments.id, input.departmentId)).limit(1);
				if (!department) throw new BadRequestException({ message: "Validation failed.", errors: { departmentId: ["The selected department does not exist."] } });
			}
			const [level] = id
				? await tx.update(accessLevels).set({ name, departmentId: input.departmentId, updatedAt: new Date() }).where(eq(accessLevels.id, id)).returning()
				: await tx.insert(accessLevels).values({ name, departmentId: input.departmentId }).returning();
			if (!level) throw new NotFoundException("Access level not found.");
			await tx.delete(accessLevelPermissions).where(eq(accessLevelPermissions.accessLevelId, level.id));
			if (permissions.length) await tx.insert(accessLevelPermissions).values(permissions.map((permission) => ({ accessLevelId: level.id, permission })));
			await tx.insert(auditLogs).values({ userId: actorId, actorName: "System", action: id ? "authorization.access-level.updated" : "authorization.access-level.created", subjectType: "AccessLevel", subjectId: level.id, description: id ? "Access level updated" : "Access level created", context: null, ipAddress: null, userAgent: null });
			return jsonSafe({ ...level, permissions });
		});
	}

	async deleteAccessLevel(id: bigint, actorId: bigint) {
		return this.db.transaction(async (tx) => {
			const [assigned] = await tx.select({ id: users.id }).from(users).where(eq(users.accessLevelId, id)).limit(1);
			if (assigned) throw new BadRequestException("Access level is assigned to users.");
			const [level] = await tx.delete(accessLevels).where(eq(accessLevels.id, id)).returning();
			if (!level) throw new NotFoundException("Access level not found.");
			await tx.insert(auditLogs).values({ userId: actorId, actorName: "System", action: "authorization.access-level.deleted", subjectType: "AccessLevel", subjectId: id, description: "Access level deleted", context: null, ipAddress: null, userAgent: null });
			return { deleted: true };
		});
	}

	async getRolePermissions() {
		const rows = await this.db.select().from(rolePermissions);
		return { groups: permissionGroups, roles: ["admin", "user"].map((role) => ({ role, permissions: rows.filter((item) => item.role === role).map((item) => item.permission) })) };
	}

	async hasPermission(userId: bigint, permission: string): Promise<boolean> {
		permission = permission.trim().toLowerCase();
		const canonical = canonicalPermission(permission);
		const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
		if (!user || !user.approvedAt) return false;
		if (user.role === "admin") return true;
		const [roleGrant] = await this.db.select({ id: rolePermissions.id }).from(rolePermissions).where(and(eq(rolePermissions.role, user.role), eq(rolePermissions.permission, canonical))).limit(1);
		if (roleGrant) return true;
		if (!user.accessLevelId) return false;
		const [levelGrant] = await this.db.select({ id: accessLevelPermissions.id }).from(accessLevelPermissions).where(and(eq(accessLevelPermissions.accessLevelId, user.accessLevelId), eq(accessLevelPermissions.permission, canonical))).limit(1);
		return Boolean(levelGrant);
	}

	async canAccessDepartment(userId: bigint, departmentId: bigint | null, hasGlobalScope: boolean): Promise<boolean> {
		const [user] = await this.db.select({ departmentId: users.departmentId, role: users.role, approvedAt: users.approvedAt }).from(users).where(eq(users.id, userId)).limit(1);
		if (!user?.approvedAt) return false;
		if (user.role === "admin" || hasGlobalScope) return true;
		return departmentId !== null && user.departmentId === departmentId;
	}

	async syncRolePermissions(role: "admin" | "user", requested: string[], actorId: bigint, registeredPermissions: readonly string[] = knownPermissions) {
		const registered = new Set(registeredPermissions.map((permission) => permission.trim().toLowerCase()));
		const known = new Set((knownPermissions as readonly string[]).filter((permission) => registered.has(permission)));
		const permissions = [...new Set(requested.map((permission) => permission.trim().toLowerCase()).filter((permission) => known.has(permission)))];
		await this.db.transaction(async (tx) => {
			await tx.delete(rolePermissions).where(eq(rolePermissions.role, role));
			if (permissions.length) await tx.insert(rolePermissions).values(permissions.map((permission) => ({ role, permission })));
			await tx.insert(auditLogs).values({ userId: actorId, actorName: "System", action: "authorization.role-permissions.updated", subjectType: "Role", subjectId: null, description: `Permissions updated for role ${role}`, context: null, ipAddress: null, userAgent: null });
		});
		return permissions;
	}
}
