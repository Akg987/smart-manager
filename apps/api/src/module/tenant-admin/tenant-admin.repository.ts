import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { BaseRepository } from "../../common/repository/base.repository.js";
import {
  DRIZZLE_DB,
  type DrizzleDatabase,
} from "../../database/database.token.js";
import {
  auditLogs,
  branches,
  businessUnits,
  companies,
  invitations,
  holdings,
  membershipRoles,
  memberships,
  permissions,
  rolePermissions,
  roles,
  users,
} from "../../../../../src/db/schema.js";
import { invitationSnapshotAllowsCurrentGrants } from "./invitation-security.js";

@Injectable()
export class TenantAdminRepository extends BaseRepository {
  constructor(@Inject(DRIZZLE_DB) db: DrizzleDatabase) {
    super(db);
  }

  listCompanies(holdingId: bigint, companyId: bigint | null) {
    return this.db
      .select()
      .from(companies)
      .where(
        and(
          eq(companies.holdingId, holdingId),
          eq(companies.status, "active"),
          ...(companyId ? [eq(companies.id, companyId)] : []),
        ),
      )
      .orderBy(asc(companies.name));
  }

  findCompany(holdingId: bigint, companyId: bigint) {
    return this.db
      .select({ id: companies.id, holdingId: companies.holdingId })
      .from(companies)
      .innerJoin(holdings, eq(companies.holdingId, holdings.id))
      .where(
        and(
          eq(companies.id, companyId),
          eq(companies.holdingId, holdingId),
          eq(companies.status, "active"),
          eq(holdings.status, "active"),
          isNull(companies.archivedAt),
        ),
      )
      .limit(1);
  }

  createCompany(
    input: {
      holdingId: bigint;
      name: string;
      code: string;
      calendar: string;
      currency: string;
    },
    actorId: bigint,
    membershipId: bigint,
  ) {
    return this.db.transaction(async (tx) => {
      const [company] = await tx
        .insert(companies)
        .values({ ...input, status: "active" })
        .returning();
      await tx.insert(auditLogs).values({
        userId: actorId,
        holdingId: input.holdingId,
        companyId: company.id,
        membershipId,
        actorName: "System",
        action: "tenant.company.created",
        subjectType: "Company",
        subjectId: company.id,
        description: "Company created",
        context: { old: null, new: { name: company.name, code: company.code } },
        ipAddress: null,
        userAgent: null,
      });
      return company;
    });
  }

  listBranches(companyId: bigint) {
    return this.db
      .select()
      .from(branches)
      .where(
        and(eq(branches.companyId, companyId), eq(branches.status, "active")),
      )
      .orderBy(asc(branches.name));
  }

  findBranch(companyId: bigint, branchId: bigint) {
    return this.db
      .select({ id: branches.id, companyId: branches.companyId })
      .from(branches)
      .where(
        and(
          eq(branches.id, branchId),
          eq(branches.companyId, companyId),
          eq(branches.status, "active"),
        ),
      )
      .limit(1);
  }

  findBusinessUnit(companyId: bigint, businessUnitId: bigint) {
    return this.db
      .select({
        id: businessUnits.id,
        companyId: businessUnits.companyId,
        branchId: businessUnits.branchId,
        domain: businessUnits.domain,
      })
      .from(businessUnits)
      .where(
        and(
          eq(businessUnits.id, businessUnitId),
          eq(businessUnits.companyId, companyId),
          eq(businessUnits.status, "active"),
        ),
      )
      .limit(1);
  }

  createBranch(
    input: {
      companyId: bigint;
      name: string;
      code: string;
      managerUserId: bigint | null;
    },
    actorId: bigint,
    holdingId: bigint,
    membershipId: bigint,
  ) {
    return this.db.transaction(async (tx) => {
      const [branch] = await tx
        .insert(branches)
        .values({ ...input, status: "active" })
        .returning();
      await tx
        .insert(auditLogs)
        .values({
          userId: actorId,
          holdingId,
          companyId: input.companyId,
          membershipId,
          actorName: "System",
          action: "tenant.branch.created",
          subjectType: "Branch",
          subjectId: branch.id,
          description: "Branch created",
          context: {
            old: null,
            new: {
              name: branch.name,
              code: branch.code,
              managerUserId: branch.managerUserId?.toString() ?? null,
            },
          },
          ipAddress: null,
          userAgent: null,
        });
      return branch;
    });
  }

