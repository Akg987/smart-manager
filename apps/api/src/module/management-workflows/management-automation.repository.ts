import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import {
  auditLogs,
  businessUnits,
  companies,
  correctiveActions,
  inboxNotifications,
  kpiManagementKpis,
  kpiManagementValues,
  managementDecisions,
  managementEscalationEvents,
  managementEscalationRules,
  managementReminderPolicies,
  managementReminders,
  membershipRoles,
  memberships,
  redFlags,
  roles,
} from "../../../../../src/db/schema.js";
import { BaseRepository } from "../../common/repository/base.repository.js";
import {
  DRIZZLE_DB,
  type DrizzleDatabase,
} from "../../database/database.token.js";
import {
  currentJalaliPeriod,
  normalizeJalaliPeriod,
} from "../../shared/jalali.js";
import { AuthorizationService } from "../authorization/authorization.service.js";
import {
  matchesEscalation,
  reminderSchedule,
  type EscalationTarget,
  type EscalationTrigger,
} from "./escalation-engine.js";
import type { JsonValue } from "../../../../../src/db/schema.js";

const severityOrder: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
  urgent: 4,
  critical: 4,
};
const finalAction = ["closed", "done", "canceled", "cancelled"];
const finalDecision = ["closed", "cancelled", "rejected", "resolved"];

@Injectable()
export class ManagementAutomationRepository extends BaseRepository {
  constructor(
    @Inject(DRIZZLE_DB) db: DrizzleDatabase,
    private readonly authorization: AuthorizationService,
  ) {
    super(db);
  }

  async listEscalationRules(actorId: bigint) {
    const { holdingId, companyId } = await this.scope(actorId, "meeting.view");
    return this.db
      .select()
      .from(managementEscalationRules)
      .where(
        and(
          eq(managementEscalationRules.holdingId, holdingId),
          eq(managementEscalationRules.companyId, companyId),
        ),
      );
  }

  async createEscalationRule(
    actorId: bigint,
    input: {
      trigger: EscalationTrigger;
      configuration: Record<string, unknown>;
      levels: { level: number; roleKeys: string[]; afterMinutes: number }[];
    },
  ) {
    const { holdingId, companyId } = await this.scope(
      actorId,
      "meeting.update",
    );
    this.validateTrigger(input.trigger, input.configuration);
    const levels = [...input.levels].sort((a, b) => a.level - b.level);
    if (
      levels.some(
        (level, index) =>
          level.level !== index + 1 ||
          !level.roleKeys.length ||
          new Set(level.roleKeys).size !== level.roleKeys.length,
      )
    )
      throw new BadRequestException(
        "Escalation levels must be unique and consecutive, starting at 1.",
      );
    const roleRows = await this.db
      .select({ id: roles.id, key: roles.key })
      .from(roles)
      .where(or(isNull(roles.holdingId), eq(roles.holdingId, holdingId)));
    const roleKeys = new Set(roleRows.map((role) => role.key));
    if (
      levels.some((level) => level.roleKeys.some((key) => !roleKeys.has(key)))
    )
      throw new BadRequestException(
        "An escalation recipient role does not belong to this holding.",
      );
    const [row] = await this.db
      .insert(managementEscalationRules)
      .values({
        holdingId,
        companyId,
        trigger: input.trigger,
        configuration: input.configuration as JsonValue,
        escalationLevels: levels as unknown as JsonValue,
        createdBy: actorId,
      })
      .returning();
    await this.audit(
      actorId,
      holdingId,
      companyId,
      "management.escalation_rule.created",
      "ManagementEscalationRule",
      row.id,
      { trigger: row.trigger, levels },
    );
    return row;
  }

