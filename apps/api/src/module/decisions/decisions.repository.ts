import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import { BaseRepository } from "../../common/repository/base.repository.js";
import { AuthorizationService } from "../authorization/authorization.service.js";
import { normalizeJalaliPeriod } from "../../shared/jalali.js";
import {
  auditLogs,
  businessUnits,
  companies,
  correctiveActions,
  kpiManagementKpis,
  managementDecisionActions,
  managementDecisions,
  memberships,
} from "../../../../../src/db/schema.js";
import {
  DRIZZLE_DB,
  type DrizzleDatabase,
} from "../../database/database.token.js";
import {
  canApproveDecision,
  canTransitionDecision,
  type DecisionStatus,
} from "./decision-workflow.js";

@Injectable()
export class DecisionsRepository extends BaseRepository {
  constructor(
    @Inject(DRIZZLE_DB) db: DrizzleDatabase,
    private readonly authorization: AuthorizationService,
  ) {
    super(db);
  }

  private async scopeFor(actorId: bigint, businessUnitId?: bigint | null) {
    const context = this.authorization.currentContext(actorId);
    if (!context?.companyId || !context.membershipId)
      throw new ForbiddenException("An active company membership is required.");
    const unitId =
      businessUnitId ??
      (context.businessUnitId ? BigInt(context.businessUnitId) : null);
    let branchId = context.branchId;
    if (unitId) {
      const [unit] = await this.db
        .select({
          id: businessUnits.id,
          branchId: businessUnits.branchId,
          companyId: businessUnits.companyId,
        })
        .from(businessUnits)
        .where(
          and(
            eq(businessUnits.id, unitId),
            eq(businessUnits.companyId, BigInt(context.companyId)),
            eq(businessUnits.status, "active"),
          ),
        )
        .limit(1);
      if (!unit)
        throw new BadRequestException(
          "Business Unit is not available in the active Company.",
        );
      branchId = unit.branchId?.toString() ?? null;
    }
    return {
      context,
      resource: {
        holdingId: context.holdingId,
        companyId: context.companyId,
        branchId,
        businessUnitId: unitId?.toString() ?? null,
      },
      values: {
        holdingId: BigInt(context.holdingId),
        companyId: BigInt(context.companyId),
        branchId: branchId ? BigInt(branchId) : null,
        businessUnitId: unitId,
      },
    };
  }

  async list(actorId: bigint) {
    const context = this.authorization.currentContext(actorId);
    if (
      !context ||
      !(await this.authorization.can(context, "decision.view", {
        holdingId: context.holdingId,
        companyId: context.companyId,
        branchId: context.branchId,
        businessUnitId: context.businessUnitId,
      }))
    )
      throw new ForbiddenException("Decision view permission is required.");
    const rows = await this.db
      .select()
      .from(managementDecisions)
      .where(
        context.companyId
          ? eq(managementDecisions.companyId, BigInt(context.companyId))
          : eq(managementDecisions.holdingId, BigInt(context.holdingId)),
      )
      .orderBy(desc(managementDecisions.createdAt))
      .limit(500);
    return (
      await Promise.all(
        rows.map(async (row) =>
          (await this.authorization.can(context, "decision.view", {
            holdingId: row.holdingId.toString(),
            companyId: row.companyId.toString(),
            branchId: row.branchId?.toString() ?? null,
            businessUnitId: row.businessUnitId?.toString() ?? null,
            ownerId: row.ownerUserId?.toString() ?? null,
          }))
            ? row
            : null,
        ),
      )
    ).filter((row): row is (typeof rows)[number] => row !== null);
  }

