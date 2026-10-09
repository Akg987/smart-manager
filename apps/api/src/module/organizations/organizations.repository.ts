import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { BaseRepository } from "../../common/repository/base.repository.js";
import {
  DRIZZLE_DB,
  type DrizzleDatabase,
} from "../../database/database.token.js";
import {
  auditLogs,
  businessUnits,
  departments,
  memberships,
} from "../../../../../src/db/schema.js";

@Injectable()
export class OrganizationsRepository extends BaseRepository {
  constructor(@Inject(DRIZZLE_DB) db: DrizzleDatabase) {
    super(db);
  }

  async managerBelongsToCompany(
    userId: bigint,
    holdingId: bigint,
    companyId: bigint,
  ) {
    const [membership] = await this.db
      .select({ id: memberships.id })
      .from(memberships)
      .where(
        and(
          eq(memberships.userId, userId),
          eq(memberships.holdingId, holdingId),
          eq(memberships.companyId, companyId),
          eq(memberships.status, "active"),
        ),
      )
      .limit(1);
    return Boolean(membership);
  }

  createDepartment(
    input: typeof departments.$inferInsert,
    actorId: bigint,
    tenant: { holdingId: bigint; companyId: bigint; membershipId: bigint },
  ) {
    return this.db.transaction(async (tx) => {
      const [department] = await tx
        .insert(departments)
        .values(input)
        .returning();
      await tx.insert(businessUnits).values({
        companyId: tenant.companyId,
        legacyDepartmentId: department.id,
        name: department.name,
        code: department.code,
        managerUserId: department.managerUserId,
        domain: "general",
      });
      await tx.insert(auditLogs).values({
        userId: actorId,
        holdingId: tenant.holdingId,
        companyId: tenant.companyId,
        membershipId: tenant.membershipId,
        actorName: "System",
        action: "organization.department.created",
        subjectType: "Department",
        subjectId: department.id,
        description: "Department created",
        context: null,
        ipAddress: null,
        userAgent: null,
      });
      return department;
    });
  }

  updateDepartment(
    id: bigint,
    values: Partial<typeof departments.$inferInsert>,
    actorId: bigint,
    tenant: { holdingId: bigint; companyId: bigint; membershipId: bigint },
  ) {
    return this.db.transaction(async (tx) => {
      const [scope] = await tx
        .select({ id: businessUnits.id })
        .from(businessUnits)
        .where(
          and(
            eq(businessUnits.legacyDepartmentId, id),
            eq(businessUnits.companyId, tenant.companyId),
            eq(businessUnits.status, "active"),
          ),
        )
        .limit(1);
      if (!scope) return undefined;
      const [department] = await tx
        .update(departments)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(departments.id, id))
        .returning();
      if (!department) return undefined;
      await tx
        .update(businessUnits)
        .set({
          ...(values.name === undefined ? {} : { name: values.name }),
          ...(values.code === undefined ? {} : { code: values.code }),
          ...(values.managerUserId === undefined
            ? {}
            : { managerUserId: values.managerUserId }),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(businessUnits.legacyDepartmentId, id),
            eq(businessUnits.companyId, tenant.companyId),
          ),
        );
      await tx.insert(auditLogs).values({
        userId: actorId,
        holdingId: tenant.holdingId,
        companyId: tenant.companyId,
        membershipId: tenant.membershipId,
        actorName: "System",
        action: "organization.department.updated",
        subjectType: "Department",
        subjectId: id,
        description: "Department updated",
        context: null,
        ipAddress: null,
        userAgent: null,
      });
      return department;
    });
  }
}