  async updateEscalationRule(
    actorId: bigint,
    id: bigint,
    input: {
      trigger?: EscalationTrigger;
      configuration?: Record<string, unknown>;
      levels?: { level: number; roleKeys: string[]; afterMinutes: number }[];
      enabled?: boolean;
    },
  ) {
    const { holdingId, companyId } = await this.scope(
      actorId,
      "meeting.update",
    );
    const [current] = await this.db
      .select()
      .from(managementEscalationRules)
      .where(
        and(
          eq(managementEscalationRules.id, id),
          eq(managementEscalationRules.holdingId, holdingId),
          eq(managementEscalationRules.companyId, companyId),
        ),
      )
      .limit(1);
    if (!current)
      throw new BadRequestException(
        "Escalation rule is not available in the active Company.",
      );
    const trigger = input.trigger ?? (current.trigger as EscalationTrigger);
    const configuration =
      input.configuration ?? (current.configuration as Record<string, unknown>);
    this.validateTrigger(trigger, configuration);
    const levels =
      input.levels ??
      (Array.isArray(current.escalationLevels)
        ? (current.escalationLevels as {
            level: number;
            roleKeys: string[];
            afterMinutes: number;
          }[])
        : []);
    if (
      levels.some(
        (level, index) =>
          level.level !== index + 1 ||
          !level.roleKeys.length ||
          new Set(level.roleKeys).size !== level.roleKeys.length,
      )
    )
      throw new BadRequestException(
        "Escalation levels must be unique and consecutive, starting at 1.",
      );
    const roleRows = await this.db
      .select({ key: roles.key })
      .from(roles)
      .where(or(isNull(roles.holdingId), eq(roles.holdingId, holdingId)));
    const roleKeys = new Set(roleRows.map((role) => role.key));
    if (
      levels.some((level) => level.roleKeys.some((key) => !roleKeys.has(key)))
    )
      throw new BadRequestException(
        "An escalation recipient role does not belong to this holding.",
      );
    const [updated] = await this.db
      .update(managementEscalationRules)
      .set({
        trigger,
        configuration: configuration as JsonValue,
        escalationLevels: levels as unknown as JsonValue,
        enabled: input.enabled ?? current.enabled,
        updatedAt: new Date(),
      })
      .where(eq(managementEscalationRules.id, id))
      .returning();
    await this.audit(
      actorId,
      holdingId,
      companyId,
      "management.escalation_rule.updated",
      "ManagementEscalationRule",
      id,
      { trigger, enabled: updated.enabled, levels },
    );
    return updated;
  }

  async setReminderPolicy(
    actorId: bigint,
    input: {
      itemType: "action" | "decision";
      offsetsMinutes: number[];
      enabled?: boolean;
    },
  ) {
    const { context, holdingId, companyId } = await this.scope(
      actorId,
      "meeting.update",
    );
    const offsets = [...new Set(input.offsetsMinutes)].sort((a, b) => a - b);
    if (
      !offsets.length ||
      offsets.length > 3 ||
      offsets.some((value) => !Number.isInteger(value))
    )
      throw new BadRequestException(
        "Reminder offsets must contain one to three distinct minute values.",
      );
    if (!offsets.some((value) => value < 0))
      throw new BadRequestException(
        "Configure at least one reminder before the deadline.",
      );
    if (!offsets.includes(0))
      throw new BadRequestException("Configure a reminder on the deadline.");
    if (!offsets.some((value) => value > 0))
      throw new BadRequestException(
        "Configure at least one reminder after the deadline.",
      );
    const [policy] = await this.db
      .insert(managementReminderPolicies)
      .values({
        holdingId,
        companyId,
        itemType: input.itemType,
        offsetsMinutes: offsets,
        enabled: input.enabled ?? true,
        createdBy: actorId,
      })
      .onConflictDoUpdate({
        target: [
          managementReminderPolicies.holdingId,
          managementReminderPolicies.companyId,
          managementReminderPolicies.itemType,
        ],
        set: {
          offsetsMinutes: offsets,
          enabled: input.enabled ?? true,
          createdBy: actorId,
          updatedAt: new Date(),
        },
      })
      .returning();
    await this.audit(
      actorId,
      holdingId,
      companyId,
      "management.reminder_policy.updated",
      "ManagementReminderPolicy",
      policy.id,
      {
        itemType: policy.itemType,
        offsetsMinutes: offsets,
        enabled: policy.enabled,
      },
    );
    return policy;
  }

