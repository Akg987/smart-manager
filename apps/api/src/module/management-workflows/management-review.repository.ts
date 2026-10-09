import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, desc, eq, isNull } from "drizzle-orm";
import {
  auditLogs,
  businessUnits,
  managementReviewMeetings,
  type JsonValue,
} from "../../../../../src/db/schema.js";
import { BaseRepository } from "../../common/repository/base.repository.js";
import {
  DRIZZLE_DB,
  type DrizzleDatabase,
} from "../../database/database.token.js";
import { normalizeJalaliPeriod } from "../../shared/jalali.js";
import { AuthorizationService } from "../authorization/authorization.service.js";
import { CorrectiveActionsService } from "../corrective-actions/corrective-actions.service.js";
import { DecisionsService } from "../decisions/decisions.service.js";
import { KpiManagementService } from "../kpi-management/kpi-management.service.js";

const safe = <T>(value: T): T =>
  JSON.parse(
    JSON.stringify(value, (_key, item) =>
      typeof item === "bigint" ? item.toString() : item,
    ),
  ) as T;
const has = (container: object | null, key: string) =>
  !!container && Object.prototype.hasOwnProperty.call(container, key);

@Injectable()
export class ManagementReviewRepository extends BaseRepository {
  constructor(
    @Inject(DRIZZLE_DB) db: DrizzleDatabase,
    private readonly authorization: AuthorizationService,
    private readonly kpis: KpiManagementService,
    private readonly actions: CorrectiveActionsService,
    private readonly decisions: DecisionsService,
  ) {
    super(db);
  }

  async list(actorId: bigint, type?: "wbr" | "mbr", period?: string) {
    const { context, companyId } = await this.scope(actorId, "meeting.view");
    const normalized = period ? this.period(type ?? "wbr", period) : undefined;
    const rows = await this.db
      .select()
      .from(managementReviewMeetings)
      .where(
        and(
          eq(managementReviewMeetings.companyId, companyId),
          type ? eq(managementReviewMeetings.type, type) : undefined,
          normalized
            ? eq(managementReviewMeetings.period, normalized)
            : undefined,
          context.businessUnitId
            ? eq(
                managementReviewMeetings.businessUnitId,
                BigInt(context.businessUnitId),
              )
            : undefined,
        ),
      )
      .orderBy(
        desc(managementReviewMeetings.period),
        desc(managementReviewMeetings.createdAt),
      )
      .limit(200);
    const allowed = [];
    for (const row of rows)
      if (
        await this.authorization.can(
          context,
          "meeting.view",
          this.resource(row),
        )
      )
        allowed.push(row);
    return safe(allowed);
  }

  templates() {
    return {
      wbr: [
        "scorecard",
        "kpi_red",
        "missing_data",
        "critical_red_flags",
        "overdue_actions",
        "open_decisions",
        "needs_decision",
        "next_commitments",
      ],
      mbr: [
        "scorecard",
        "kpi_red",
        "missing_data",
        "critical_red_flags",
        "overdue_actions",
        "open_decisions",
        "needs_decision",
        "next_commitments",
      ],
    };
  }

  async create(
    actorId: bigint,
    input: {
      type: "wbr" | "mbr";
      period: string;
      title: string;
      businessUnitId?: bigint;
      scheduledAt?: string;
      sections?: Record<string, unknown>;
    },
  ) {
    const period = this.period(input.type, input.period);
    const { context, holdingId, companyId } = await this.scope(
      actorId,
      "meeting.create",
      input.businessUnitId,
    );
    const businessUnitId =
      input.businessUnitId ??
      (context.businessUnitId ? BigInt(context.businessUnitId) : null);
    if (businessUnitId) {
      const [unit] = await this.db
        .select({ id: businessUnits.id })
        .from(businessUnits)
        .where(
          and(
            eq(businessUnits.id, businessUnitId),
            eq(businessUnits.companyId, companyId),
            eq(businessUnits.status, "active"),
          ),
        )
        .limit(1);
      if (!unit)
        throw new BadRequestException(
          "The selected Business Unit is not available in the active Company.",
        );
    }
    const existing = await this.db
      .select({ id: managementReviewMeetings.id })
      .from(managementReviewMeetings)
      .where(
        and(
          eq(managementReviewMeetings.companyId, companyId),
          eq(managementReviewMeetings.type, input.type),
          eq(managementReviewMeetings.period, period),
          businessUnitId
            ? eq(managementReviewMeetings.businessUnitId, businessUnitId)
            : isNull(managementReviewMeetings.businessUnitId),
        ),
      )
      .limit(1);
    if (existing.length)
      throw new BadRequestException(
        "A review already exists for this company, scope, and period.",
      );
    const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
    if (scheduledAt && !Number.isFinite(scheduledAt.valueOf()))
      throw new BadRequestException("A valid review meeting date is required.");
    const [row] = await this.db
      .insert(managementReviewMeetings)
      .values({
        holdingId,
        companyId,
        businessUnitId,
        type: input.type,
        period,
        title: input.title.trim(),
        status: "draft",
        scheduledAt,
        ownerUserId: actorId,
        sections: (input.sections ?? {}) as JsonValue,
        snapshot: {},
        createdBy: actorId,
      })
      .returning();
    await this.audit(actorId, row, "meeting.review.created", {
      period,
      type: row.type,
    });
    return safe(row);
  }

