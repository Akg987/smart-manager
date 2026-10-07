import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, notInArray } from "drizzle-orm";
import { DRIZZLE } from "../../../../../../core/database/database.constants";
import type { Database } from "../../../../../../core/database/database.service";
import type { PermissionRef } from "../../../../../permissions/domain/permission";
import { permissions } from "../../../../../permissions/infrastructure/persistence/relational/entities/permission.entity";
import type {
	Role,
	RolePermissionGrant,
	RoleWithPermissions,
	WriteRoleInput,
} from "../../../../domain/role";
import { RoleRepository } from "../../role.repository";
import { roles } from "../entities/role.entity";
import { rolePermissions } from "../entities/role-permission.entity";
import { RoleMapper } from "../mappers/role.mapper";

@Injectable()
export class RolesRelationalRepository implements RoleRepository {
	constructor(@Inject(DRIZZLE) private readonly db: Database) {}

	async list(): Promise<Role[]> {
		const rows = await this.db.select().from(roles).orderBy(asc(roles.key));
		return rows.map(RoleMapper.toDomain);
	}

	async listWithPermissions(): Promise<RoleWithPermissions[]> {
		const roleRows = await this.list();
		const links = await this.db
			.select({
				roleId: rolePermissions.roleId,
				module: permissions.module,
				action: permissions.action,
				locked: rolePermissions.locked,
			})
			.from(rolePermissions)
			.innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
			.orderBy(asc(permissions.module), asc(permissions.action));
		const grouped = new Map<number, RolePermissionGrant[]>();
		for (const link of links) {
			const grants = grouped.get(link.roleId) ?? [];
			grants.push({
				module: link.module,
				action: link.action,
				locked: link.locked,
			});
			grouped.set(link.roleId, grants);
		}
		return roleRows.map((role) => ({
			...role,
			permissions: grouped.get(role.id) ?? [],
		}));
	}

	async findByKey(key: string): Promise<Role | null> {
		const [row] = await this.db
			.select()
			.from(roles)
			.where(eq(roles.key, key))
			.limit(1);
		return row ? RoleMapper.toDomain(row) : null;
	}

	async upsert(input: WriteRoleInput): Promise<Role> {
		const now = new Date();
		const values = RoleMapper.toPersistence(input);
		const [row] = await this.db
			.insert(roles)
			.values(values)
			.onConflictDoUpdate({
				target: roles.key,
				set: {
					name: values.name,
					description: values.description,
					updatedAt: now,
				},
			})
			.returning();
		if (!row) {
			throw new Error("failed to upsert role");
		}
		return RoleMapper.toDomain(row);
	}

	async deleteByKey(key: string): Promise<boolean> {
		const rows = await this.db
			.delete(roles)
			.where(eq(roles.key, key))
			.returning({ id: roles.id });
		return rows.length > 0;
	}

	async listPermissionRefs(roleKey: string): Promise<PermissionRef[]> {
		const rows = await this.db
			.select({
				module: permissions.module,
				action: permissions.action,
			})
			.from(rolePermissions)
			.innerJoin(roles, eq(rolePermissions.roleId, roles.id))
			.innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
			.where(eq(roles.key, roleKey))
			.orderBy(asc(permissions.module), asc(permissions.action));
		return rows;
	}

	async listGrants(roleId: number): Promise<RolePermissionGrant[]> {
		const rows = await this.db
			.select({
				module: permissions.module,
				action: permissions.action,
				locked: rolePermissions.locked,
			})
			.from(rolePermissions)
			.innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
			.where(eq(rolePermissions.roleId, roleId))
			.orderBy(asc(permissions.module), asc(permissions.action));
		return rows;
	}

	async grantMissing(roleId: number, permissionIds: number[]): Promise<void> {
		if (permissionIds.length === 0) {
			return;
		}
		await this.db
			.insert(rolePermissions)
			.values(permissionIds.map((permissionId) => ({ roleId, permissionId })))
			.onConflictDoNothing();
	}

	async syncLockedGrants(
		roleId: number,
		permissionIds: number[],
	): Promise<void> {
		const uniqueIds = [...new Set(permissionIds)];
		await this.db.transaction(async (tx) => {
			if (uniqueIds.length > 0) {
				await tx
					.insert(rolePermissions)
					.values(
						uniqueIds.map((permissionId) => ({
							roleId,
							permissionId,
							locked: true,
						})),
					)
					.onConflictDoUpdate({
						target: [rolePermissions.roleId, rolePermissions.permissionId],
						set: { locked: true },
					});
			}
			await tx.delete(rolePermissions).where(lockedOutside(roleId, uniqueIds));
		});
	}

	async replaceEditablePermissions(
		roleId: number,
		permissionIds: number[],
	): Promise<void> {
		const uniqueIds = [...new Set(permissionIds)];
		await this.db.transaction(async (tx) => {
			await tx
				.delete(rolePermissions)
				.where(editableOutside(roleId, uniqueIds));
			if (uniqueIds.length === 0) {
				return;
			}
			await tx
				.insert(rolePermissions)
				.values(
					uniqueIds.map((permissionId) => ({
						roleId,
						permissionId,
						locked: false,
					})),
				)
				.onConflictDoNothing();
		});
	}
}

function lockedOutside(roleId: number, permissionIds: number[]) {
	const filters = [
		eq(rolePermissions.roleId, roleId),
		eq(rolePermissions.locked, true),
	];
	if (permissionIds.length > 0) {
		filters.push(notInArray(rolePermissions.permissionId, permissionIds));
	}
	return and(...filters);
}

function editableOutside(roleId: number, permissionIds: number[]) {
	const filters = [
		eq(rolePermissions.roleId, roleId),
		eq(rolePermissions.locked, false),
	];
	if (permissionIds.length > 0) {
		filters.push(notInArray(rolePermissions.permissionId, permissionIds));
	}
	return and(...filters);
}