  async listReminderPolicies(actorId: bigint) {
    const { holdingId, companyId } = await this.scope(actorId, "meeting.view");
    return this.db
      .select()
      .from(managementReminderPolicies)
      .where(
        and(
          eq(managementReminderPolicies.holdingId, holdingId),
          eq(managementReminderPolicies.companyId, companyId),
        ),
      );
  }

  async run(actorId: bigint, requestedPeriod?: string) {
    const { holdingId, companyId } = await this.scope(
      actorId,
      "meeting.update",
    );
    const period = requestedPeriod
      ? normalizeJalaliPeriod(requestedPeriod)
      : currentJalaliPeriod();
    if (!period)
      throw new BadRequestException("A valid Jalali period is required.");
    return this.runCompany(actorId, holdingId, companyId, period);
  }

  async runScheduled() {
    const period = currentJalaliPeriod();
    const configured = await this.db
      .selectDistinct({
        holdingId: companies.holdingId,
        companyId: companies.id,
      })
      .from(companies)
      .innerJoin(
        managementReminderPolicies,
        eq(managementReminderPolicies.companyId, companies.id),
      )
      .where(
        and(
          eq(managementReminderPolicies.enabled, true),
          eq(companies.status, "active"),
        ),
      );
    const escalationScopes = await this.db
      .selectDistinct({
        holdingId: companies.holdingId,
        companyId: companies.id,
      })
      .from(companies)
      .innerJoin(
        managementEscalationRules,
        eq(managementEscalationRules.companyId, companies.id),
      )
      .where(
        and(
          eq(managementEscalationRules.enabled, true),
          eq(companies.status, "active"),
        ),
      );
    const scopes = new Map(
      [...configured, ...escalationScopes].map((scope) => [
        `${scope.holdingId}:${scope.companyId}`,
        scope,
      ]),
    );
    let remindersCreated = 0,
      escalationsCreated = 0;
    for (const scope of scopes.values()) {
      const result = await this.runCompany(
        null,
        scope.holdingId,
        scope.companyId,
        period,
      );
      remindersCreated += result.remindersCreated;
      escalationsCreated += result.escalationsCreated;
    }
    return {
      period,
      remindersCreated,
      escalationsCreated,
      targetStatusesChanged: 0,
    };
  }

  private async runCompany(
    actorId: bigint | null,
    holdingId: bigint,
    companyId: bigint,
    period: string,
  ) {
    const remindersCreated = await this.sendReminders(
      actorId,
      holdingId,
      companyId,
    );
    const escalationsCreated = await this.evaluateEscalations(
      actorId,
      holdingId,
      companyId,
      period,
    );
    return {
      period,
      remindersCreated,
      escalationsCreated,
      targetStatusesChanged: 0,
    };
  }

