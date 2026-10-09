import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { BaseRepository } from "../../common/repository/base.repository.js";
import {
  DRIZZLE_DB,
  type DrizzleDatabase,
} from "../../database/database.token.js";
import {
  accessLevelPermissions,
  accessLevels,
  auditLogs,
  businessUnits,
  companies,
  correctiveActions,
  correctiveAlerts,
  departments,
  holdings,
  kpiManagementKpis,
  membershipRoles,
  memberships,
  permissions,
  rolePermissions,
  roles,
  users,
} from "../../../../../src/db/schema.js";
import type { SmartManagerAuthContext } from "../permissions/smart-manager-authorization.js";

@Injectable()
export class AuthorizationRepository extends BaseRepository {
  constructor(@Inject(DRIZZLE_DB) db: DrizzleDatabase) {
    super(db);
  }

  async listAccessLevels() {
    const rows = await this.db
      .select({ level: accessLevels, departmentName: departments.name })
      .from(accessLevels)
      .leftJoin(departments, eq(accessLevels.departmentId, departments.id))
      .orderBy(asc(accessLevels.name));
    const grants = await this.db
      .select()
      .from(accessLevelPermissions)
      .orderBy(asc(accessLevelPermissions.permission));
    return { rows, grants };
  }

  saveAccessLevel(
    input: { name: string; departmentId: bigint | null; permissions: string[] },
    actorId: bigint,
    id?: bigint,
  ) {
    return this.db.transaction(async (tx) => {
      const name = input.name.trim();
      const [sameName] = await tx
        .select({ id: accessLevels.id })
        .from(accessLevels)
        .where(sql`lower(${accessLevels.name}) = lower(${name})`)
        .limit(1);
      if (sameName && sameName.id !== id) return { duplicate: true as const };
      if (input.departmentId !== null) {
        const [department] = await tx
          .select({ id: departments.id })
          .from(departments)
          .where(eq(departments.id, input.departmentId))
          .limit(1);
        if (!department) return { missingDepartment: true as const };
      }
      const [level] = id
        ? await tx
            .update(accessLevels)
            .set({
              name,
              departmentId: input.departmentId,
              updatedAt: new Date(),
            })
            .where(eq(accessLevels.id, id))
            .returning()
        : await tx
            .insert(accessLevels)
            .values({ name, departmentId: input.departmentId })
            .returning();
      if (!level) return { missingLevel: true as const };
      await tx
        .delete(accessLevelPermissions)
        .where(eq(accessLevelPermissions.accessLevelId, level.id));
      if (input.permissions.length)
        await tx
          .insert(accessLevelPermissions)
          .values(
            input.permissions.map((permission) => ({
              accessLevelId: level.id,
              permission,
            })),
          );
      await tx
        .insert(auditLogs)
        .values({
          userId: actorId,
          actorName: "System",
          action: id
            ? "authorization.access-level.updated"
            : "authorization.access-level.created",
          subjectType: "AccessLevel",
          subjectId: level.id,
          description: id ? "Access level updated" : "Access level created",
          context: null,
          ipAddress: null,
          userAgent: null,
        });
      return { level, permissions: input.permissions };
    });
  }