  async update(
    actorId: bigint,
    id: bigint,
    input: {
      title?: string;
      scheduledAt?: string | null;
      sections?: Record<string, unknown>;
    },
  ) {
    const row = await this.findAuthorized(actorId, id, "meeting.update");
    if (row.status !== "draft")
      throw new BadRequestException("Only draft reviews can be changed.");
    const scheduledAt =
      input.scheduledAt === undefined
        ? row.scheduledAt
        : input.scheduledAt === null
          ? null
          : new Date(input.scheduledAt);
    if (scheduledAt && !Number.isFinite(scheduledAt.valueOf()))
      throw new BadRequestException("A valid review meeting date is required.");
    const [updated] = await this.db
      .update(managementReviewMeetings)
      .set({
        title: input.title?.trim().slice(0, 200) ?? row.title,
        scheduledAt,
        sections: (input.sections ?? row.sections) as JsonValue,
        version: row.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(managementReviewMeetings.id, id))
      .returning();
    await this.audit(actorId, updated, "meeting.review.updated", {
      version: updated.version,
    });
    return safe(updated);
  }

  async publish(actorId: bigint, id: bigint) {
    const row = await this.findAuthorized(actorId, id, "meeting.update");
    if (
      !(await this.authorization.can(
        this.authorization.currentContext(actorId),
        "report.view",
        this.resource(row),
      ))
    )
      throw new ForbiddenException(
        "Report view permission is required to publish a management review.",
      );
    if (row.status !== "draft")
      throw new BadRequestException("Only draft reviews can be published.");
    const snapshot = await this.buildSnapshot(actorId, row);
    const [updated] = await this.db
      .update(managementReviewMeetings)
      .set({
        status: "published",
        snapshot: snapshot as JsonValue,
        version: row.version + 1,
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(managementReviewMeetings.id, id))
      .returning();
    await this.audit(actorId, updated, "meeting.review.published", {
      version: updated.version,
      sections: Object.keys(snapshot),
    });
    return safe(updated);
  }

  async close(actorId: bigint, id: bigint, closureSummary: string) {
    const row = await this.findAuthorized(actorId, id, "meeting.close");
    if (row.status !== "published")
      throw new BadRequestException("Only published reviews can be closed.");
    if (!closureSummary.trim())
      throw new BadRequestException("A closure summary is required.");
    const previous =
      row.sections &&
      typeof row.sections === "object" &&
      !Array.isArray(row.sections)
        ? row.sections
        : {};
    const [updated] = await this.db
      .update(managementReviewMeetings)
      .set({
        status: "closed",
        sections: {
          ...previous,
          closureSummary: closureSummary.trim().slice(0, 3000),
        } as JsonValue,
        version: row.version + 1,
        closedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(managementReviewMeetings.id, id))
      .returning();
    await this.audit(actorId, updated, "meeting.review.closed", {
      version: updated.version,
    });
    return safe(updated);
  }

  async export(actorId: bigint, id: bigint) {
    const row = await this.findAuthorized(actorId, id, "report.export");
    if (row.status === "draft")
      throw new BadRequestException("Draft reviews cannot be exported.");
    return safe(row);
  }

  private async buildSnapshot(
    actorId: bigint,
    row: typeof managementReviewMeetings.$inferSelect,
  ) {
    const scope = this.resource(row);
    const canKpi = await this.authorization.can(
      this.authorization.currentContext(actorId),
      "kpi.view",
      scope,
    );
    const canRedFlag = await this.authorization.can(
      this.authorization.currentContext(actorId),
      "redflag.view",
      scope,
    );
    const canAction = await this.authorization.can(
      this.authorization.currentContext(actorId),
      "action.view",
      scope,
    );
    const canDecision = await this.authorization.can(
      this.authorization.currentContext(actorId),
      "decision.view",
      scope,
    );
    const [kpiSummary, flags, actionBoard, decisions] = await Promise.all([
      canKpi ? this.kpis.dashboardSnapshot(actorId) : Promise.resolve(null),
      canRedFlag ? this.kpis.redFlagBoard(actorId) : Promise.resolve([]),
      canAction
        ? this.actions.actionBoard(actorId)
        : Promise.resolve({ rows: [] }),
      canDecision ? this.decisions.list(actorId) : Promise.resolve([]),
    ]);
    const criticalFlags = (flags as Record<string, unknown>[]).filter(
      (flag) =>
        ["critical", "urgent"].includes(String(flag.severity)) &&
        !["resolved", "closed"].includes(String(flag.status)),
    );
    const actionColumns = Object.values(actionBoard as Record<string, unknown>)
      .filter(Array.isArray)
      .flat() as Record<string, unknown>[];
    const overdueActions = actionColumns.filter(
      (action) => action.overdue === true,
    );
    const openDecisions = (decisions as Record<string, unknown>[]).filter(
      (decision) =>
        !["closed", "cancelled", "rejected"].includes(String(decision.status)),
    );
    const selected =
      row.sections &&
      typeof row.sections === "object" &&
      !Array.isArray(row.sections)
        ? row.sections
        : {};
    const snapshot: Record<string, unknown> = {};
    if (canKpi) snapshot.scorecard = kpiSummary;
    if (canKpi)
      snapshot.kpiRed =
        (kpiSummary as Record<string, unknown> | null)?.red ?? 0;
    if (canKpi)
      snapshot.missingData =
        (kpiSummary as Record<string, unknown> | null)?.missingCount ?? 0;
    if (canRedFlag)
      snapshot.criticalRedFlags = criticalFlags.map((flag) => ({
        id: flag.id,
        description: flag.description,
        suspectedCause: flag.suspectedCause,
        ownerUserId: flag.ownerUserId,
        deadline: flag.deadline,
        actionId: flag.actionId,
        requiredIntervention:
          flag.status === "new" ? "assign_owner" : "review_progress",
      }));
    if (canAction)
      snapshot.overdueActions = overdueActions.map((action) => ({
        id: action.id,
        title: action.title,
        ownerUserId: action.ownerUserId,
        dueAt: action.dueAt,
        delayReason: action.delayReason,
      }));
    if (canDecision)
      snapshot.openDecisions = openDecisions.map((decision) => ({
        id: decision.id,
        decisionText: decision.decisionText,
        ownerUserId: decision.ownerUserId,
        deadline: decision.deadline,
        status: decision.status,
      }));
    if (has(selected, "needsDecision"))
      snapshot.needsDecision = selected.needsDecision;
    if (has(selected, "nextCommitments"))
      snapshot.nextCommitments = selected.nextCommitments;
    snapshot.generatedAt = new Date().toISOString();
    snapshot.period = row.period;
    return snapshot;
  }

  private async findAuthorized(
    actorId: bigint,
    id: bigint,
    permission: string,
  ) {
    const [row] = await this.db
      .select()
      .from(managementReviewMeetings)
      .where(eq(managementReviewMeetings.id, id))
      .limit(1);
    if (!row) throw new NotFoundException("Management review not found.");
    const context = this.authorization.currentContext(actorId);
    if (
      !context ||
      !(await this.authorization.can(context, permission, this.resource(row)))
    )
      throw new ForbiddenException(
        `Permission ${permission} is required for this review.`,
      );
    return row;
  }

  private async scope(
    actorId: bigint,
    permission: string,
    businessUnitId?: bigint | null,
  ) {
    const context = this.authorization.currentContext(actorId);
    if (!context?.companyId || !context.membershipId)
      throw new ForbiddenException("An active company membership is required.");
    const selectedUnit =
      businessUnitId ??
      (context.businessUnitId ? BigInt(context.businessUnitId) : null);
    const resource = {
      holdingId: context.holdingId,
      companyId: context.companyId,
      branchId: context.branchId,
      businessUnitId: selectedUnit?.toString() ?? null,
    };
    if (!(await this.authorization.can(context, permission, resource)))
      throw new ForbiddenException(
        `Permission ${permission} is required for this scope.`,
      );
    return {
      context,
      holdingId: BigInt(context.holdingId),
      companyId: BigInt(context.companyId),
    };
  }

  private resource(row: {
    holdingId: bigint;
    companyId: bigint;
    businessUnitId: bigint | null;
  }) {
    return {
      holdingId: row.holdingId.toString(),
      companyId: row.companyId.toString(),
      businessUnitId: row.businessUnitId?.toString() ?? null,
    };
  }

  private period(type: "wbr" | "mbr", value: string) {
    if (type === "wbr") {
      const normalized = normalizeJalaliPeriod(value);
      if (!normalized)
        throw new BadRequestException(
          "A WBR period must be a valid Jalali week.",
        );
      return normalized;
    }
    const match = /^((?:1[3-5][0-9]{2}|1600))-(0[1-9]|1[0-2])$/.exec(
      value.trim(),
    );
    if (!match)
      throw new BadRequestException(
        "An MBR period must use the Jalali YYYY-MM format.",
      );
    return `${match[1]}-${match[2]}`;
  }

  private audit(
    actorId: bigint,
    row: typeof managementReviewMeetings.$inferSelect,
    action: string,
    detail: Record<string, unknown>,
  ) {
    const context = this.authorization.currentContext(actorId);
    return this.db.insert(auditLogs).values({
      userId: actorId,
      holdingId: row.holdingId,
      companyId: row.companyId,
      membershipId: context?.membershipId ? BigInt(context.membershipId) : null,
      actorName: "System",
      action,
      subjectType: "ManagementReviewMeeting",
      subjectId: row.id,
      description: action.replaceAll(".", " "),
      context: {
        reviewId: row.id.toString(),
        type: row.type,
        period: row.period,
        ...detail,
      },
      ipAddress: null,
      userAgent: null,
    });
  }
}