  private async evaluateEscalations(
    actorId: bigint | null,
    holdingId: bigint,
    companyId: bigint,
    period: string,
  ) {
    const rules = await this.db
      .select()
      .from(managementEscalationRules)
      .where(
        and(
          eq(managementEscalationRules.holdingId, holdingId),
          eq(managementEscalationRules.companyId, companyId),
          eq(managementEscalationRules.enabled, true),
        ),
      );
    if (!rules.length) return 0;
    const now = new Date();
    const candidates = await this.escalationTargets(companyId, period);
    let created = 0;
    for (const rule of rules) {
      const levels = Array.isArray(rule.escalationLevels)
        ? (rule.escalationLevels as {
            level: number;
            roleKeys: string[];
            afterMinutes: number;
          }[])
        : [];
      for (const target of candidates) {
        if (
          !matchesEscalation({
            trigger: rule.trigger as EscalationTrigger,
            configuration: rule.configuration as Record<string, unknown>,
            target,
            now,
          })
        )
          continue;
        for (const level of levels) {
          const base =
            rule.trigger === "delay" && target.deadline
              ? target.deadline
              : target.createdAt;
          if (
            base &&
            now.getTime() - base.getTime() < level.afterMinutes * 60_000
          )
            continue;
          const recipients = await this.usersForRoles(
            level.roleKeys,
            companyId,
          );
          if (!recipients.length) continue;
          const [event] = await this.db
            .insert(managementEscalationEvents)
            .values({
              ruleId: rule.id,
              holdingId,
              companyId,
              targetType: target.type,
              targetId: BigInt(
                (target as EscalationTarget & { id: string }).id,
              ),
              level: level.level,
              recipientRole: level.roleKeys.join(",").slice(0, 80),
              detail: {
                trigger: rule.trigger,
                severity: target.severity ?? null,
              },
            })
            .onConflictDoNothing()
            .returning();
          if (!event) continue;
          for (const userId of recipients)
            await this.db.insert(inboxNotifications).values({
              userId,
              type: "alert",
              title: "نیاز به بررسی مدیریتی",
              body: `یک مورد در شرکت شما با قاعدهٔ ${rule.trigger} به سطح پیگیری ${level.level} رسیده است.`,
              href:
                target.type === "red_flag"
                  ? "/red-flags"
                  : target.type === "action"
                    ? "/actions"
                    : target.type === "decision"
                      ? "/decisions"
                      : "/kpis",
            });
          await this.audit(
            actorId,
            holdingId,
            companyId,
            "management.escalation.created",
            "ManagementEscalationEvent",
            event.id,
            {
              ruleId: rule.id.toString(),
              targetType: target.type,
              level: level.level,
            },
          );
          created++;
        }
      }
    }
    return created;
  }

  private async escalationTargets(
    companyId: bigint,
    period: string,
  ): Promise<(EscalationTarget & { id: string })[]> {
    const now = new Date();
    const flags = await this.db
      .select()
      .from(redFlags)
      .where(eq(redFlags.companyId, companyId));
    const actionRows = await this.db
      .select({ action: correctiveActions, unit: businessUnits })
      .from(correctiveActions)
      .innerJoin(
        businessUnits,
        eq(businessUnits.legacyDepartmentId, correctiveActions.departmentId),
      )
      .where(eq(businessUnits.companyId, companyId));
    const decisions = await this.db
      .select()
      .from(managementDecisions)
      .where(eq(managementDecisions.companyId, companyId));
    const publishedKpis = await this.db
      .select({
        id: kpiManagementKpis.id,
        createdAt: kpiManagementKpis.createdAt,
      })
      .from(kpiManagementKpis)
      .where(
        and(
          eq(kpiManagementKpis.companyId, companyId),
          eq(kpiManagementKpis.status, "published"),
          eq(kpiManagementKpis.active, true),
        ),
      );
    const values = publishedKpis.length
      ? await this.db
          .select({ kpiId: kpiManagementValues.kpiId })
          .from(kpiManagementValues)
          .where(
            and(
              eq(kpiManagementValues.companyId, companyId),
              eq(kpiManagementValues.period, period),
              eq(kpiManagementValues.isCurrent, true),
              inArray(
                kpiManagementValues.kpiId,
                publishedKpis.map((kpi) => kpi.id),
              ),
            ),
          )
      : [];
    const hasValue = new Set(values.map((value) => value.kpiId.toString()));
    return [
      ...flags.map((flag) => ({
        id: flag.id.toString(),
        type: "red_flag" as const,
        status: flag.status,
        severity: flag.severity,
        amount: flag.triggerValue == null ? null : Number(flag.triggerValue),
        createdAt: flag.createdAt ?? now,
        deadline: flag.deadline
          ? new Date(`${flag.deadline}T23:59:59.000Z`)
          : null,
        lastRespondedAt: flag.updatedAt,
        missing: false,
      })),
      ...actionRows.map(({ action }) => ({
        id: action.id.toString(),
        type: "action" as const,
        status: action.status,
        severity: null,
        amount: action.target == null ? null : Number(action.target),
        createdAt: action.createdAt ?? now,
        deadline: action.dueAt,
        lastRespondedAt: action.updatedAt,
        missing: false,
      })),
      ...decisions.map((decision) => ({
        id: decision.id.toString(),
        type: "decision" as const,
        status: decision.status,
        severity: null,
        amount: null,
        createdAt: decision.createdAt ?? now,
        deadline: new Date(`${decision.deadline}T23:59:59.000Z`),
        lastRespondedAt: decision.updatedAt,
        missing: false,
      })),
      ...publishedKpis
        .filter((kpi) => !hasValue.has(kpi.id.toString()))
        .map((kpi) => ({
          id: kpi.id.toString(),
          type: "kpi" as const,
          status: "missing",
          severity: null,
          amount: null,
          createdAt: kpi.createdAt ?? now,
          deadline: now,
          lastRespondedAt: null,
          missing: true,
        })),
    ];
  }