  updateBranch(
    companyId: bigint,
    branchId: bigint,
    changes: { name?: string; code?: string },
    actorId: bigint,
    holdingId: bigint,
    membershipId: bigint,
  ) {
    return this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(branches)
        .where(
          and(
            eq(branches.id, branchId),
            eq(branches.companyId, companyId),
            eq(branches.status, "active"),
          ),
        )
        .for("update")
        .limit(1);
      if (!existing) return undefined;
      const [updated] = await tx
        .update(branches)
        .set({ ...changes, updatedAt: new Date() })
        .where(eq(branches.id, branchId))
        .returning();
      await tx
        .insert(auditLogs)
        .values({
          userId: actorId,
          holdingId,
          companyId,
          membershipId,
          actorName: "System",
          action: "tenant.branch.updated",
          subjectType: "Branch",
          subjectId: branchId,
          description: "Branch updated",
          context: {
            actorUserId: actorId.toString(),
            old: { name: existing.name, code: existing.code },
            new: { name: updated.name, code: updated.code },
          },
          ipAddress: null,
          userAgent: null,
        });
      return updated;
    });
  }

  listBusinessUnits(companyId: bigint) {
    return this.db
      .select({ unit: businessUnits, branchName: branches.name })
      .from(businessUnits)
      .leftJoin(branches, eq(businessUnits.branchId, branches.id))
      .where(
        and(
          eq(businessUnits.companyId, companyId),
          eq(businessUnits.status, "active"),
        ),
      )
      .orderBy(asc(businessUnits.name));
  }

  createBusinessUnit(
    input: {
      companyId: bigint;
      branchId: bigint | null;
      name: string;
      code: string;
      managerUserId: bigint | null;
      domain: string;
    },
    actorId: bigint,
    holdingId: bigint,
    membershipId: bigint,
  ) {
    return this.db.transaction(async (tx) => {
      const [unit] = await tx
        .insert(businessUnits)
        .values({ ...input, status: "active" })
        .returning();
      await tx
        .insert(auditLogs)
        .values({
          userId: actorId,
          holdingId,
          companyId: input.companyId,
          membershipId,
          actorName: "System",
          action: "tenant.business-unit.created",
          subjectType: "BusinessUnit",
          subjectId: unit.id,
          description: "Business unit created",
          context: {
            old: null,
            new: {
              name: unit.name,
              code: unit.code,
              branchId: unit.branchId?.toString() ?? null,
              domain: unit.domain,
            },
          },
          ipAddress: null,
          userAgent: null,
        });
      return unit;
    });
  }

  updateBusinessUnit(
    companyId: bigint,
    businessUnitId: bigint,
    changes: {
      name?: string;
      code?: string;
      branchId?: bigint | null;
      domain?: string;
    },
    actorId: bigint,
    holdingId: bigint,
    membershipId: bigint,
  ) {
    return this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(businessUnits)
        .where(
          and(
            eq(businessUnits.id, businessUnitId),
            eq(businessUnits.companyId, companyId),
            eq(businessUnits.status, "active"),
          ),
        )
        .for("update")
        .limit(1);
      if (!existing) return undefined;
      const [updated] = await tx
        .update(businessUnits)
        .set({ ...changes, updatedAt: new Date() })
        .where(eq(businessUnits.id, businessUnitId))
        .returning();
      await tx
        .insert(auditLogs)
        .values({
          userId: actorId,
          holdingId,
          companyId,
          membershipId,
          actorName: "System",
          action: "tenant.business-unit.updated",
          subjectType: "BusinessUnit",
          subjectId: businessUnitId,
          description: "Business unit updated",
          context: {
            actorUserId: actorId.toString(),
            old: {
              name: existing.name,
              code: existing.code,
              branchId: existing.branchId?.toString() ?? null,
              domain: existing.domain,
            },
            new: {
              name: updated.name,
              code: updated.code,
              branchId: updated.branchId?.toString() ?? null,
              domain: updated.domain,
            },
          },
          ipAddress: null,
          userAgent: null,
        });
      return updated;
    });
  }

  async listMemberships(holdingId: bigint, companyId: bigint | null) {
    const rows = await this.db
      .select({ membership: memberships, user: users })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(
        and(
          eq(memberships.holdingId, holdingId),
          inArray(memberships.status, ["active", "pending"]),
          ...(companyId ? [eq(memberships.companyId, companyId)] : []),
        ),
      )
      .orderBy(asc(users.lastName), asc(users.firstName), asc(memberships.id));
    if (!rows.length) return [];
    const ids = rows.map(({ membership }) => membership.id);
    const roleRows = await this.db
      .select({
        membershipId: membershipRoles.membershipId,
        id: roles.id,
        key: roles.key,
        name: roles.name,
      })
      .from(membershipRoles)
      .innerJoin(roles, eq(membershipRoles.roleId, roles.id))
      .where(inArray(membershipRoles.membershipId, ids))
      .orderBy(asc(roles.name));
    return rows.map(({ membership, user }) => ({
      membership,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        mobile: user.mobile,
        approvedAt: user.approvedAt,
      },
      roles: roleRows.filter((role) => role.membershipId === membership.id),
    }));
  }

  findMembership(holdingId: bigint, companyId: bigint, membershipId: bigint) {
    return this.db
      .select({ membership: memberships, holding: companies.holdingId })
      .from(memberships)
      .innerJoin(companies, eq(memberships.companyId, companies.id))
      .where(
        and(
          eq(memberships.id, membershipId),
          eq(memberships.holdingId, holdingId),
          eq(memberships.companyId, companyId),
        ),
      )
      .limit(1);
  }

  async roleDefinitions(holdingId: bigint, roleIds: bigint[]) {
    if (!roleIds.length) return [];
    const roleRows = await this.db
      .select()
      .from(roles)
      .where(
        and(
          inArray(roles.id, roleIds),
          eq(roles.holdingId, holdingId),
          eq(roles.isSystem, false),
        ),
      );
    if (!roleRows.length) return [];
    const allowedIds = roleRows.map((role) => role.id);
    const grants = await this.db
      .select({
        roleId: rolePermissions.roleId,
        permission: permissions.key,
        scopeType: rolePermissions.scopeType,
        domain: rolePermissions.domain,
      })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(inArray(rolePermissions.roleId, allowedIds));
    return roleRows.map((role) => ({
      role,
      grants: grants.filter((grant) => grant.roleId === role.id),
    }));
  }

  async listDelegableRoleDefinitions(holdingId: bigint) {
    const roleRows = await this.db
      .select()
      .from(roles)
      .where(and(eq(roles.holdingId, holdingId), eq(roles.isSystem, false)))
      .orderBy(asc(roles.name));
    if (!roleRows.length) return [];
    const grants = await this.db
      .select({
        roleId: rolePermissions.roleId,
        permission: permissions.key,
        scopeType: rolePermissions.scopeType,
        domain: rolePermissions.domain,
      })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(
        inArray(
          rolePermissions.roleId,
          roleRows.map((role) => role.id),
        ),
      );
    return roleRows.map((role) => ({
      role,
      grants: grants.filter((grant) => grant.roleId === role.id),
    }));
  }

  listInvitations(holdingId: bigint, companyId: bigint) {
    return this.db
      .select({
        id: invitations.id,
        mobile: invitations.mobile,
        roleId: invitations.roleId,
        expiresAt: invitations.expiresAt,
        createdAt: invitations.createdAt,
        roleKey: roles.key,
        roleName: roles.name,
      })
      .from(invitations)
      .leftJoin(roles, eq(invitations.roleId, roles.id))
      .where(
        and(
          eq(invitations.holdingId, holdingId),
          eq(invitations.companyId, companyId),
          isNull(invitations.acceptedAt),
          isNull(invitations.revokedAt),
          gt(invitations.expiresAt, new Date()),
        ),
      )
      .orderBy(asc(invitations.expiresAt));
  }

  findInvitation(holdingId: bigint, companyId: bigint, invitationId: bigint) {
    return this.db
      .select({
        id: invitations.id,
        mobile: invitations.mobile,
        roleId: invitations.roleId,
        expiresAt: invitations.expiresAt,
        acceptedAt: invitations.acceptedAt,
        revokedAt: invitations.revokedAt,
      })
      .from(invitations)
      .where(
        and(
          eq(invitations.id, invitationId),
          eq(invitations.holdingId, holdingId),
          eq(invitations.companyId, companyId),
          isNull(invitations.acceptedAt),
          isNull(invitations.revokedAt),
        ),
      )
      .limit(1);
  }

  async createInvitation(
    input: {
      holdingId: bigint;
      companyId: bigint;
      mobile: string;
      tokenHash: string;
      roleId: bigint;
      expiresAt: Date;
      roleSnapshot: {
        id: string;
        key: string;
        permissions: {
          key: string;
          scopeType: string;
          domain: string | null;
        }[];
      };
    },
    actorId: bigint,
    membershipId: bigint,
  ) {
    return this.db.transaction(async (tx) => {
      const lockKey = `${input.holdingId}:${input.companyId}:${input.mobile}`;
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${lockKey}))`);
      const [invitation] = await tx
        .insert(invitations)
        .values({
          holdingId: input.holdingId,
          companyId: input.companyId,
          mobile: input.mobile,
          tokenHash: input.tokenHash,
          roleId: input.roleId,
          expiresAt: input.expiresAt,
          createdBy: actorId,
        })
        .returning();
      await tx.insert(auditLogs).values({
        userId: actorId,
        holdingId: input.holdingId,
        companyId: input.companyId,
        membershipId,
        actorName: "System",
        action: "tenant.invitation.created",
        subjectType: "Invitation",
        subjectId: invitation.id,
        description: "Company invitation created",
        context: {
          actorUserId: actorId.toString(),
          recipientMobile: input.mobile,
          delegatedAt: new Date().toISOString(),
          scope: {
            holdingId: input.holdingId.toString(),
            companyId: input.companyId.toString(),
            scopeType: "company",
          },
          new: {
            roleId: input.roleId.toString(),
            roleSnapshot: input.roleSnapshot,
            expiresAt: input.expiresAt.toISOString(),
          },
        },
        ipAddress: null,
        userAgent: null,
      });
      return invitation;
    });
  }

  async revokeInvitation(
    invitationId: bigint,
    actorId: bigint,
    holdingId: bigint,
    companyId: bigint,
    membershipId: bigint,
  ) {
    return this.db.transaction(async (tx) => {
      const [invitation] = await tx
        .select()
        .from(invitations)
        .where(
          and(
            eq(invitations.id, invitationId),
            eq(invitations.holdingId, holdingId),
            eq(invitations.companyId, companyId),
          ),
        )
        .for("update")
        .limit(1);
      if (!invitation || invitation.acceptedAt || invitation.revokedAt)
        return undefined;
      const [createdAudit] = await tx
        .select({ context: auditLogs.context })
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.action, "tenant.invitation.created"),
            eq(auditLogs.subjectType, "Invitation"),
            eq(auditLogs.subjectId, invitationId),
          ),
        )
        .limit(1);
      const [updated] = await tx
        .update(invitations)
        .set({ revokedAt: new Date() })
        .where(eq(invitations.id, invitationId))
        .returning();
      await tx.insert(auditLogs).values({
        userId: actorId,
        holdingId,
        companyId,
        membershipId,
        actorName: "System",
        action: "tenant.invitation.revoked",
        subjectType: "Invitation",
        subjectId: invitationId,
        description: "Company invitation revoked",
        context: {
          actorUserId: actorId.toString(),
          recipientMobile: invitation.mobile,
          revokedAt:
            updated.revokedAt?.toISOString() ?? new Date().toISOString(),
          old: createdAudit?.context ?? null,
        },
        ipAddress: null,
        userAgent: null,
      });
      return updated;
    });
  }

  async acceptInvitation(userId: bigint, tokenHash: string, now = new Date()) {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .select({
          invitation: invitations,
          user: users,
          role: roles,
          holdingStatus: holdings.status,
          companyStatus: companies.status,
        })
        .from(invitations)
        .innerJoin(
          users,
          and(eq(users.id, userId), eq(users.mobile, invitations.mobile)),
        )
        .innerJoin(holdings, eq(holdings.id, invitations.holdingId))
        .innerJoin(
          companies,
          and(
            eq(companies.id, invitations.companyId),
            eq(companies.holdingId, invitations.holdingId),
          ),
        )
        .innerJoin(
          roles,
          and(
            eq(roles.id, invitations.roleId),
            eq(roles.holdingId, invitations.holdingId),
          ),
        )
        .where(
          and(
            eq(invitations.tokenHash, tokenHash),
            isNull(invitations.acceptedAt),
            isNull(invitations.revokedAt),
            gt(invitations.expiresAt, now),
            eq(holdings.status, "active"),
            eq(companies.status, "active"),
            isNull(companies.archivedAt),
            eq(roles.isSystem, false),
          ),
        )
        .for("update")
        .limit(1);
      if (
        !row ||
        row.holdingStatus !== "active" ||
        row.companyStatus !== "active" ||
        !row.invitation.companyId ||
        !row.invitation.roleId
      )
        return { invalid: true as const };
      const [createdAudit] = await tx
        .select({ context: auditLogs.context })
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.action, "tenant.invitation.created"),
            eq(auditLogs.subjectType, "Invitation"),
            eq(auditLogs.subjectId, row.invitation.id),
          ),
        )
        .limit(1);
      const savedContext =
        createdAudit?.context &&
        typeof createdAudit.context === "object" &&
        !Array.isArray(createdAudit.context)
          ? (createdAudit.context as Record<string, unknown>)
          : null;
      const created =
        savedContext?.new &&
        typeof savedContext.new === "object" &&
        !Array.isArray(savedContext.new)
          ? (savedContext.new as Record<string, unknown>)
          : null;
      const snapshot =
        created?.roleSnapshot &&
        typeof created.roleSnapshot === "object" &&
        !Array.isArray(created.roleSnapshot)
          ? (created.roleSnapshot as Record<string, unknown>)
          : null;
      const currentGrants = await tx
        .select({
          key: permissions.key,
          scopeType: rolePermissions.scopeType,
          domain: rolePermissions.domain,
        })
        .from(rolePermissions)
        .innerJoin(
          permissions,
          eq(rolePermissions.permissionId, permissions.id),
        )
        .where(eq(rolePermissions.roleId, row.role.id));
      const normalizedGrants = currentGrants.map((grant) => ({
        key: grant.key,
        scopeType: grant.scopeType ?? "company",
        domain: grant.domain,
      }));
      if (
        !invitationSnapshotAllowsCurrentGrants(
          snapshot?.permissions,
          normalizedGrants,
        )
      )
        return { invalid: true as const };

      const companyId = row.invitation.companyId;
      const [existing] = await tx
        .select()
        .from(memberships)
        .where(
          and(
            eq(memberships.userId, userId),
            eq(memberships.holdingId, row.invitation.holdingId),
            eq(memberships.companyId, companyId),
            isNull(memberships.branchId),
            isNull(memberships.businessUnitId),
          ),
        )
        .for("update")
        .limit(1);
      const membership = existing
        ? (
            await tx
              .update(memberships)
              .set({
                scopeType: "company",
                status: row.user.approvedAt ? "active" : "pending",
                updatedAt: now,
              })
              .where(eq(memberships.id, existing.id))
              .returning()
          )[0]
        : (
            await tx
              .insert(memberships)
              .values({
                userId,
                holdingId: row.invitation.holdingId,
                companyId,
                scopeType: "company",
                status: row.user.approvedAt ? "active" : "pending",
                isDefault: false,
              })
              .returning()
          )[0];
      await tx
        .insert(membershipRoles)
        .values({ membershipId: membership.id, roleId: row.role.id })
        .onConflictDoNothing();
      const [accepted] = await tx
        .update(invitations)
        .set({ acceptedAt: now })
        .where(
          and(
            eq(invitations.id, row.invitation.id),
            isNull(invitations.acceptedAt),
            isNull(invitations.revokedAt),
          ),
        )
        .returning();
      if (!accepted) return { invalid: true as const };
      await tx.insert(auditLogs).values({
        userId,
        holdingId: row.invitation.holdingId,
        companyId,
        membershipId: membership.id,
        actorName: "System",
        action: "tenant.invitation.accepted",
        subjectType: "Invitation",
        subjectId: row.invitation.id,
        description: "Company invitation accepted",
        context: {
          actorUserId: userId.toString(),
          recipientUserId: userId.toString(),
          recipientMobile: row.user.mobile,
          acceptedAt: now.toISOString(),
          scope: {
            holdingId: row.invitation.holdingId.toString(),
            companyId: companyId.toString(),
            scopeType: "company",
          },
          role: {
            id: row.role.id.toString(),
            key: row.role.key,
            permissions: normalizedGrants,
          },
          membership: {
            id: membership.id.toString(),
            status: membership.status,
          },
        },
        ipAddress: null,
        userAgent: null,
      });
      return { membership, acceptedAt: accepted.acceptedAt };
    });
  }

  async assignMembership(
    input: {
      userId: bigint;
      holdingId: bigint;
      companyId: bigint;
      branchId: bigint | null;
      businessUnitId: bigint | null;
      scopeType: string;
      roleIds: bigint[];
      roleSnapshot: {
        id: string;
        key: string;
        permissions: {
          key: string;
          scopeType: string;
          domain: string | null;
        }[];
      }[];
    },
    actorId: bigint,
    actorMembershipId: bigint,
  ) {
    return this.db.transaction(async (tx) => {
      const lockKey = [
        input.holdingId,
        input.companyId,
        input.branchId ?? "-",
        input.businessUnitId ?? "-",
        input.userId,
      ].join(":");
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${lockKey}))`);
      const [user] = await tx
        .select({ id: users.id, approvedAt: users.approvedAt })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);
      if (!user) return { missingUser: true as const };
      const whereScope = and(
        eq(memberships.userId, input.userId),
        eq(memberships.holdingId, input.holdingId),
        eq(memberships.companyId, input.companyId),
        input.branchId === null
          ? isNull(memberships.branchId)
          : eq(memberships.branchId, input.branchId),
        input.businessUnitId === null
          ? isNull(memberships.businessUnitId)
          : eq(memberships.businessUnitId, input.businessUnitId),
      );
      const [existing] = await tx
        .select()
        .from(memberships)
        .where(whereScope)
        .for("update")
        .limit(1);
      const oldRoles = existing
        ? await tx
            .select({
              roleId: roles.id,
              key: roles.key,
              isSystem: roles.isSystem,
            })
            .from(membershipRoles)
            .innerJoin(roles, eq(membershipRoles.roleId, roles.id))
            .where(eq(membershipRoles.membershipId, existing.id))
        : [];
      const oldRoleGrants = oldRoles.length
        ? await tx
            .select({
              roleId: rolePermissions.roleId,
              permission: permissions.key,
              scopeType: rolePermissions.scopeType,
              domain: rolePermissions.domain,
            })
            .from(rolePermissions)
            .innerJoin(
              permissions,
              eq(rolePermissions.permissionId, permissions.id),
            )
            .where(
              inArray(
                rolePermissions.roleId,
                oldRoles.map((role) => role.roleId),
              ),
            )
        : [];
      const membership = existing
        ? (
            await tx
              .update(memberships)
              .set({
                scopeType:
                  input.scopeType as typeof memberships.$inferInsert.scopeType,
                status: user.approvedAt ? "active" : "pending",
                updatedAt: new Date(),
              })
              .where(eq(memberships.id, existing.id))
              .returning()
          )[0]
        : (
            await tx
              .insert(memberships)
              .values({
                userId: input.userId,
                holdingId: input.holdingId,
                companyId: input.companyId,
                branchId: input.branchId,
                businessUnitId: input.businessUnitId,
                scopeType:
                  input.scopeType as typeof memberships.$inferInsert.scopeType,
                status: user.approvedAt ? "active" : "pending",
                isDefault: false,
              })
              .returning()
          )[0];
      await tx
        .delete(membershipRoles)
        .where(eq(membershipRoles.membershipId, membership.id));
      if (input.roleIds.length)
        await tx
          .insert(membershipRoles)
          .values(
            input.roleIds.map((roleId) => ({
              membershipId: membership.id,
              roleId,
            })),
          );
      await tx.insert(auditLogs).values({
        userId: actorId,
        holdingId: input.holdingId,
        companyId: input.companyId,
        membershipId: actorMembershipId,
        actorName: "System",
        action: existing
          ? "tenant.membership.delegated"
          : "tenant.membership.assigned",
        subjectType: "Membership",
        subjectId: membership.id,
        description: existing
          ? "Membership permissions delegated"
          : "Membership assigned",
        context: {
          actorUserId: actorId.toString(),
          recipientUserId: input.userId.toString(),
          delegatedAt: new Date().toISOString(),
          old: existing
            ? {
                status: existing.status,
                scopeType: existing.scopeType,
                branchId: existing.branchId?.toString() ?? null,
                businessUnitId: existing.businessUnitId?.toString() ?? null,
                roles: oldRoles.map((role) => ({
                  id: role.roleId.toString(),
                  key: role.key,
                  permissions: oldRoleGrants
                    .filter((grant) => grant.roleId === role.roleId)
                    .map((grant) => ({
                      key: grant.permission,
                      scopeType: grant.scopeType,
                      domain: grant.domain,
                    })),
                })),
              }
            : null,
          new: {
            status: membership.status,
            scopeType: membership.scopeType,
            branchId: membership.branchId?.toString() ?? null,
            businessUnitId: membership.businessUnitId?.toString() ?? null,
            isDefault: membership.isDefault,
            roles: input.roleSnapshot,
          },
        },
        ipAddress: null,
        userAgent: null,
        createdAt: new Date(),
      });
      return { membership };
    });
  }

  async revokeMembership(
    membershipId: bigint,
    actorId: bigint,
    holdingId: bigint,
    companyId: bigint,
    actorMembershipId: bigint,
  ) {
    return this.db.transaction(async (tx) => {
      const [membership] = await tx
        .select()
        .from(memberships)
        .where(
          and(
            eq(memberships.id, membershipId),
            eq(memberships.holdingId, holdingId),
            eq(memberships.companyId, companyId),
          ),
        )
        .for("update")
        .limit(1);
      if (!membership || membership.status === "revoked") return undefined;
      const rolesBefore = await tx
        .select({ id: roles.id, key: roles.key })
        .from(membershipRoles)
        .innerJoin(roles, eq(membershipRoles.roleId, roles.id))
        .where(eq(membershipRoles.membershipId, membershipId));
      const grantsBefore = rolesBefore.length
        ? await tx
            .select({
              roleId: rolePermissions.roleId,
              permission: permissions.key,
              scopeType: rolePermissions.scopeType,
              domain: rolePermissions.domain,
            })
            .from(rolePermissions)
            .innerJoin(
              permissions,
              eq(rolePermissions.permissionId, permissions.id),
            )
            .where(
              inArray(
                rolePermissions.roleId,
                rolesBefore.map((role) => role.id),
              ),
            )
        : [];
      const [updated] = await tx
        .update(memberships)
        .set({ status: "revoked", isDefault: false, updatedAt: new Date() })
        .where(eq(memberships.id, membershipId))
        .returning();
      await tx.insert(auditLogs).values({
        userId: actorId,
        holdingId,
        companyId,
        membershipId: actorMembershipId,
        actorName: "System",
        action: "tenant.membership.revoked",
        subjectType: "Membership",
        subjectId: membershipId,
        description: "Membership access revoked",
        context: {
          actorUserId: actorId.toString(),
          recipientUserId: membership.userId.toString(),
          revokedAt: new Date().toISOString(),
          old: {
            status: membership.status,
            scopeType: membership.scopeType,
            branchId: membership.branchId?.toString() ?? null,
            businessUnitId: membership.businessUnitId?.toString() ?? null,
            roles: rolesBefore.map((role) => ({
              id: role.id.toString(),
              key: role.key,
              permissions: grantsBefore
                .filter((grant) => grant.roleId === role.id)
                .map((grant) => ({
                  key: grant.permission,
                  scopeType: grant.scopeType,
                  domain: grant.domain,
                })),
            })),
          },
          new: {
            status: updated.status,
            scopeType: updated.scopeType,
            roles: [],
          },
        },
        ipAddress: null,
        userAgent: null,
        createdAt: new Date(),
      });
      return updated;
    });
  }
}
