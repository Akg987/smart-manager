import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { BaseRepository } from "../../common/repository/base.repository.js";
import {
  and,
  asc,
  between,
  count,
  desc,
  eq,
  inArray,
  max,
  ne,
  or,
  sql,
} from "drizzle-orm";
import {
  DRIZZLE_DB,
  type DrizzleDatabase,
} from "../../database/database.token.js";
import { AuthorizationService } from "../authorization/authorization.service.js";
import { canTransitionAction } from "./action-workflow.js";
import { jalaliDateToGregorian } from "../../shared/jalali.js";
import {
  actionPriorities,
  auditLogs,
  correctiveActions,
  correctiveActionEvidence,
  correctiveAlerts,
  departments,
  inboxNotifications,
  kpiManagementKpis,
  users,
  type ActionStatus,
  type AlertSeverity,
} from "../../../../../src/db/schema.js";

@Injectable()
export class CorrectiveActionsRepository extends BaseRepository {
  static band(
    severity: AlertSeverity | string,
  ): "critical" | "red" | "yellow" | "other" {
    if (severity === "urgent") return "critical";
    if (severity === "high") return "red";
    if (severity === "medium") return "yellow";
    return "other";
  }

  constructor(
    @Inject(DRIZZLE_DB) db: DrizzleDatabase,
    private readonly authorization: AuthorizationService,
  ) {
    super(db);
  }