  private async sendReminders(
    actorId: bigint | null,
    holdingId: bigint,
    companyId: bigint,
  ) {
    const policies = await this.db
      .select()
      .from(managementReminderPolicies)
      .where(
        and(
          eq(managementReminderPolicies.holdingId, holdingId),
          eq(managementReminderPolicies.companyId, companyId),
          eq(managementReminderPolicies.enabled, true),
        ),
      );
    const now = new Date();
    let created = 0;
    for (const policy of policies) {
      const targets =
        policy.itemType === "action"
          ? await this.actionsDue(companyId)
          : await this.decisionsDue(companyId);
      const offsets = Array.isArray(policy.offsetsMinutes)
        ? policy.offsetsMinutes.filter(
            (value): value is number =>
              typeof value === "number" && Number.isInteger(value),
          )
        : [];
      for (const target of targets) {
        if (!target.ownerUserId || !target.dueAt || target.closed) continue;
        for (const scheduled of reminderSchedule(target.dueAt, offsets)) {
          if (scheduled.scheduledFor > now) continue;
          const [reminder] = await this.db
            .insert(managementReminders)
            .values({
              policyId: policy.id,
              holdingId,
              companyId,
              targetType: policy.itemType,
              targetId: target.id,
              recipientUserId: target.ownerUserId,
              phase: scheduled.phase,
              scheduledFor: scheduled.scheduledFor,
            })
            .onConflictDoNothing()
            .returning();
          if (!reminder) continue;
          const itemLabel = policy.itemType === "action" ? "اقدام" : "تصمیم";
          await this.db.insert(inboxNotifications).values({
            userId: target.ownerUserId,
            type: "action",
            title: `یادآوری موعد ${itemLabel}`,
            body: `${itemLabel} «${target.title.slice(0, 240)}» به موعد خود رسیده یا از آن گذشته است.`,
            href: policy.itemType === "action" ? "/actions" : "/decisions",
          });
          await this.db
            .update(managementReminders)
            .set({ sentAt: new Date() })
            .where(eq(managementReminders.id, reminder.id));
          created++;
        }
      }
    }
    return created;
  }

  private async actionsDue(companyId: bigint) {
    const rows = await this.db
      .select({ action: correctiveActions })
      .from(correctiveActions)
      .innerJoin(
        businessUnits,
        eq(businessUnits.legacyDepartmentId, correctiveActions.departmentId),
      )
      .where(
        and(
          eq(businessUnits.companyId, companyId),
          or(
            sql`${correctiveActions.status} not in ('closed','done','canceled')`,
            isNull(correctiveActions.status),
          ),
        ),
      );
    return rows.map(({ action }) => ({
      id: action.id,
      ownerUserId: action.ownerUserId,
      dueAt: action.dueAt,
      title: action.title,
      closed: finalAction.includes(action.status),
    }));
  }