  async create(
    actorId: bigint,
    input: {
      businessUnitId?: bigint;
      period?: string;
      sourceMeeting?: string;
      decisionText: string;
      ownerUserId?: bigint | null;
      deadline: string;
      relatedKpiIds?: bigint[];
      actionIds?: bigint[];
    },
  ) {
    const period = input.period ? normalizeJalaliPeriod(input.period) : null;
    if (input.period && !period)
      throw new BadRequestException("Invalid Jalali reporting period.");
    const { context, resource, values } = await this.scopeFor(
      actorId,
      input.businessUnitId,
    );
    if (!(await this.authorization.can(context, "decision.create", resource)))
      throw new ForbiddenException(
        "Decision creation permission is required for this scope.",
      );
    const deadline = new Date(input.deadline);
    if (!Number.isFinite(deadline.valueOf()))
      throw new BadRequestException("A valid decision deadline is required.");
    if (input.ownerUserId) {
      const [owner] = await this.db
        .select({
          id: memberships.id,
          businessUnitId: memberships.businessUnitId,
        })
        .from(memberships)
        .where(
          and(
            eq(memberships.userId, input.ownerUserId),
            eq(memberships.companyId, values.companyId),
            eq(memberships.status, "active"),
          ),
        )
        .limit(1);
      if (!owner)
        throw new BadRequestException(
          "Decision owner must be an active member of the same Company.",
        );
      if (
        values.businessUnitId &&
        owner.businessUnitId &&
        owner.businessUnitId !== values.businessUnitId
      )
        throw new BadRequestException(
          "Decision owner belongs to another Business Unit.",
        );
    }
    for (const kpiId of input.relatedKpiIds ?? []) {
      const [kpi] = await this.db
        .select({
          companyId: kpiManagementKpis.companyId,
          businessUnitId: kpiManagementKpis.businessUnitId,
        })
        .from(kpiManagementKpis)
        .where(eq(kpiManagementKpis.id, kpiId))
        .limit(1);
      if (
        !kpi ||
        kpi.companyId !== values.companyId ||
        (values.businessUnitId &&
          kpi.businessUnitId &&
          kpi.businessUnitId !== values.businessUnitId) ||
        !(await this.authorization.canAccessKpi(actorId, kpiId, "kpi.view"))
      )
        throw new BadRequestException(
          "A linked KPI is outside the decision scope.",
        );
    }
    for (const actionId of input.actionIds ?? []) {
      const [actionScope] = await this.db
        .select({ companyId: companies.id, businessUnitId: businessUnits.id })
        .from(correctiveActions)
        .innerJoin(
          businessUnits,
          eq(businessUnits.legacyDepartmentId, correctiveActions.departmentId),
        )
        .innerJoin(companies, eq(companies.id, businessUnits.companyId))
        .where(eq(correctiveActions.id, actionId))
        .limit(1);
      if (
        !actionScope ||
        actionScope.companyId !== values.companyId ||
        (values.businessUnitId &&
          actionScope.businessUnitId !== values.businessUnitId) ||
        !(await this.authorization.canAccessAction(
          actorId,
          actionId,
          "action.view",
        ))
      )
        throw new BadRequestException(
          "A linked Action is outside the decision scope.",
        );
    }
    const [decision] = await this.db
      .insert(managementDecisions)
      .values({
        ...values,
        period,
        sourceMeeting: input.sourceMeeting?.trim() || null,
        decisionText: input.decisionText.trim(),
        ownerUserId: input.ownerUserId ?? null,
        deadline: deadline.toISOString().slice(0, 10),
        status: "draft",
        relatedKpiIds: (input.relatedKpiIds ?? []).map(String),
        actionIds: (input.actionIds ?? []).map(String),
        createdBy: actorId,
      })
      .returning();
    if (input.actionIds?.length)
      await this.db
        .insert(managementDecisionActions)
        .values(
          input.actionIds.map((actionId) => ({
            decisionId: decision.id,
            actionId,
            createdBy: actorId,
          })),
        )
        .onConflictDoNothing();
    await this.audit(
      actorId,
      context.membershipId,
      decision,
      "decision.created",
      {
        period,
        ownerUserId: decision.ownerUserId?.toString() ?? null,
        deadline: decision.deadline,
      },
    );
    return decision;
  }