  async dashboardSnapshot(actorId: bigint, now = new Date()) {
    const [viewer] = await this.db
      .select({
        departmentId: users.departmentId,
        approvedAt: users.approvedAt,
      })
      .from(users)
      .where(eq(users.id, actorId))
      .limit(1);
    if (!viewer?.approvedAt) return null;
    const alertDepartments = await this.authorization.departmentsForPermission(
      actorId,
      "alerts.view",
    );
    const departmentScope = alertDepartments.length
      ? inArray(correctiveAlerts.departmentId, alertDepartments)
      : sql`false`;
    const alertRows = await this.db
      .select()
      .from(correctiveAlerts)
      .where(and(ne(correctiveAlerts.status, "resolved"), departmentScope))
      .orderBy(
        sql`case when ${correctiveAlerts.severity} in ('urgent', 'high') then 0 else 1 end`,
        desc(correctiveAlerts.id),
      );
    const canManage = await this.authorization.hasPermission(
      actorId,
      "actions.manage",
    );
    const canView = await this.authorization.hasPermission(
      actorId,
      "actions.view",
    );
    const [actionViewDepartments, actionManageDepartments] = await Promise.all([
      this.authorization.departmentsForPermission(actorId, "actions.view"),
      this.authorization.departmentsForPermission(actorId, "actions.manage"),
    ]);
    const actionDepartments = [
      ...new Set([...actionViewDepartments, ...actionManageDepartments]),
    ];
    const actionScope = actionDepartments.length
      ? inArray(correctiveActions.departmentId, actionDepartments)
      : eq(correctiveActions.ownerUserId, actorId);
    const openRows = await this.db
      .select({
        action: correctiveActions,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(correctiveActions)
      .leftJoin(users, eq(correctiveActions.ownerUserId, users.id))
      .where(
        and(
          ne(correctiveActions.status, "done"),
          canView || canManage
            ? actionScope
            : eq(correctiveActions.ownerUserId, actorId),
        ),
      )
      .orderBy(asc(correctiveActions.dueAt), desc(correctiveActions.id));
    const critical = alertRows.filter(
      (alert) => alert.severity === "urgent" || alert.severity === "high",
    ).length;
    const overdue = openRows.filter(
      ({ action }) => action.dueAt !== null && action.dueAt < now,
    ).length;
    const severityLabel = {
      low: "کم",
      medium: "متوسط",
      high: "زیاد",
      urgent: "فوری",
    } as const;
    const fa = (value: number) =>
      String(value).replace(/[0-9]/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
    return {
      openAlerts: alertRows.length,
      openAlertsLabel: fa(alertRows.length),
      critical,
      overdue,
      overdueLabel: fa(overdue),
      priorities: alertRows.slice(0, 3).map((alert) => ({
        id: alert.id,
        title: alert.title,
        description: alert.description?.trim() || "نیازمند تصمیم مدیر",
        severity: alert.severity,
        severityLabel: severityLabel[alert.severity] ?? alert.severity,
        tone:
          alert.severity === "urgent" || alert.severity === "high"
            ? "is-high"
            : "",
      })),
      teamActions: openRows
        .slice(0, 5)
        .map(({ action, firstName, lastName }) => ({
          id: action.id,
          title: action.title,
          owner:
            [firstName, lastName].filter(Boolean).join(" ") || "تعیین نشده",
          dueAt: action.dueAt
            ? new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
                timeZone: "Asia/Tehran",
                day: "numeric",
                month: "long",
                year: "numeric",
              }).format(action.dueAt)
            : "بدون موعد",
          overdue: action.dueAt !== null && action.dueAt < now,
        })),
    };
  }

  async weeklySnapshot(actorId: bigint, from: Date, to: Date) {
    const [viewer] = await this.db
      .select({
        departmentId: users.departmentId,
        approvedAt: users.approvedAt,
      })
      .from(users)
      .where(eq(users.id, actorId))
      .limit(1);
    if (!viewer?.approvedAt) return null;
    const [
      alertDepartmentIds,
      actionViewDepartmentIds,
      actionManageDepartmentIds,
    ] = await Promise.all([
      this.authorization.departmentsForPermission(actorId, "alerts.view"),
      this.authorization.departmentsForPermission(actorId, "actions.view"),
      this.authorization.departmentsForPermission(actorId, "actions.manage"),
    ]);
    const canViewAlerts = await this.authorization.hasPermission(
      actorId,
      "alerts.view",
    );
    const canViewActions = await this.authorization.hasPermission(
      actorId,
      "actions.view",
    );
    const canManageActions = await this.authorization.hasPermission(
      actorId,
      "actions.manage",
    );
    const alertScope = alertDepartmentIds.length
      ? inArray(correctiveAlerts.departmentId, alertDepartmentIds)
      : sql`false`;
    const priorities = canViewAlerts
      ? await this.db
          .select()
          .from(correctiveAlerts)
          .where(and(ne(correctiveAlerts.status, "resolved"), alertScope))
          .orderBy(
            sql`case when ${correctiveAlerts.severity} in ('urgent', 'high') then 0 else 1 end`,
            desc(correctiveAlerts.id),
          )
          .limit(3)
      : [];
    const actionDepartmentIds = [
      ...new Set([...actionViewDepartmentIds, ...actionManageDepartmentIds]),
    ];
    const actionScope = actionDepartmentIds.length
      ? inArray(correctiveActions.departmentId, actionDepartmentIds)
      : eq(correctiveActions.ownerUserId, actorId);
    const nextActions =
      canViewActions || canManageActions
        ? await this.db
            .select({
              action: correctiveActions,
              firstName: users.firstName,
              lastName: users.lastName,
            })
            .from(correctiveActions)
            .leftJoin(users, eq(correctiveActions.ownerUserId, users.id))
            .where(and(ne(correctiveActions.status, "done"), actionScope))
            .orderBy(asc(correctiveActions.dueAt), desc(correctiveActions.id))
            .limit(3)
        : [];
    const [resolved] = await this.db
      .select({ value: count() })
      .from(correctiveAlerts)
      .where(
        and(
          eq(correctiveAlerts.status, "resolved"),
          between(correctiveAlerts.resolvedAt, from, to),
          alertScope,
        ),
      );
    const [completed] = await this.db
      .select({ value: count() })
      .from(correctiveActions)
      .where(
        and(
          eq(correctiveActions.status, "done"),
          between(correctiveActions.updatedAt, from, to),
          canManageActions
            ? actionScope
            : eq(correctiveActions.ownerUserId, actorId),
        ),
      );
    return {
      priorities: priorities.map((alert) => ({
        id: alert.id.toString(),
        title: alert.title,
      })),
      nextActions: nextActions.map(({ action, firstName, lastName }) => ({
        id: action.id.toString(),
        title: action.title,
        owner: [firstName, lastName].filter(Boolean).join(" ") || "تعیین نشده",
      })),
      resolvedAlerts: Number(resolved?.value ?? 0),
      completedActions: Number(completed?.value ?? 0),
    };
  }

  async listPriorities() {
    return this.db
      .select()
      .from(actionPriorities)
      .orderBy(asc(actionPriorities.position), asc(actionPriorities.id));
  }

  async defaultPriority() {
    const [medium] = await this.db
      .select({ name: actionPriorities.name })
      .from(actionPriorities)
      .where(eq(actionPriorities.name, "متوسط"))
      .limit(1);
    return medium?.name ?? (await this.listPriorities())[0]?.name ?? "";
  }

  async addPriority(name: string) {
    const normalized = name.trim().slice(0, 80);
    if (!normalized)
      throw new BadRequestException("Priority name is required.");
    return this.db.transaction(async (tx) => {
      const [position] = await tx
        .select({ value: max(actionPriorities.position) })
        .from(actionPriorities);
      return (
        await tx
          .insert(actionPriorities)
          .values({ name: normalized, position: (position.value ?? 0) + 1 })
          .returning()
      )[0];
    });
  }

  async deletePriority(priorityId: bigint) {
    return this.db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(actionPriorities)
        .where(eq(actionPriorities.id, priorityId))
        .for("update")
        .limit(1);
      if (!current) throw new NotFoundException("Priority not found.");
      const [used] = await tx
        .select({ value: count() })
        .from(correctiveActions)
        .where(eq(correctiveActions.priority, current.name));
      if (used.value > 0)
        throw new BadRequestException("Priority is used by actions.");
      await tx
        .delete(actionPriorities)
        .where(eq(actionPriorities.id, priorityId));
      return current;
    });
  }

  async renamePriority(priorityId: bigint, name: string) {
    const normalized = name.trim().slice(0, 80);
    if (!normalized)
      throw new BadRequestException("Priority name is required.");
    return this.db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(actionPriorities)
        .where(eq(actionPriorities.id, priorityId))
        .for("update")
        .limit(1);
      if (!current) throw new NotFoundException("Priority not found.");
      if (current.name !== normalized)
        await tx
          .update(correctiveActions)
          .set({ priority: normalized, updatedAt: new Date() })
          .where(eq(correctiveActions.priority, current.name));
      return (
        await tx
          .update(actionPriorities)
          .set({ name: normalized, updatedAt: new Date() })
          .where(eq(actionPriorities.id, priorityId))
          .returning()
      )[0];
    });
  }

  async create(input: {
    departmentId: bigint;
    alertId?: bigint | null;
    title: string;
    description?: string;
    successMetric: string;
    baseline?: number | null;
    target?: number | null;
    ownerUserId: bigint;
    approverUserId: bigint;
    createdBy: bigint;
    priority: string;
    dueAt: string;
  }) {
    if (
      !(await this.authorization.hasPermission(
        input.createdBy,
        "action.create",
      ))
    )
      throw new ForbiddenException("You cannot create actions.");
    if (
      !(await this.authorization.canAccessDepartment(
        input.createdBy,
        input.departmentId,
        false,
        "action.create",
      ))
    )
      throw new ForbiddenException("Department access denied.");
    return this.db.transaction(async (tx) => {
      const [owner] = await tx
        .select({
          departmentId: users.departmentId,
          approvedAt: users.approvedAt,
        })
        .from(users)
        .where(eq(users.id, input.ownerUserId))
        .limit(1);
      if (!owner?.approvedAt || owner.departmentId !== input.departmentId)
        throw new ForbiddenException(
          "Action owner is outside the actor's accessible departments.",
        );
      const [approver] = await tx
        .select({
          departmentId: users.departmentId,
          approvedAt: users.approvedAt,
        })
        .from(users)
        .where(eq(users.id, input.approverUserId))
        .limit(1);
      if (
        !approver?.approvedAt ||
        approver.departmentId !== input.departmentId ||
        input.approverUserId === input.ownerUserId
      )
        throw new ForbiddenException(
          "Action approver must be an active different user in the selected department.",
        );
      if (input.alertId) {
        const [alert] = await tx
          .select({
            id: correctiveAlerts.id,
            departmentId: correctiveAlerts.departmentId,
          })
          .from(correctiveAlerts)
          .where(eq(correctiveAlerts.id, input.alertId))
          .limit(1);
        if (!alert || alert.departmentId !== input.departmentId)
          throw new NotFoundException(
            "Alert not found in the selected department.",
          );
      }
      const [priority] = await tx
        .select({ id: actionPriorities.id })
        .from(actionPriorities)
        .where(eq(actionPriorities.name, input.priority.trim()))
        .limit(1);
      if (!priority)
        throw new BadRequestException("Action priority does not exist.");
      const dueDate = jalaliDateToGregorian(input.dueAt);
      if (!dueDate) throw new BadRequestException("Invalid Jalali due date.");
      const [action] = await tx
        .insert(correctiveActions)
        .values({
          departmentId: input.departmentId,
          alertId: input.alertId ?? null,
          title: input.title.slice(0, 240),
          description: input.description?.slice(0, 2000) ?? "",
          successMetric: input.successMetric.slice(0, 240),
          baseline: input.baseline == null ? null : String(input.baseline),
          target: input.target == null ? null : String(input.target),
          ownerUserId: input.ownerUserId,
          approverUserId: input.approverUserId,
          createdBy: input.createdBy,
          priority: input.priority,
          dueAt: new Date(`${dueDate}T00:00:00.000Z`),
          status: "proposed",
        })
        .returning();
      const tenantContext = this.authorization.currentContext(input.createdBy);
      await tx.insert(auditLogs).values({
        userId: input.createdBy,
        holdingId: tenantContext ? BigInt(tenantContext.holdingId) : null,
        companyId: tenantContext?.companyId
          ? BigInt(tenantContext.companyId)
          : null,
        membershipId: tenantContext ? BigInt(tenantContext.membershipId) : null,
        actorName: "System",
        action: "corrective_action.created",
        subjectType: "CorrectiveAction",
        subjectId: action.id,
        description: "Corrective action created",
        context: {
          old: null,
          new: {
            status: "proposed",
            departmentId: input.departmentId.toString(),
            ownerUserId: input.ownerUserId.toString(),
            approverUserId: input.approverUserId.toString(),
            dueAt: action.dueAt?.toISOString() ?? null,
            baseline: action.baseline,
            target: action.target,
          },
        },
        ipAddress: null,
        userAgent: null,
      });
      if (input.ownerUserId !== input.createdBy)
        await tx.insert(inboxNotifications).values({
          userId: input.ownerUserId,
          type: "action",
          title: action.title,
          body: action.description.slice(0, 500),
          href: "/actions",
        });
      return action;
    });
  }

  async updateStatus(
    actionId: bigint,
    status: ActionStatus,
    actorId: bigint,
    reason: string,
  ) {
    const explanation = reason.trim();
    if (!explanation) throw new BadRequestException("Validation failed.");
    return this.db.transaction(async (tx) => {
      const [action] = await tx
        .select()
        .from(correctiveActions)
        .where(eq(correctiveActions.id, actionId))
        .for("update")
        .limit(1);
      if (!action) throw new NotFoundException("Action not found.");
      const canManage = await this.authorization.canAccessAction(
        actorId,
        actionId,
        "actions.manage",
      );
      const canUpdateOwn = await this.authorization.canAccessAction(
        actorId,
        actionId,
        "actions.update-own",
      );
      const canApprove = await this.authorization.canAccessAction(
        actorId,
        actionId,
        "action.approve",
      );
      const allowed = canTransitionAction({
        current: action.status,
        next: status,
        actorId,
        ownerUserId: action.ownerUserId,
        approverUserId: action.approverUserId,
        progress: action.progress,
        canUpdateOwn,
        canManage,
        canApprove,
      });
      if (!allowed) throw new ForbiddenException("Permission denied.");
      if (status === "blocked" && !explanation)
        throw new BadRequestException("Validation failed.");
      const context = this.authorization.currentContext(actorId);
      const [updated] = await tx
        .update(correctiveActions)
        .set({
          status,
          blockerReason:
            status === "blocked"
              ? explanation
              : status === "in_progress"
                ? null
                : action.blockerReason,
          delayReason:
            status === "blocked"
              ? explanation
              : status === "in_progress"
                ? null
                : action.delayReason,
          updatedAt: new Date(),
        })
        .where(eq(correctiveActions.id, actionId))
        .returning();
      await tx.insert(auditLogs).values({
        userId: actorId,
        holdingId: context ? BigInt(context.holdingId) : null,
        companyId: context?.companyId ? BigInt(context.companyId) : null,
        membershipId: context ? BigInt(context.membershipId) : null,
        actorName: "System",
        action: "corrective_action.status_changed",
        subjectType: "CorrectiveAction",
        subjectId: actionId,
        description: `Action status changed: ${action.status} to ${status}`,
        context: {
          old: {
            status: action.status,
            progress: action.progress,
            ownerUserId: action.ownerUserId.toString(),
            dueAt: action.dueAt?.toISOString() ?? null,
          },
          new: {
            status,
            progress: action.progress,
            ownerUserId: action.ownerUserId.toString(),
            dueAt: action.dueAt?.toISOString() ?? null,
          },
          reason: explanation,
        },
        ipAddress: null,
        userAgent: null,
      });
      return updated;
    });
  }

  async updateAssignment(
    actionId: bigint,
    input: {
      ownerUserId: bigint;
      dueAt: string;
      actorId: bigint;
      reason: string;
    },
  ) {
    const reason = input.reason.trim();
    const dueDate = jalaliDateToGregorian(input.dueAt);
    if (!reason || !dueDate)
      throw new BadRequestException("Validation failed.");
    return this.db.transaction(async (tx) => {
      const [action] = await tx
        .select()
        .from(correctiveActions)
        .where(eq(correctiveActions.id, actionId))
        .for("update")
        .limit(1);
      if (!action) throw new NotFoundException("Action not found.");
      const canManage = await this.authorization.canAccessAction(
        input.actorId,
        actionId,
        "actions.manage",
      );
      const canApprove = await this.authorization.canAccessAction(
        input.actorId,
        actionId,
        "action.approve",
      );
      if (
        !(canApprove || canManage) ||
        input.actorId === action.ownerUserId ||
        (!canManage && input.actorId !== action.approverUserId)
      )
        throw new ForbiddenException("Permission denied.");
      const [owner] = await tx
        .select({
          departmentId: users.departmentId,
          approvedAt: users.approvedAt,
        })
        .from(users)
        .where(eq(users.id, input.ownerUserId))
        .limit(1);
      if (!owner?.approvedAt || owner.departmentId !== action.departmentId)
        throw new ForbiddenException(
          "Action owner is outside the actor's accessible departments.",
        );
      const dueAt = new Date(`${dueDate}T00:00:00.000Z`);
      const [updated] = await tx
        .update(correctiveActions)
        .set({ ownerUserId: input.ownerUserId, dueAt, updatedAt: new Date() })
        .where(eq(correctiveActions.id, actionId))
        .returning();
      const context = this.authorization.currentContext(input.actorId);
      await tx.insert(auditLogs).values({
        userId: input.actorId,
        holdingId: context ? BigInt(context.holdingId) : null,
        companyId: context?.companyId ? BigInt(context.companyId) : null,
        membershipId: context ? BigInt(context.membershipId) : null,
        actorName: "System",
        action: "corrective_action.assignment_changed",
        subjectType: "CorrectiveAction",
        subjectId: actionId,
        description: "Action owner or deadline changed with approval",
        context: {
          old: {
            ownerUserId: action.ownerUserId.toString(),
            dueAt: action.dueAt?.toISOString() ?? null,
          },
          new: {
            ownerUserId: input.ownerUserId.toString(),
            dueAt: dueAt.toISOString(),
          },
          reason,
        },
        ipAddress: null,
        userAgent: null,
      });
      return updated;
    });
  }

  async updateProgress(
    actionId: bigint,
    progress: number,
    actorId: bigint,
    reason: string,
  ) {
    const explanation = reason.trim();
    if (
      !Number.isInteger(progress) ||
      progress < 0 ||
      progress > 100 ||
      !explanation
    )
      throw new BadRequestException("Validation failed.");
    return this.db.transaction(async (tx) => {
      const [action] = await tx
        .select()
        .from(correctiveActions)
        .where(eq(correctiveActions.id, actionId))
        .for("update")
        .limit(1);
      if (!action) throw new NotFoundException("Action not found.");
      const canManage = await this.authorization.canAccessAction(
        actorId,
        actionId,
        "actions.manage",
      );
      const canUpdateOwn =
        actorId === action.ownerUserId &&
        (await this.authorization.canAccessAction(
          actorId,
          actionId,
          "actions.update-own",
        ));
      if (!canUpdateOwn && !canManage)
        throw new ForbiddenException("Permission denied.");
      if (!["approved", "in_progress", "blocked"].includes(action.status))
        throw new ForbiddenException("Permission denied.");
      const context = this.authorization.currentContext(actorId);
      const [updated] = await tx
        .update(correctiveActions)
        .set({ progress, updatedAt: new Date() })
        .where(eq(correctiveActions.id, actionId))
        .returning();
      await tx.insert(auditLogs).values({
        userId: actorId,
        holdingId: context ? BigInt(context.holdingId) : null,
        companyId: context?.companyId ? BigInt(context.companyId) : null,
        membershipId: context ? BigInt(context.membershipId) : null,
        actorName: "System",
        action: "corrective_action.progress_changed",
        subjectType: "CorrectiveAction",
        subjectId: actionId,
        description: `Action progress changed from ${action.progress} to ${progress}`,
        context: {
          old: { progress: action.progress, status: action.status },
          new: { progress, status: action.status },
          reason: explanation,
        },
        ipAddress: null,
        userAgent: null,
      });
      return updated;
    });
  }

  async addEvidenceMetadata(input: {
    actionId: bigint;
    actorId: bigint;
    storageKey: string;
    originalFileName: string;
    mimeType: string;
    fileSize: number;
  }) {
    return this.db.transaction(async (tx) => {
      const [action] = await tx
        .select()
        .from(correctiveActions)
        .where(eq(correctiveActions.id, input.actionId))
        .for("update")
        .limit(1);
      if (!action) throw new NotFoundException("Action not found.");
      const canManage = await this.authorization.canAccessAction(
        input.actorId,
        input.actionId,
        "actions.manage",
      );
      const canUpdateOwn =
        input.actorId === action.ownerUserId &&
        (await this.authorization.canAccessAction(
          input.actorId,
          input.actionId,
          "actions.update-own",
        ));
      if (!canUpdateOwn && !canManage)
        throw new ForbiddenException("Permission denied.");
      if (!["approved", "in_progress", "blocked"].includes(action.status))
        throw new ForbiddenException("Permission denied.");
      const [evidence] = await tx
        .insert(correctiveActionEvidence)
        .values({
          actionId: input.actionId,
          uploadedBy: input.actorId,
          storageKey: input.storageKey,
          originalFileName: input.originalFileName,
          mimeType: input.mimeType,
          fileSize: input.fileSize,
        })
        .returning();
      const context = this.authorization.currentContext(input.actorId);
      await tx.insert(auditLogs).values({
        userId: input.actorId,
        holdingId: context ? BigInt(context.holdingId) : null,
        companyId: context?.companyId ? BigInt(context.companyId) : null,
        membershipId: context ? BigInt(context.membershipId) : null,
        actorName: "System",
        action: "corrective_action.evidence_added",
        subjectType: "CorrectiveAction",
        subjectId: input.actionId,
        description: "Evidence uploaded to corrective action",
        context: {
          old: null,
          new: {
            evidenceId: evidence.id.toString(),
            fileName: evidence.originalFileName,
            mimeType: evidence.mimeType,
            fileSize: evidence.fileSize,
          },
        },
        ipAddress: null,
        userAgent: null,
      });
      return evidence;
    });
  }

  findEvidence(actionId: bigint, evidenceId: bigint) {
    return this.db
      .select()
      .from(correctiveActionEvidence)
      .where(
        and(
          eq(correctiveActionEvidence.actionId, actionId),
          eq(correctiveActionEvidence.id, evidenceId),
        ),
      )
      .limit(1);
  }

  async acknowledgeAlert(alertId: bigint, actorId: bigint) {
    return this.setAlertStatus(alertId, actorId, "acknowledged", "");
  }

  async resolveAlert(alertId: bigint, actorId: bigint, note: string) {
    return this.setAlertStatus(alertId, actorId, "resolved", note);
  }

  private async setAlertStatus(
    alertId: bigint,
    actorId: bigint,
    next: "acknowledged" | "resolved",
    note: string,
  ) {
    return this.db.transaction(async (tx) => {
      const [alert] = await tx
        .select()
        .from(correctiveAlerts)
        .where(eq(correctiveAlerts.id, alertId))
        .for("update")
        .limit(1);
      if (!alert) throw new NotFoundException("Alert not found.");
      const permission =
        next === "acknowledged" ? "alerts.acknowledge" : "alerts.resolve";
      if (
        !(await this.authorization.canAccessAlert(actorId, alertId, permission))
      )
        throw new ForbiddenException("Department access denied.");
      if (alert.status === "resolved")
        throw new ForbiddenException("Alert is already resolved.");
      if (next === "acknowledged" && alert.status === "acknowledged")
        return alert;
      const now = new Date();
      const [updated] = await tx
        .update(correctiveAlerts)
        .set(
          next === "acknowledged"
            ? {
                status: next,
                acknowledgedAt: now,
                acknowledgedBy: actorId,
                updatedAt: now,
              }
            : {
                status: next,
                resolvedAt: now,
                resolvedBy: actorId,
                acknowledgedAt: alert.acknowledgedAt ?? now,
                acknowledgedBy: alert.acknowledgedBy ?? actorId,
                resolutionNote: note.slice(0, 1000),
                updatedAt: now,
              },
        )
        .where(eq(correctiveAlerts.id, alertId))
        .returning();
      await tx.insert(auditLogs).values({
        userId: actorId,
        actorName: "System",
        action: `alert.${next}`,
        subjectType: "CorrectiveAlert",
        subjectId: alertId,
        description:
          next === "resolved" ? "Alert resolved" : "Alert acknowledged",
        context: next === "resolved" ? { note: note.slice(0, 1000) } : null,
        ipAddress: null,
        userAgent: null,
      });
      return updated;
    });
  }

  async alertBoard(actorId: bigint) {
    const scopedDepartmentIds =
      await this.authorization.departmentsForPermission(actorId, "alerts.view");
    const predicates = [
      eq(correctiveAlerts.assignedTo, actorId),
      scopedDepartmentIds.length
        ? inArray(correctiveAlerts.departmentId, scopedDepartmentIds)
        : sql`false`,
    ];
    const candidates = await this.db
      .select()
      .from(correctiveAlerts)
      .where(and(ne(correctiveAlerts.status, "resolved"), or(...predicates)))
      .orderBy(
        sql`case ${correctiveAlerts.severity} when 'urgent' then 0 when 'high' then 1 when 'medium' then 2 else 3 end`,
        desc(correctiveAlerts.id),
      )
      .limit(300);
    const visible = await Promise.all(
      candidates.map(async (alert) => {
        if (
          alert.departmentId !== null &&
          scopedDepartmentIds.includes(alert.departmentId)
        )
          return alert;
        return (await this.authorization.canAccessAlert(
          actorId,
          alert.id,
          "alerts.view",
        ))
          ? alert
          : null;
      }),
    );
    const alerts = visible.filter(
      (alert): alert is (typeof candidates)[number] => alert !== null,
    );
    const kpiIds = [
      ...new Set(
        alerts.flatMap((alert) => (alert.kpiId === null ? [] : [alert.kpiId])),
      ),
    ];
    const departmentIds = [
      ...new Set(
        alerts.flatMap((alert) =>
          alert.departmentId === null ? [] : [alert.departmentId],
        ),
      ),
    ];
    const assigneeIds = [
      ...new Set(
        alerts.flatMap((alert) =>
          alert.assignedTo === null ? [] : [alert.assignedTo],
        ),
      ),
    ];
    const [kpiRows, departmentRows, assigneeRows] = await Promise.all([
      kpiIds.length
        ? this.db
            .select({ id: kpiManagementKpis.id, name: kpiManagementKpis.name })
            .from(kpiManagementKpis)
            .where(inArray(kpiManagementKpis.id, kpiIds))
        : Promise.resolve([]),
      departmentIds.length
        ? this.db
            .select({ id: departments.id, name: departments.name })
            .from(departments)
            .where(inArray(departments.id, departmentIds))
        : Promise.resolve([]),
      assigneeIds.length
        ? this.db
            .select({
              id: users.id,
              firstName: users.firstName,
              lastName: users.lastName,
            })
            .from(users)
            .where(inArray(users.id, assigneeIds))
        : Promise.resolve([]),
    ]);
    const kpiName = new Map(kpiRows.map((row) => [row.id, row.name]));
    const departmentName = new Map(
      departmentRows.map((row) => [row.id, row.name]),
    );
    const assigneeName = new Map(
      assigneeRows.map((row) => [
        row.id,
        [row.firstName, row.lastName].filter(Boolean).join(" ") || "تعیین نشده",
      ]),
    );
    const [canAcknowledge, canResolve] = await Promise.all([
      Promise.all(
        alerts.map((alert) =>
          this.authorization.canAccessAlert(
            actorId,
            alert.id,
            "alerts.acknowledge",
          ),
        ),
      ),
      Promise.all(
        alerts.map((alert) =>
          this.authorization.canAccessAlert(
            actorId,
            alert.id,
            "alerts.resolve",
          ),
        ),
      ),
    ]);
    return {
      canAcknowledge: canAcknowledge.some(Boolean),
      canResolve: canResolve.some(Boolean),
      rows: alerts.map((alert, index) => ({
        id: alert.id.toString(),
        title: alert.title,
        description: alert.description,
        severity: alert.severity,
        band: CorrectiveActionsRepository.band(alert.severity),
        status: alert.status,
        period: alert.period,
        kpiName:
          alert.kpiId === null ? null : (kpiName.get(alert.kpiId) ?? null),
        department:
          alert.departmentId === null
            ? null
            : (departmentName.get(alert.departmentId) ?? null),
        assignee:
          alert.assignedTo === null
            ? null
            : (assigneeName.get(alert.assignedTo) ?? null),
        canAcknowledge: canAcknowledge[index] ?? false,
        canResolve: canResolve[index] ?? false,
      })),
    };
  }

  async actionBoard(actorId: bigint) {
    const [viewDepartmentIds, manageDepartmentIds] = await Promise.all([
      this.authorization.departmentsForPermission(actorId, "actions.view"),
      this.authorization.departmentsForPermission(actorId, "actions.manage"),
    ]);
    const scopedDepartmentIds = [
      ...new Set([...viewDepartmentIds, ...manageDepartmentIds]),
    ];
    const predicates = [
      eq(correctiveActions.ownerUserId, actorId),
      eq(correctiveActions.approverUserId, actorId),
      scopedDepartmentIds.length
        ? inArray(correctiveActions.departmentId, scopedDepartmentIds)
        : sql`false`,
    ];
    const candidates = await this.db
      .select()
      .from(correctiveActions)
      .where(or(...predicates))
      .orderBy(asc(correctiveActions.dueAt), desc(correctiveActions.id))
      .limit(400);
    const visible = await Promise.all(
      candidates.map(async (action) => {
        const canView =
          (await this.authorization.canAccessAction(
            actorId,
            action.id,
            "actions.view",
          )) ||
          (await this.authorization.canAccessAction(
            actorId,
            action.id,
            "actions.manage",
          )) ||
          (await this.authorization.canAccessAction(
            actorId,
            action.id,
            "action.approve",
          ));
        if (!canView) return null;
        return {
          action,
          canUpdate:
            (await this.authorization.canAccessAction(
              actorId,
              action.id,
              "actions.manage",
            )) ||
            (actorId === action.ownerUserId &&
              (await this.authorization.canAccessAction(
                actorId,
                action.id,
                "actions.update-own",
              ))),
          canApprove:
            (await this.authorization.canAccessAction(
              actorId,
              action.id,
              "action.approve",
            )) ||
            (await this.authorization.canAccessAction(
              actorId,
              action.id,
              "actions.manage",
            )),
        };
      }),
    );
    const rows = visible.filter(
      (row): row is NonNullable<typeof row> => row !== null,
    );
    const ownerIds = [...new Set(rows.map(({ action }) => action.ownerUserId))];
    const owners = ownerIds.length
      ? await this.db
          .select({
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
          })
          .from(users)
          .where(inArray(users.id, ownerIds))
      : [];
    const ownerName = new Map(
      owners.map((owner) => [
        owner.id,
        [owner.firstName, owner.lastName].filter(Boolean).join(" ") ||
          "تعیین نشده",
      ]),
    );
    const now = new Date();
    const cards = rows.map(({ action, canUpdate, canApprove }) => {
      return {
        id: action.id.toString(),
        title: action.title,
        description: action.description,
        successMetric: action.successMetric,
        priority: action.priority,
        owner: ownerName.get(action.ownerUserId) ?? "تعیین نشده",
        dueAt: action.dueAt?.toISOString() ?? null,
        status: action.status,
        overdue:
          action.dueAt !== null &&
          action.dueAt < now &&
          !["done", "closed", "canceled"].includes(action.status),
        canUpdate,
        progress: action.progress,
        canApprove,
      };
    });
    const column = (status: ActionStatus) =>
      cards.filter((card) => card.status === status);
    return {
      proposed: [...column("proposed"), ...column("open")],
      approved: column("approved"),
      in_progress: column("in_progress"),
      blocked: column("blocked"),
      pending_completion_approval: column("pending_completion_approval"),
      closed: column("closed"),
      legacy_done: column("done"),
      canceled: column("canceled"),
    };
  }
}