  private async decisionsDue(companyId: bigint) {
    const rows = await this.db
      .select()
      .from(managementDecisions)
      .where(
        and(
          eq(managementDecisions.companyId, companyId),
          sql`${managementDecisions.status} not in ('closed','cancelled','rejected','resolved')`,
        ),
      );
    return rows.map((row) => ({
      id: row.id,
      ownerUserId: row.ownerUserId,
      dueAt: new Date(`${row.deadline}T23:59:59.000Z`),
      title: row.decisionText,
      closed: finalDecision.includes(row.status),
    }));
  }

  private async usersForRoles(roleKeys: string[], companyId: bigint) {
    if (!roleKeys.length) return [];
    const [company] = await this.db
      .select({ holdingId: companies.holdingId })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);
    if (!company) return [];
    const roleRows = await this.db
      .select({ id: roles.id })
      .from(roles)
      .where(
        and(
          inArray(roles.key, roleKeys),
          or(isNull(roles.holdingId), eq(roles.holdingId, company.holdingId)),
        ),
      );
    if (!roleRows.length) return [];
    const usersInRoles = await this.db
      .select({ userId: memberships.userId })
      .from(membershipRoles)
      .innerJoin(memberships, eq(memberships.id, membershipRoles.membershipId))
      .where(
        and(
          inArray(
            membershipRoles.roleId,
            roleRows.map((role) => role.id),
          ),
          eq(memberships.companyId, companyId),
          eq(memberships.status, "active"),
        ),
      );
    return [...new Set(usersInRoles.map((row) => row.userId.toString()))].map(
      BigInt,
    );
  }

  private validateTrigger(
    trigger: EscalationTrigger,
    config: Record<string, unknown>,
  ) {
    if (
      trigger === "severity" &&
      (typeof config.minimumSeverity !== "string" ||
        !(config.minimumSeverity in severityOrder))
    )
      throw new BadRequestException(
        "Severity trigger requires a valid minimumSeverity.",
      );
    if (
      trigger === "amount" &&
      (!Number.isFinite(Number(config.minimumAmount)) ||
        Number(config.minimumAmount) < 0)
    )
      throw new BadRequestException(
        "Amount trigger requires a non-negative minimumAmount.",
      );
    if (
      ["duration", "no_response"].includes(trigger) &&
      (!Number.isInteger(Number(config.minutes)) || Number(config.minutes) < 0)
    )
      throw new BadRequestException(
        `${trigger} trigger requires a non-negative minutes value.`,
      );
  }

  private async scope(actorId: bigint, permission: string) {
    const context = this.authorization.currentContext(actorId);
    if (!context?.companyId || !context.membershipId)
      throw new ForbiddenException("An active company membership is required.");
    const resource = {
      holdingId: context.holdingId,
      companyId: context.companyId,
      branchId: context.branchId,
      businessUnitId: context.businessUnitId,
    };
    if (!(await this.authorization.can(context, permission, resource)))
      throw new ForbiddenException(
        `Permission ${permission} is required for this operation.`,
      );
    return {
      context,
      holdingId: BigInt(context.holdingId),
      companyId: BigInt(context.companyId),
    };
  }

  private audit(
    actorId: bigint | null,
    holdingId: bigint,
    companyId: bigint,
    action: string,
    subjectType: string,
    subjectId: bigint,
    detail: Record<string, unknown>,
  ) {
    const context = actorId ? this.authorization.currentContext(actorId) : null;
    return this.db
      .insert(auditLogs)
      .values({
        userId: actorId,
        holdingId,
        companyId,
        membershipId: context?.membershipId
          ? BigInt(context.membershipId)
          : null,
        actorName: actorId ? "System" : "Automation",
        action,
        subjectType,
        subjectId,
        description: action.replaceAll(".", " "),
        context: { companyId: companyId.toString(), ...detail },
        ipAddress: null,
        userAgent: null,
      });
  }
}