  async approve(actorId: bigint, decisionId: bigint) {
    const [decision] = await this.db
      .select()
      .from(managementDecisions)
      .where(eq(managementDecisions.id, decisionId))
      .limit(1);
    if (!decision) throw new NotFoundException("Decision not found.");
    const context = this.authorization.currentContext(actorId);
    const resource = {
      holdingId: decision.holdingId.toString(),
      companyId: decision.companyId.toString(),
      branchId: decision.branchId?.toString() ?? null,
      businessUnitId: decision.businessUnitId?.toString() ?? null,
    };
    if (
      !context ||
      !(await this.authorization.can(context, "decision.approve", resource))
    )
      throw new ForbiddenException("Decision approval permission is required.");
    if (
      !canApproveDecision({
        status: decision.status as DecisionStatus,
        createdBy: decision.createdBy,
        actorId,
      })
    ) {
      if (decision.createdBy === actorId)
        throw new ForbiddenException(
          "Decision authors cannot approve their own decision.",
        );
      throw new BadRequestException("Only pending decisions can be approved.");
    }
    const [updated] = await this.db
      .update(managementDecisions)
      .set({
        status: "approved",
        approvedBy: actorId,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(managementDecisions.id, decision.id))
      .returning();
    await this.audit(
      actorId,
      context.membershipId,
      decision,
      "decision.approved",
      { approvedBy: actorId.toString() },
    );
    return updated;
  }

  async updateOutcome(
    actorId: bigint,
    decisionId: bigint,
    input: {
      status: Exclude<
        DecisionStatus,
        "draft" | "pending_approval" | "approved"
      >;
      outcome?: string;
      closureEvidence?: string;
    },
  ) {
    const [decision] = await this.db
      .select()
      .from(managementDecisions)
      .where(eq(managementDecisions.id, decisionId))
      .limit(1);
    if (!decision) throw new NotFoundException("Decision not found.");
    const context = this.authorization.currentContext(actorId);
    const resource = {
      holdingId: decision.holdingId.toString(),
      companyId: decision.companyId.toString(),
      branchId: decision.branchId?.toString() ?? null,
      businessUnitId: decision.businessUnitId?.toString() ?? null,
    };
    if (
      !context ||
      !(await this.authorization.can(context, "decision.approve", resource))
    )
      throw new ForbiddenException(
        "Decision management permission is required.",
      );
    if (!canTransitionDecision(decision.status as DecisionStatus, input.status))
      throw new BadRequestException("Invalid decision status transition.");
    if (input.status === "closed" && !input.closureEvidence?.trim())
      throw new BadRequestException("Decision closure requires evidence.");
    const now = new Date();
    const [updated] = await this.db
      .update(managementDecisions)
      .set({
        status: input.status,
        outcome: input.outcome?.trim().slice(0, 5000) ?? decision.outcome,
        closureEvidence:
          input.closureEvidence?.trim().slice(0, 2000) ??
          decision.closureEvidence,
        closedAt: input.status === "closed" ? now : decision.closedAt,
        updatedAt: now,
      })
      .where(eq(managementDecisions.id, decision.id))
      .returning();
    await this.audit(
      actorId,
      context.membershipId,
      decision,
      `decision.${input.status}`,
      {
        outcome: input.outcome ?? null,
        closureEvidence: input.closureEvidence ?? null,
      },
    );
    return updated;
  }

  private audit(
    actorId: bigint,
    membershipId: string,
    decision: typeof managementDecisions.$inferSelect,
    action: string,
    context: Record<string, unknown>,
  ) {
    return this.db.insert(auditLogs).values({
      userId: actorId,
      holdingId: decision.holdingId,
      companyId: decision.companyId,
      membershipId: BigInt(membershipId),
      actorName: "System",
      action,
      subjectType: "ManagementDecision",
      subjectId: decision.id,
      description: action.replaceAll(".", " "),
      context: { decisionId: decision.id.toString(), ...context },
      ipAddress: null,
      userAgent: null,
    });
  }
}
