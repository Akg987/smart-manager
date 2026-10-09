import { Inject, Injectable } from "@nestjs/common";
import { compare } from "bcryptjs";
import { and, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { BaseRepository } from "../../../common/repository/base.repository.js";
import {
  DRIZZLE_DB,
  type DrizzleDatabase,
} from "../../../database/database.token.js";
import {
  auditLogs,
  companies,
  holdings,
  invitations,
  membershipRoles,
  memberships,
  otpChallenges,
  passwordResetTokens,
  permissions,
  rolePermissions,
  roles,
  users,
  type OtpPurpose,
} from "../../../../../../src/db/schema.js";
import { invitationSnapshotAllowsCurrentGrants } from "../../tenant-admin/invitation-security.js";

@Injectable()
export class AuthRepository extends BaseRepository {
  constructor(@Inject(DRIZZLE_DB) db: DrizzleDatabase) {
    super(db);
  }

  async effectivePermissionGrants(context: {
    userId: string;
    holdingId: string;
    membershipId: string;
    roleIds: string[];
  }) {
    if (
      ![
        context.userId,
        context.holdingId,
        context.membershipId,
        ...context.roleIds,
      ].every((id) => /^\d+$/.test(id))
    )
      return [];
    const roleIds = context.roleIds.map((id) => BigInt(id));
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
    const assignedRoles = await this.db
      .select({ id: roles.id })
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
      );
    if (!assignedRoles.length) return [];
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
          inArray(
            rolePermissions.roleId,
            assignedRoles.map((role) => role.id),
          ),
          or(
            isNull(roles.holdingId),
            eq(roles.holdingId, BigInt(context.holdingId)),
          ),
        ),
      );
  }

  registerUser(
    values: typeof users.$inferInsert,
    invitationTokenHash?: string,
  ) {
    return this.db.transaction(async (tx) => {
      const [tenant] = await tx
        .select({ holdingId: holdings.id, companyId: companies.id })
        .from(holdings)
        .innerJoin(companies, eq(companies.holdingId, holdings.id))
        .where(
          and(
            eq(holdings.code, "holding-group"),
            eq(holdings.status, "active"),
            eq(companies.code, "smarlux"),
            eq(companies.status, "active"),
            isNull(companies.archivedAt),
          ),
        )
        .limit(1);
      if (!tenant) return { missingTenant: true as const };
      let invited: {
        invitation: typeof invitations.$inferSelect;
        role: typeof roles.$inferSelect;
      } | null = null;
      if (invitationTokenHash) {
        const [candidate] = await tx
          .select({
            invitation: invitations,
            role: roles,
            holdingStatus: holdings.status,
            companyStatus: companies.status,
          })
          .from(invitations)
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
              eq(invitations.tokenHash, invitationTokenHash),
              eq(invitations.mobile, values.mobile),
              isNull(invitations.acceptedAt),
              isNull(invitations.revokedAt),
              gt(invitations.expiresAt, new Date()),
              eq(holdings.status, "active"),
              eq(companies.status, "active"),
              isNull(companies.archivedAt),
              eq(roles.isSystem, false),
            ),
          )
          .for("update")
          .limit(1);
        if (
          !candidate ||
          candidate.holdingStatus !== "active" ||
          candidate.companyStatus !== "active" ||
          !candidate.invitation.companyId ||
          !candidate.invitation.roleId
        )
          return { invalidInvitation: true as const };
        const [audit] = await tx
          .select({ context: auditLogs.context })
          .from(auditLogs)
          .where(
            and(
              eq(auditLogs.action, "tenant.invitation.created"),
              eq(auditLogs.subjectType, "Invitation"),
              eq(auditLogs.subjectId, candidate.invitation.id),
            ),
          )
          .limit(1);
        const savedContext =
          audit?.context &&
          typeof audit.context === "object" &&
          !Array.isArray(audit.context)
            ? (audit.context as Record<string, unknown>)
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
        const current = await tx
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
          .where(eq(rolePermissions.roleId, candidate.role.id));
        if (
          !invitationSnapshotAllowsCurrentGrants(
            snapshot?.permissions,
            current.map((grant) => ({
              key: grant.key,
              scopeType: grant.scopeType ?? "company",
              domain: grant.domain,
            })),
          )
        )
          return { invalidInvitation: true as const };
        invited = { invitation: candidate.invitation, role: candidate.role };
      }
      let [legacyRole] = await tx
        .select({ id: roles.id })
        .from(roles)
        .where(
          and(
            eq(roles.holdingId, tenant.holdingId),
            eq(roles.key, "LEGACY_USER"),
            eq(roles.isSystem, false),
          ),
        )
        .limit(1);
      if (!legacyRole) {
        [legacyRole] = await tx
          .insert(roles)
          .values({
            holdingId: tenant.holdingId,
            key: "LEGACY_USER",
            name: "Legacy User",
            isSystem: false,
          })
          .returning({ id: roles.id });
      }
      const [user] = await tx.insert(users).values(values).returning();
      const [membership] = await tx
        .insert(memberships)
        .values({
          userId: user.id,
          holdingId: tenant.holdingId,
          companyId: tenant.companyId,
          scopeType: "company",
          status: user.approvedAt ? "active" : "pending",
          isDefault: true,
        })
        .returning();
      await tx
        .insert(membershipRoles)
        .values({ membershipId: membership.id, roleId: legacyRole.id });
      await tx.insert(auditLogs).values({
        userId: user.id,
        holdingId: tenant.holdingId,
        companyId: tenant.companyId,
        membershipId: membership.id,
        actorName: "System",
        action: "tenant.membership.registered",
        subjectType: "Membership",
        subjectId: membership.id,
        description: "Default company membership created for new registration",
        context: {
          recipientUserId: user.id.toString(),
          registeredAt: new Date().toISOString(),
          status: membership.status,
          scopeType: membership.scopeType,
          roleKey: "LEGACY_USER",
        },
        ipAddress: null,
        userAgent: null,
      });
      let invitationAccepted = false;
      if (invited) {
        const companyId = invited.invitation.companyId!;
        const roleId = invited.invitation.roleId!;
        const [existingMembership] = await tx
          .select()
          .from(memberships)
          .where(
            and(
              eq(memberships.userId, user.id),
              eq(memberships.holdingId, invited.invitation.holdingId),
              eq(memberships.companyId, companyId),
              isNull(memberships.branchId),
              isNull(memberships.businessUnitId),
            ),
          )
          .for("update")
          .limit(1);
        const targetMembership = existingMembership
          ? (
              await tx
                .update(memberships)
                .set({
                  scopeType: "company",
                  status: user.approvedAt ? "active" : "pending",
                  updatedAt: new Date(),
                })
                .where(eq(memberships.id, existingMembership.id))
                .returning()
            )[0]
          : (
              await tx
                .insert(memberships)
                .values({
                  userId: user.id,
                  holdingId: invited.invitation.holdingId,
                  companyId,
                  scopeType: "company",
                  status: user.approvedAt ? "active" : "pending",
                  isDefault: false,
                })
                .returning()
            )[0];
        await tx
          .insert(membershipRoles)
          .values({ membershipId: targetMembership.id, roleId })
          .onConflictDoNothing();
        const acceptedAt = new Date();
        const [accepted] = await tx
          .update(invitations)
          .set({ acceptedAt })
          .where(
            and(
              eq(invitations.id, invited.invitation.id),
              isNull(invitations.acceptedAt),
              isNull(invitations.revokedAt),
            ),
          )
          .returning();
        if (!accepted) return { invalidInvitation: true as const };
        await tx.insert(auditLogs).values({
          userId: user.id,
          holdingId: invited.invitation.holdingId,
          companyId,
          membershipId: targetMembership.id,
          actorName: "System",
          action: "tenant.invitation.accepted",
          subjectType: "Invitation",
          subjectId: invited.invitation.id,
          description: "Company invitation accepted during registration",
          context: {
            actorUserId: user.id.toString(),
            recipientUserId: user.id.toString(),
            recipientMobile: user.mobile,
            acceptedAt: acceptedAt.toISOString(),
            scope: {
              holdingId: invited.invitation.holdingId.toString(),
              companyId: companyId.toString(),
              scopeType: "company",
            },
            role: { id: invited.role.id.toString(), key: invited.role.key },
            membership: {
              id: targetMembership.id.toString(),
              status: targetMembership.status,
            },
          },
          ipAddress: null,
          userAgent: null,
        });
        invitationAccepted = true;
      }
      return { user, invitationAccepted };
    });
  }
  findUserByMobile(mobile: string) {
    return this.db
      .select()
      .from(users)
      .where(eq(users.mobile, mobile))
      .limit(1);
  }

  provisionFirstAdmin(mobile: string, passwordHash: string) {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(738201)`);
      const [existing] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.role, "admin"))
        .limit(1);
      if (existing) return undefined;
      const [admin] = await tx
        .insert(users)
        .values({
          mobile,
          password: passwordHash,
          role: "admin",
          approvedAt: new Date(),
        })
        .returning();
      return admin;
    });
  }

  createOtp(input: {
    purpose: OtpPurpose;
    identifier: string;
    codeHash: string;
    now: Date;
  }) {
    return this.db.transaction(async (tx) => {
      const lockKey = input.purpose + ":" + input.identifier;
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${lockKey}))`);
      const [existing] = await tx
        .select()
        .from(otpChallenges)
        .where(
          and(
            eq(otpChallenges.purpose, input.purpose),
            eq(otpChallenges.identifier, input.identifier),
          ),
        )
        .limit(1);
      if (existing && input.now.getTime() - existing.sentAt.getTime() < 60_000)
        return { tooSoon: true as const };
      const [row] = await tx
        .insert(otpChallenges)
        .values({
          purpose: input.purpose,
          identifier: input.identifier,
          codeHash: input.codeHash,
          attempts: 0,
          sentAt: input.now,
          expiresAt: new Date(input.now.getTime() + 5 * 60_000),
        })
        .onConflictDoUpdate({
          target: [otpChallenges.purpose, otpChallenges.identifier],
          set: {
            codeHash: input.codeHash,
            attempts: 0,
            sentAt: input.now,
            expiresAt: new Date(input.now.getTime() + 5 * 60_000),
          },
        })
        .returning();
      return { tooSoon: false as const, challenge: row };
    });
  }

  consumeOtp(purpose: OtpPurpose, identifier: string, code: string, now: Date) {
    return this.db.transaction(async (tx) => {
      const [challenge] = await tx
        .select()
        .from(otpChallenges)
        .where(
          and(
            eq(otpChallenges.purpose, purpose),
            eq(otpChallenges.identifier, identifier),
          ),
        )
        .for("update")
        .limit(1);
      if (!challenge) return false;
      if (challenge.expiresAt <= now || challenge.attempts >= 5) {
        await tx
          .delete(otpChallenges)
          .where(eq(otpChallenges.id, challenge.id));
        return false;
      }
      if (!(await compare(code, challenge.codeHash))) {
        await tx
          .update(otpChallenges)
          .set({ attempts: sql.raw('"attempts" + 1') })
          .where(eq(otpChallenges.id, challenge.id));
        return false;
      }
      await tx.delete(otpChallenges).where(eq(otpChallenges.id, challenge.id));
      return true;
    });
  }

  resetPassword(mobile: string, token: string, passwordHash: string) {
    return this.db.transaction(async (tx) => {
      const [reset] = await tx
        .select()
        .from(passwordResetTokens)
        .where(eq(passwordResetTokens.mobile, mobile))
        .limit(1);
      if (!reset || !(await compare(token, reset.token)))
        return { invalid: true as const };
      const [user] = await tx
        .update(users)
        .set({ password: passwordHash, updatedAt: new Date() })
        .where(eq(users.mobile, mobile))
        .returning();
      if (!user) return { missing: true as const };
      await tx
        .delete(passwordResetTokens)
        .where(eq(passwordResetTokens.mobile, mobile));
      return { user };
    });
  }

  resetPasswordWithOtp(
    mobile: string,
    code: string,
    passwordHash: string,
    now: Date,
  ) {
    return this.db.transaction(async (tx) => {
      const [challenge] = await tx
        .select()
        .from(otpChallenges)
        .where(
          and(
            eq(otpChallenges.purpose, "password-reset"),
            eq(otpChallenges.identifier, mobile),
          ),
        )
        .for("update")
        .limit(1);
      if (!challenge || challenge.expiresAt <= now || challenge.attempts >= 5)
        return { invalid: true as const };
      if (!(await compare(code, challenge.codeHash))) {
        await tx
          .update(otpChallenges)
          .set({ attempts: sql.raw('"attempts" + 1') })
          .where(eq(otpChallenges.id, challenge.id));
        return { invalid: true as const };
      }
      const [user] = await tx
        .update(users)
        .set({ password: passwordHash, updatedAt: new Date() })
        .where(eq(users.mobile, mobile))
        .returning();
      if (!user) return { missing: true as const };
      await tx.delete(otpChallenges).where(eq(otpChallenges.id, challenge.id));
      await tx
        .delete(passwordResetTokens)
        .where(eq(passwordResetTokens.mobile, mobile));
      return { user };
    });
  }
}