  deleteAccessLevel(id: bigint, actorId: bigint) {
    return this.db.transaction(async (tx) => {
      const [assigned] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.accessLevelId, id))
        .limit(1);
      if (assigned) return { assigned: true as const };
      const [level] = await tx
        .delete(accessLevels)
        .where(eq(accessLevels.id, id))
        .returning();
      if (!level) return { missing: true as const };
      await tx
        .insert(auditLogs)
        .values({
          userId: actorId,
          actorName: "System",
          action: "authorization.access-level.deleted",
          subjectType: "AccessLevel",
          subjectId: id,
          description: "Access level deleted",
          context: null,
          ipAddress: null,
          userAgent: null,
        });
      return { deleted: true as const };
    });
  }

  listRolePermissions() {
    return this.db.select().from(rolePermissions);
  }

  async defaultAuthContext(userId: bigint) {
    const [membership] = await this.db
      .select({ membership: memberships, holdingStatus: holdings.status })
      .from(memberships)
      .innerJoin(holdings, eq(memberships.holdingId, holdings.id))
      .where(
        and(
          eq(memberships.userId, userId),
          eq(memberships.status, "active"),
          eq(holdings.status, "active"),
        ),
      )
      .orderBy(
        sql`case when ${memberships.isDefault} then 0 else 1 end`,
        asc(memberships.createdAt),
      )
      .limit(1);
    if (!membership) return null;
    const roleRows = await this.db
      .select({ id: roles.id })
      .from(membershipRoles)
      .innerJoin(roles, eq(membershipRoles.roleId, roles.id))
      .where(
        and(
          eq(membershipRoles.membershipId, membership.membership.id),
          or(
            isNull(roles.holdingId),
            eq(roles.holdingId, membership.membership.holdingId),
          ),
        ),
      );
    return {
      userId: userId.toString(),
      holdingId: membership.membership.holdingId.toString(),
      membershipId: membership.membership.id.toString(),
      companyId: membership.membership.companyId?.toString() ?? null,
      branchId: membership.membership.branchId?.toString() ?? null,
      businessUnitId: membership.membership.businessUnitId?.toString() ?? null,
      roleIds: roleRows.map((role) => role.id.toString()),
      scopeType: membership.membership.scopeType,
    };
  }

  async resourceForDepartment(departmentId: bigint) {
    const [row] = await this.db
      .select({
        holdingId: companies.holdingId,
        companyId: companies.id,
        branchId: businessUnits.branchId,
        businessUnitId: businessUnits.id,
        domain: businessUnits.domain,
      })
      .from(businessUnits)
      .innerJoin(companies, eq(businessUnits.companyId, companies.id))
      .innerJoin(holdings, eq(companies.holdingId, holdings.id))
      .where(
        and(
          eq(businessUnits.legacyDepartmentId, departmentId),
          eq(businessUnits.status, "active"),
          eq(companies.status, "active"),
          eq(holdings.status, "active"),
        ),
      )
      .limit(1);
    return row
      ? {
          holdingId: row.holdingId.toString(),
          companyId: row.companyId.toString(),
          branchId: row.branchId?.toString() ?? null,
          businessUnitId: row.businessUnitId.toString(),
          domain: row.domain,
        }
      : null;
  }

  async kpiAuthorizationTarget(kpiId: bigint) {
    const [row] = await this.db
      .select({
        departmentId: kpiManagementKpis.departmentId,
        holdingId: kpiManagementKpis.holdingId,
        companyId: kpiManagementKpis.companyId,
        branchId: kpiManagementKpis.branchId,
        businessUnitId: kpiManagementKpis.businessUnitId,
        domain: businessUnits.domain,
        ownerUserId: kpiManagementKpis.ownerUserId,
        reporterUserId: kpiManagementKpis.reporterUserId,
      })
      .from(kpiManagementKpis)
      .leftJoin(
        businessUnits,
        eq(kpiManagementKpis.businessUnitId, businessUnits.id),
      )
      .where(eq(kpiManagementKpis.id, kpiId))
      .limit(1);
    return row ?? null;
  }

  async actionAuthorizationTarget(actionId: bigint) {
    const [row] = await this.db
      .select({
        departmentId: correctiveActions.departmentId,
        ownerUserId: correctiveActions.ownerUserId,
        approverUserId: correctiveActions.approverUserId,
      })
      .from(correctiveActions)
      .where(eq(correctiveActions.id, actionId))
      .limit(1);
    return row ?? null;
  }

  async alertAuthorizationTarget(alertId: bigint) {
    const [row] = await this.db
      .select({
        departmentId: correctiveAlerts.departmentId,
        assignedUserId: correctiveAlerts.assignedTo,
      })
      .from(correctiveAlerts)
      .where(eq(correctiveAlerts.id, alertId))
      .limit(1);
    return row ?? null;
  }

  async departmentIdsForScope(
    context: SmartManagerAuthContext,
    scopeType: string,
    domain: string | null,
  ) {
    if (!/^\d+$/.test(context.holdingId)) return [];
    const predicates = [
      isNotNull(businessUnits.legacyDepartmentId),
      eq(companies.holdingId, BigInt(context.holdingId)),
      eq(companies.status, "active"),
      isNull(companies.archivedAt),
      eq(businessUnits.status, "active"),
    ];
    switch (scopeType) {
      case "holding":
        break;
      case "company":
        if (!context.companyId || !/^\d+$/.test(context.companyId)) return [];
        predicates.push(eq(companies.id, BigInt(context.companyId)));
        break;
      case "branch":
        if (
          !context.companyId ||
          !context.branchId ||
          !/^\d+$/.test(context.branchId)
        )
          return [];
        predicates.push(
          eq(companies.id, BigInt(context.companyId)),
          eq(businessUnits.branchId, BigInt(context.branchId)),
        );
        break;
      case "businessUnit":
        if (
          !context.companyId ||
          !context.businessUnitId ||
          !/^\d+$/.test(context.businessUnitId)
        )
          return [];
        predicates.push(
          eq(companies.id, BigInt(context.companyId)),
          eq(businessUnits.id, BigInt(context.businessUnitId)),
        );
        break;
      case "domain":
        if (!context.companyId || !domain || !/^\d+$/.test(context.companyId))
          return [];
        predicates.push(
          eq(companies.id, BigInt(context.companyId)),
          eq(businessUnits.domain, domain),
        );
        break;
      default:
        return [];
    }
    const rows = await this.db
      .select({ departmentId: businessUnits.legacyDepartmentId })
      .from(businessUnits)
      .innerJoin(companies, eq(businessUnits.companyId, companies.id))
      .where(and(...predicates));
    return [
      ...new Set(
        rows.flatMap((row) =>
          row.departmentId === null ? [] : [row.departmentId],
        ),
      ),
    ];
  }

  async permissionGrants(context: SmartManagerAuthContext, permission: string) {
    if (!/^\d+$/.test(context.membershipId) || !/^\d+$/.test(context.userId))
      return [];
    const roleIds = context.roleIds
      .filter((id) => /^\d+$/.test(id))
      .map((id) => BigInt(id));
    if (!roleIds.length) return [];
    const [membership] = await this.db
      .select({ id: memberships.id })
      .from(memberships)
      .where(
        and(
          eq(memberships.id, BigInt(context.membershipId)),
          eq(memberships.userId, BigInt(context.userId)),
          eq(memberships.holdingId, BigInt(context.holdingId)),
          eq(memberships.status, "active"),
        ),
      )
      .limit(1);
    if (!membership) return [];
    const [assignedRole] = await this.db
      .select({ id: membershipRoles.id })
      .from(membershipRoles)
      .innerJoin(roles, eq(membershipRoles.roleId, roles.id))
      .where(
        and(
          eq(membershipRoles.membershipId, membership.id),
          inArray(membershipRoles.roleId, roleIds),
          or(
            isNull(roles.holdingId),
            eq(roles.holdingId, BigInt(context.holdingId)),
          ),
        ),
      )
      .limit(1);
    if (!assignedRole) return [];
    return this.db
      .select({
        permission: permissions.key,
        scopeType: rolePermissions.scopeType,
        domain: rolePermissions.domain,
      })
      .from(rolePermissions)
      .innerJoin(roles, eq(rolePermissions.roleId, roles.id))
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(
        and(
          inArray(rolePermissions.roleId, roleIds),
          eq(permissions.key, permission),
          or(
            isNull(roles.holdingId),
            eq(roles.holdingId, BigInt(context.holdingId)),
          ),
        ),
      );
  }

  async hasPermission(userId: bigint, permission: string) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user || !user.approvedAt) return false;
    const [roleGrant] = await this.db
      .select({ id: rolePermissions.id })
      .from(rolePermissions)
      .where(
        and(
          eq(rolePermissions.role, user.role),
          eq(rolePermissions.permission, permission),
        ),
      )
      .limit(1);
    if (roleGrant) return true;
    if (!user.accessLevelId) return false;
    const [levelGrant] = await this.db
      .select({ id: accessLevelPermissions.id })
      .from(accessLevelPermissions)
      .where(
        and(
          eq(accessLevelPermissions.accessLevelId, user.accessLevelId),
          eq(accessLevelPermissions.permission, permission),
        ),
      )
      .limit(1);
    return Boolean(levelGrant);
  }

  async findDepartmentAccess(userId: bigint) {
    return (
      (
        await this.db
          .select({
            departmentId: users.departmentId,
            role: users.role,
            approvedAt: users.approvedAt,
          })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1)
      )[0] ?? null
    );
  }

  async userMembershipResources(userId: bigint) {
    return this.db
      .select({
        holdingId: memberships.holdingId,
        companyId: memberships.companyId,
        branchId: memberships.branchId,
        businessUnitId: memberships.businessUnitId,
        domain: businessUnits.domain,
      })
      .from(memberships)
      .innerJoin(holdings, eq(memberships.holdingId, holdings.id))
      .leftJoin(companies, eq(memberships.companyId, companies.id))
      .leftJoin(businessUnits, eq(memberships.businessUnitId, businessUnits.id))
      .where(
        and(
          eq(memberships.userId, userId),
          inArray(memberships.status, ["active", "pending"]),
          eq(holdings.status, "active"),
          or(isNull(memberships.companyId), eq(companies.status, "active")),
        ),
      );
  }

  syncRolePermissions(
    role: "admin" | "user",
    permissions: string[],
    actorId: bigint,
  ) {
    return this.db.transaction(async (tx) => {
      await tx.delete(rolePermissions).where(eq(rolePermissions.role, role));
      if (permissions.length)
        await tx
          .insert(rolePermissions)
          .values(permissions.map((permission) => ({ role, permission })));
      await tx
        .insert(auditLogs)
        .values({
          userId: actorId,
          actorName: "System",
          action: "authorization.role-permissions.updated",
          subjectType: "Role",
          subjectId: null,
          description: "Permissions updated for role " + role,
          context: null,
          ipAddress: null,
          userAgent: null,
        });
    });
  }
}
