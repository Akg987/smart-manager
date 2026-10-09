import { createHash, randomBytes } from "node:crypto";
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  max,
  or,
  sql,
} from "drizzle-orm";
import {
  auditLogs,
  businessUnits,
  companies,
  correctiveActions,
  correctiveAlerts,
  departments,
  inboxNotifications,
  type JsonValue,
  type KpiCheckinWorkflowStatus,
  type KpiDirection,
  type KpiHealth,
  kpiManagementCheckins,
  kpiImportRecords,
  kpiImportRuns,
  kpiManagementKpis,
  kpiManagementKpiVersions,
  kpiManagementValues,
  kpiStudioOptions,
  managementDecisions,
  managementObservations,
  memberships,
  redFlagRules,
  redFlags,
  users,
} from "../../../../../src/db/schema.js";
import { BaseRepository } from "../../common/repository/base.repository.js";
import {
  DRIZZLE_DB,
  type DrizzleDatabase,
} from "../../database/database.token.js";
import {
  currentJalaliPeriod,
  jalaliPeriodSeries,
  normalizeJalaliPeriod,
} from "../../shared/jalali.js";
import { AuthorizationService } from "../authorization/authorization.service.js";
import {
  calculateAchievement,
  calculateKpiHealth,
  calculateKpiInput,
  validateReportedUnit,
} from "./kpi-calculation.js";
import { canCloseRedFlag, canReviewCheckin } from "./kpi-workflow.js";
import { matchesRedFlagRule } from "./red-flag-engine.js";
import type { KpiImportRow } from "./kpi-import-parser.js";

@Injectable()
export class KpiManagementRepository extends BaseRepository {
  static health(
    actual: number | null,
    target: number,
    direction: KpiDirection,
    warning: number | null = null,
    critical: number | null = null,
    rangeConfig?: { minimum: number; maximum: number } | null,
  ): KpiHealth {
    if (actual === null) return "unknown";
    const resolvedWarning =
      warning ?? KpiManagementRepository.defaultWarning(target, direction);
    const resolvedCritical =
      critical ?? KpiManagementRepository.defaultCritical(target, direction);
    return calculateKpiHealth({
      actual,
      target,
      direction,
      warning: resolvedWarning,
      critical: resolvedCritical,
      range:
        direction === "range"
          ? (rangeConfig ?? { minimum: target, maximum: target })
          : undefined,
    });
  }

  static defaultWarning(target: number, direction: KpiDirection): number {
    if (direction === "range") return Math.abs(target) * 0.05;
    return direction === "lower" ? target * 1.15 : target * 0.85;
  }
  static defaultCritical(target: number, direction: KpiDirection): number {
    if (direction === "range") return Math.abs(target) * 0.1;
    return direction === "lower" ? target * 1.3 : target * 0.7;
  }
  static normalizeCode(value: string): string {
    return value
      .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
      .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
      .trim()
      .toLowerCase()
      .replace(/[ /]/g, "-")
      .replace(/[^a-z0-9_-]/g, "");
  }
  static validCode(value: string): boolean {
    return /^[a-z][a-z0-9_-]{1,63}$/.test(value);
  }
  static thresholds(
    direction: KpiDirection,
    target: number,
    warning?: number | null,
    critical?: number | null,
  ) {
    const resolvedWarning =
      warning ?? KpiManagementRepository.defaultWarning(target, direction);
    const resolvedCritical =
      critical ?? KpiManagementRepository.defaultCritical(target, direction);
    const inconsistent =
      direction === "range"
        ? resolvedWarning < 0 || resolvedCritical < resolvedWarning
        : direction === "lower"
          ? resolvedCritical < resolvedWarning
          : resolvedCritical > resolvedWarning;
    if (inconsistent)
      throw new BadRequestException(
        "Critical threshold is inconsistent with warning threshold.",
      );
    return { warning: resolvedWarning, critical: resolvedCritical };
  }

  static calculateActualValue(
    inputMode: string,
    supplied: number | null | undefined,
    data: Record<string, unknown> = {},
  ): number | null {
    try {
      return calculateKpiInput({ inputMode, actualValue: supplied, data })
        .numericValue;
    } catch {
      return null;
    }
  }

  static inputFieldsFor(inputMode: string): JsonValue {
    const fields =
      inputMode === "ratio" || inputMode === "percentage"
        ? [
            { key: "numerator", type: "number", required: true },
            { key: "denominator", type: "number", required: true },
          ]
        : inputMode === "checklist"
          ? [
              { key: "completed", type: "number", required: true },
              { key: "total", type: "number", required: true },
            ]
          : inputMode === "formula" || inputMode === "components"
            ? [{ key: "values", type: "number[]", required: true }]
            : ["text", "textarea", "descriptive"].includes(inputMode)
              ? [
                  {
                    key: "actual",
                    type: inputMode === "text" ? "text" : "textarea",
                    required: true,
                  },
                ]
              : inputMode === "select" || inputMode === "multi-select"
                ? [{ key: "actual", type: inputMode, required: true }]
                : [{ key: "actual", type: "number", required: true }];
    return [
      ...fields,
      { key: "note", type: "text", required: false },
    ] as JsonValue;
  }

  constructor(
    @Inject(DRIZZLE_DB) db: DrizzleDatabase,
    private readonly authorization: AuthorizationService,
  ) {
    super(db);
  }

  findImportKpisByCodes(codes: string[], companyId: bigint) {
    if (codes.length === 0) return Promise.resolve([]);
    return this.db
      .select({
        id: kpiManagementKpis.id,
        code: kpiManagementKpis.code,
        unit: kpiManagementKpis.unit,
        inputMode: kpiManagementKpis.inputMode,
        formulaType: kpiManagementKpis.formulaType,
        version: kpiManagementKpis.version,
        holdingId: kpiManagementKpis.holdingId,
        branchId: kpiManagementKpis.branchId,
        businessUnitId: kpiManagementKpis.businessUnitId,
      })
      .from(kpiManagementKpis)
      .where(
        and(
          eq(kpiManagementKpis.companyId, companyId),
          inArray(kpiManagementKpis.code, codes),
          eq(kpiManagementKpis.active, true),
          eq(kpiManagementKpis.status, "published"),
        ),
      );
  }

  listKpiImportRuns(actorId: bigint, companyId: bigint) {
    return this.db
      .select({
        id: kpiImportRuns.id,
        fileName: kpiImportRuns.fileName,
        rowCount: kpiImportRuns.rowCount,
        importedCount: kpiImportRuns.importedCount,
        duplicateCount: kpiImportRuns.duplicateCount,
        rejectedCount: kpiImportRuns.rejectedCount,
        status: kpiImportRuns.status,
        createdAt: kpiImportRuns.createdAt,
      })
      .from(kpiImportRuns)
      .where(
        and(
          eq(kpiImportRuns.actorId, actorId),
          eq(kpiImportRuns.companyId, companyId),
        ),
      )
      .orderBy(desc(kpiImportRuns.createdAt))
      .limit(50);
  }

  async importKpiRows(input: {
    actorId: bigint;
    companyId: bigint;
    fileName: string;
    rows: KpiImportRow[];
    ipAddress: string | null;
    userAgent: string | null;
  }) {
    if (input.rows.length === 0)
      throw new BadRequestException("Import contains no valid rows.");
    const company = await this.db.query.companies.findFirst({
      where: eq(companies.id, input.companyId),
    });
    if (!company)
      throw new NotFoundException("Active company not found.");
    const actorContext = this.authorization.currentContext(input.actorId);
    if (!actorContext)
      throw new ForbiddenException("Permission denied.");
    const fileName = input.fileName
      .replace(/[\\/\u0000-\u001f]/g, "_")
      .slice(-160);
    const run = await this.db
      .insert(kpiImportRuns)
      .values({
        holdingId: company.holdingId,
        companyId: company.id,
        actorId: input.actorId,
        fileName,
        rowCount: input.rows.length,
        status: "failed",
      })
      .returning({ id: kpiImportRuns.id });
    const runId = run[0].id;
    const definitions = await this.findImportKpisByCodes(
      [...new Set(input.rows.map((row) => row.kpiCode))],
      input.companyId,
    );
    const definitionByCode = new Map(definitions.map((item) => [item.code, item]));
    const permissionByKpiId = new Map<string, boolean>();
    let importedCount = 0;
    let duplicateCount = 0;
    const rowResults: Array<{
      rowNumber: number;
      status: "imported" | "duplicate" | "rejected";
      checkinId?: string;
      message?: string;
    }> = [];

    for (const row of input.rows) {
      const definition = definitionByCode.get(row.kpiCode);
      const hasPermission = definition
        ? (permissionByKpiId.has(definition.id.toString())
            ? permissionByKpiId.get(definition.id.toString())
            : await this.authorization.canAccessKpi(
                input.actorId,
                definition.id,
                "kpi.submit",
              )) ?? false
        : false;
      if (definition && !permissionByKpiId.has(definition.id.toString()))
        permissionByKpiId.set(definition.id.toString(), hasPermission);
      if (!definition || !hasPermission) {
        rowResults.push({
          rowNumber: row.rowNumber,
          status: "rejected",
          message: "KPI is unavailable for import in the active company.",
        });
        continue;
      }

      const normalizedSource = row.source.trim().toLowerCase();
      const payloadHash = createHash("sha256")
        .update(
          JSON.stringify({
            kpiId: definition.id.toString(),
            source: normalizedSource,
            externalId: row.externalId,
            period: row.period,
            value: row.value,
            unit: row.unit,
          }),
        )
        .digest("hex");
      try {
        const outcome = await this.db.transaction(async (tx) => {
          const [kpi] = await tx
            .select()
            .from(kpiManagementKpis)
            .where(
              and(
                eq(kpiManagementKpis.id, definition.id),
                eq(kpiManagementKpis.companyId, input.companyId),
                eq(kpiManagementKpis.active, true),
                eq(kpiManagementKpis.status, "published"),
              ),
            )
            .for("update")
            .limit(1);
          if (!kpi) return { status: "rejected" as const, message: "KPI is no longer published." };

          const existingExternal = await tx.query.kpiImportRecords.findFirst({
            where: and(
              eq(kpiImportRecords.companyId, input.companyId),
              eq(kpiImportRecords.source, normalizedSource),
              eq(kpiImportRecords.externalId, row.externalId),
            ),
          });
          if (existingExternal)
            return existingExternal.payloadHash === payloadHash
              ? { status: "duplicate" as const }
              : { status: "rejected" as const, message: "External ID already exists with different data." };

          const existingPeriod = await tx.query.kpiImportRecords.findFirst({
            where: and(
              eq(kpiImportRecords.companyId, input.companyId),
              eq(kpiImportRecords.kpiId, kpi.id),
              eq(kpiImportRecords.period, row.period),
            ),
          });
          if (existingPeriod)
            return { status: "rejected" as const, message: "This KPI period already has an imported value." };
          const existingCheckin = await tx.query.kpiManagementCheckins.findFirst({
            where: and(
              eq(kpiManagementCheckins.kpiId, kpi.id),
              eq(kpiManagementCheckins.period, row.period),
            ),
          });
          if (existingCheckin)
            return { status: "rejected" as const, message: "This KPI period already has a check-in." };
          if (kpi.unit !== row.unit)
            return { status: "rejected" as const, message: "Imported unit does not match the KPI unit; no currency conversion is applied." };
          if (!["numeric", "percentage", "currency", "count", "ratio"].includes(kpi.inputMode))
            return { status: "rejected" as const, message: "This KPI input mode cannot accept a single imported numeric value." };

          let calculation;
          try {
            validateReportedUnit(kpi.unit, row.unit);
            calculation = calculateKpiInput({
              inputMode: kpi.inputMode,
              actualValue: Number(row.value),
              data: { actual: Number(row.value) },
              inputOptions: [],
              formulaType: kpi.formulaType,
            });
          } catch (error) {
            return {
              status: "rejected" as const,
              message: error instanceof Error ? error.message : "Imported value is invalid.",
            };
          }
          if (calculation.numericValue === null)
            return { status: "rejected" as const, message: "Imported value is missing." };

          const insertedRecord = await tx
            .insert(kpiImportRecords)
            .values({
              runId,
              holdingId: kpi.holdingId,
              companyId: kpi.companyId,
              branchId: kpi.branchId,
              businessUnitId: kpi.businessUnitId,
              kpiId: kpi.id,
              externalId: row.externalId,
              source: normalizedSource,
              period: row.period,
              value: row.value,
              unit: row.unit,
              payloadHash,
              kpiVersion: kpi.version,
            })
            .onConflictDoNothing()
            .returning({ id: kpiImportRecords.id });
          if (insertedRecord.length === 0)
            return { status: "rejected" as const, message: "A concurrent import already claimed this source record or KPI period." };

          const submittedAt = new Date();
          const dataState =
            calculation.numericValue === 0
              ? "zero"
              : kpi.submissionDeadline &&
                  submittedAt.toISOString().slice(0, 10) > kpi.submissionDeadline
                ? "late"
                : "valid";
          const checkin = await tx
            .insert(kpiManagementCheckins)
            .values({
              kpiId: kpi.id,
              userId: input.actorId,
              period: row.period,
              status: "data_submitted",
              dataJson: {
                actual: calculation.value,
                unit: kpi.unit,
                dataState,
                source: normalizedSource,
                externalId: row.externalId,
                importRunId: runId.toString(),
                kpiVersion: kpi.version,
              } as JsonValue,
              actualValue: String(calculation.numericValue),
              note: "Imported from external source.",
              blockers: "",
              submittedAt,
              updatedAt: submittedAt,
            })
            .returning({ id: kpiManagementCheckins.id });
          await tx
            .update(kpiImportRecords)
            .set({ checkinId: checkin[0].id })
            .where(eq(kpiImportRecords.id, insertedRecord[0].id));
          await tx.insert(auditLogs).values({
            userId: input.actorId,
            holdingId: kpi.holdingId,
            companyId: kpi.companyId,
            membershipId: BigInt(actorContext.membershipId),
            actorName: "System",
            action: "kpi.import.row",
            subjectType: "KpiImportRecord",
            subjectId: insertedRecord[0].id,
            description: "KPI data row imported and submitted for review",
            context: {
              runId: runId.toString(),
              checkinId: checkin[0].id.toString(),
              kpiId: kpi.id.toString(),
              period: row.period,
              source: normalizedSource,
              externalId: row.externalId,
              version: kpi.version,
              unit: kpi.unit,
              value: row.value,
              dataState,
            },
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
          });
          return { status: "imported" as const, checkinId: checkin[0].id.toString() };
        });
        if (outcome.status === "imported") importedCount += 1;
        else if (outcome.status === "duplicate") duplicateCount += 1;
        rowResults.push({ rowNumber: row.rowNumber, ...outcome });
        const progressRejectedCount =
          rowResults.length - importedCount - duplicateCount;
        await this.db
          .update(kpiImportRuns)
          .set({
            importedCount,
            duplicateCount,
            rejectedCount: progressRejectedCount,
            status:
              progressRejectedCount === 0
                ? "completed"
                : importedCount > 0 || duplicateCount > 0
                  ? "partial"
                  : "failed",
          })
          .where(eq(kpiImportRuns.id, runId));
      } catch {
        rowResults.push({
          rowNumber: row.rowNumber,
          status: "rejected",
          message: "Import row conflicted with a concurrent update or database constraint.",
        });
      }
    }

    const rejectedCount = rowResults.length - importedCount - duplicateCount;
    const status =
      rejectedCount === 0
        ? "completed"
        : importedCount > 0 || duplicateCount > 0
          ? "partial"
          : "failed";
    await this.db.transaction(async (tx) => {
      await tx
        .update(kpiImportRuns)
        .set({ importedCount, duplicateCount, rejectedCount, status })
        .where(eq(kpiImportRuns.id, runId));
      const context = this.authorization.currentContext(input.actorId);
      await tx.insert(auditLogs).values({
        userId: input.actorId,
        holdingId: company.holdingId,
        companyId: company.id,
        membershipId: context ? BigInt(context.membershipId) : null,
        actorName: "System",
        action: "kpi.import.completed",
        subjectType: "KpiImportRun",
        subjectId: runId,
        description: "KPI data import run completed",
        context: {
          importedCount,
          duplicateCount,
          rejectedCount,
          status,
          rows: rowResults,
        },
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      });
    });
    return {
      runId: runId.toString(),
      status,
      importedCount,
      duplicateCount,
      rejectedCount,
      rows: rowResults,
    };
  }

  async listStudioOptions(group: "input_mode" | "direction" | "frequency") {
    return this.db
      .select()
      .from(kpiStudioOptions)
      .where(eq(kpiStudioOptions.group, group))
      .orderBy(asc(kpiStudioOptions.position), asc(kpiStudioOptions.id));
  }

  async defaultStudioSlug(group: "input_mode" | "direction" | "frequency") {
    const preferred = {
      input_mode: "direct",
      direction: "higher",
      frequency: "weekly",
    }[group];
    const [match] = await this.db
      .select({ slug: kpiStudioOptions.slug })
      .from(kpiStudioOptions)
      .where(
        and(
          eq(kpiStudioOptions.group, group),
          eq(kpiStudioOptions.slug, preferred),
        ),
      )
      .limit(1);
    if (match) return match.slug;
    return (await this.listStudioOptions(group))[0]?.slug ?? "";
  }

  async addStudioOption(
    group: "input_mode" | "direction" | "frequency",
    name: string,
  ) {
    if (!name.trim()) throw new BadRequestException("Option name is required.");
    return this.db.transaction(async (tx) => {
      const base =
        KpiManagementRepository.normalizeCode(name) ||
        `${group}-${randomBytes(3).toString("hex")}`;
      let slug = base;
      let suffix = 2;
      while (
        (
          await tx
            .select({ id: kpiStudioOptions.id })
            .from(kpiStudioOptions)
            .where(
              and(
                eq(kpiStudioOptions.group, group),
                eq(kpiStudioOptions.slug, slug),
              ),
            )
            .limit(1)
        ).length
      )
        slug = `${base}-${suffix++}`;
      const [position] = await tx
        .select({ value: max(kpiStudioOptions.position) })
        .from(kpiStudioOptions)
        .where(eq(kpiStudioOptions.group, group));
      return (
        await tx
          .insert(kpiStudioOptions)
          .values({
            group,
            name: name.trim().slice(0, 80),
            slug: slug.slice(0, 64),
            position: (position.value ?? 0) + 1,
          })
          .returning()
      )[0];
    });
  }

  async deleteStudioOption(optionId: bigint) {
    const [option] = await this.db
      .delete(kpiStudioOptions)
      .where(eq(kpiStudioOptions.id, optionId))
      .returning();
    if (!option) throw new NotFoundException("KPI option not found.");
    return option;
  }

  async renameStudioOption(optionId: bigint, name: string) {
    return this.db.transaction(async (tx) => {
      const [option] = await tx
        .select()
        .from(kpiStudioOptions)
        .where(eq(kpiStudioOptions.id, optionId))
        .for("update")
        .limit(1);
      if (!option) throw new NotFoundException("KPI option not found.");
      if (option.group === "frequency" && option.name !== name)
        await tx
          .update(kpiManagementKpis)
          .set({ frequency: name, updatedAt: new Date() })
          .where(eq(kpiManagementKpis.frequency, option.name));
      return (
        await tx
          .update(kpiStudioOptions)
          .set({ name: name.trim().slice(0, 80), updatedAt: new Date() })
          .where(eq(kpiStudioOptions.id, option.id))
          .returning()
      )[0];
    });
  }

  async createForm(actorId: bigint) {
    if (!(await this.authorization.hasPermission(actorId, "kpi.create")))
      throw new ForbiddenException("KPI management permission is required.");
    const context = this.authorization.currentContext(actorId);
    if (!context?.companyId)
      throw new ForbiddenException("Select an active company membership.");
    const companyId = BigInt(context.companyId);
    const [company] = await this.db
      .select({
        id: companies.id,
        name: companies.name,
        holdingId: companies.holdingId,
      })
      .from(companies)
      .where(and(eq(companies.id, companyId), eq(companies.status, "active")))
      .limit(1);
    if (!company) throw new NotFoundException("Active company not found.");
    const unitCandidates = await this.db
      .select({
        id: businessUnits.id,
        name: businessUnits.name,
        branchId: businessUnits.branchId,
        domain: businessUnits.domain,
      })
      .from(businessUnits)
      .where(
        and(
          eq(businessUnits.companyId, companyId),
          eq(businessUnits.status, "active"),
        ),
      )
      .orderBy(asc(businessUnits.name));
    const units = (
      await Promise.all(
        unitCandidates.map(async (unit) => {
          const allowed = await this.authorization.can(context, "kpi.create", {
            holdingId: company.holdingId.toString(),
            companyId: companyId.toString(),
            branchId: unit.branchId?.toString() ?? null,
            businessUnitId: unit.id.toString(),
            domain: unit.domain,
          });
          return allowed ? unit : null;
        }),
      )
    ).filter((unit): unit is (typeof unitCandidates)[number] => unit !== null);
    const peopleRows = await this.db
      .selectDistinct({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        mobile: users.mobile,
      })
      .from(users)
      .innerJoin(memberships, eq(memberships.userId, users.id))
      .where(
        and(
          eq(memberships.companyId, companyId),
          eq(memberships.holdingId, company.holdingId),
          eq(memberships.status, "active"),
          isNotNull(users.approvedAt),
        ),
      )
      .orderBy(asc(users.firstName), asc(users.lastName), asc(users.id));
    const [inputModes, directions, frequencies] = await Promise.all([
      this.listStudioOptions("input_mode"),
      this.listStudioOptions("direction"),
      this.listStudioOptions("frequency"),
    ]);
    const option = (row: { slug: string; name: string }) => ({
      slug: row.slug,
      name: row.name,
    });
    const supportedInputModes = new Set([
      "direct",
      "numeric",
      "count",
      "currency",
      "ratio",
      "percentage",
      "text",
      "textarea",
      "select",
      "multi-select",
      "formula",
      "descriptive",
      "checklist",
      "components",
    ]);
    return {
      actorId: actorId.toString(),
      company: { id: company.id.toString(), name: company.name },
      businessUnits: units.map((unit) => ({
        id: unit.id.toString(),
        name: unit.name,
      })),
      people: peopleRows.map((person) => ({
        id: person.id.toString(),
        firstName: person.firstName ?? "",
        lastName: person.lastName ?? "",
        mobile: person.mobile,
      })),
      inputModes: inputModes
        .filter((row) => supportedInputModes.has(row.slug))
        .map(option),
      directions: directions
        .filter((row) => ["higher", "lower", "range"].includes(row.slug))
        .map(option),
      frequencies: frequencies.map(option),
    };
  }
  async createDefinition(input: {
    actorId: bigint;
    businessUnitId?: bigint | null;
    code?: string;
    name: string;
    description?: string;
    category?: string;
    unit?: string;
    direction: KpiDirection;
    targetValue: number;
    warningValue?: number | null;
    criticalValue?: number | null;
    ownerUserId?: bigint | null;
    reporterUserId?: bigint | null;
    dataOwnerUserId?: bigint | null;
    reviewerUserId?: bigint | null;
    source?: string;
    domain?: string;
    frequency?: string;
    inputMode?: string;
    inputOptions?: string[];
    formulaType?: string;
    formulaConfig?: Record<string, unknown> | null;
    rangeConfig?: { minimum: number; maximum: number } | null;
    reportingPeriod?: string;
    submissionDeadline?: string | null;
    effectiveFrom?: string;
    weight?: number;
    active?: boolean;
  }) {
    if (!(await this.authorization.hasPermission(input.actorId, "kpi.create")))
      throw new ForbiddenException("KPI management permission is required.");
    const name = input.name.trim();
    if (!name) throw new BadRequestException("KPI name is required.");
    const context = this.authorization.currentContext(input.actorId);
    if (!context?.companyId)
      throw new ForbiddenException("Select an active company membership.");
    const [company] = await this.db
      .select({ id: companies.id, holdingId: companies.holdingId })
      .from(companies)
      .where(
        and(
          eq(companies.id, BigInt(context.companyId)),
          eq(companies.status, "active"),
        ),
      )
      .limit(1);
    if (!company)
      throw new BadRequestException("The active company does not exist.");
    const businessUnitId =
      input.businessUnitId ??
      (context.businessUnitId ? BigInt(context.businessUnitId) : null);
    const [businessUnit] =
      businessUnitId === null
        ? [null]
        : await this.db
            .select({
              id: businessUnits.id,
              branchId: businessUnits.branchId,
              domain: businessUnits.domain,
            })
            .from(businessUnits)
            .where(
              and(
                eq(businessUnits.id, businessUnitId),
                eq(businessUnits.companyId, BigInt(context.companyId)),
                eq(businessUnits.status, "active"),
              ),
            )
            .limit(1);
    if (businessUnitId !== null && !businessUnit)
      throw new BadRequestException(
        "The selected Business Unit is not active in this company.",
      );
    const resource = {
      holdingId: company.holdingId.toString(),
      companyId: context.companyId,
      branchId: businessUnit?.branchId?.toString() ?? null,
      businessUnitId: businessUnit?.id.toString() ?? null,
      domain: businessUnit?.domain ?? null,
    };
    if (!(await this.authorization.can(context, "kpi.create", resource)))
      throw new ForbiddenException(
        "KPI creation is outside the active membership scope.",
      );
    if (
      !Number.isFinite(input.targetValue) ||
      input.targetValue <= 0 ||
      (input.weight !== undefined && (input.weight <= 0 || input.weight > 10))
    )
      throw new BadRequestException("Invalid KPI target or weight.");
    const { warning, critical } = KpiManagementRepository.thresholds(
      input.direction,
      input.targetValue,
      input.warningValue,
      input.criticalValue,
    );
    const frequencyOptions = await this.listStudioOptions("frequency");
    const requestedFrequency = (input.frequency ?? "").trim();
    const frequencyMatch = frequencyOptions.find(
      (option) =>
        option.slug === requestedFrequency ||
        option.name === requestedFrequency,
    );
    const frequency = (
      frequencyMatch?.name ||
      requestedFrequency ||
      "هفتگی"
    ).slice(0, 50);
    const modeOptions = await this.listStudioOptions("input_mode");
    const requestedMode = (input.inputMode ?? "").trim();
    const modeMatch = modeOptions.find(
      (option) =>
        option.slug === requestedMode || option.name === requestedMode,
    );
    if (requestedMode && modeOptions.length > 0 && !modeMatch)
      throw new BadRequestException("Unknown input mode.");
    const inputMode = (modeMatch?.slug || requestedMode || "direct").slice(
      0,
      64,
    );
    if (
      !new Set([
        "direct",
        "numeric",
        "count",
        "currency",
        "ratio",
        "percentage",
        "text",
        "textarea",
        "select",
        "multi-select",
        "descriptive",
        "checklist",
        "formula",
        "components",
      ]).has(inputMode)
    )
      throw new BadRequestException("Unsupported KPI input mode.");
    const formulaType =
      input.formulaType ??
      (inputMode === "ratio" ||
      inputMode === "percentage" ||
      inputMode === "checklist"
        ? inputMode
        : inputMode === "formula" || inputMode === "components"
          ? "sum"
          : "direct");
    if (
      (inputMode === "formula" || inputMode === "components") &&
      ![
        "sum",
        "average",
        "product",
        "difference",
        "ratio",
        "percentage",
      ].includes(formulaType)
    )
      throw new BadRequestException("Unsupported KPI formula operation.");
    if (
      (inputMode === "select" || inputMode === "multi-select") &&
      !input.inputOptions?.length
    )
      throw new BadRequestException(
        "Select KPI inputs require at least one configured option.",
      );
    if (
      input.direction === "range" &&
      (!input.rangeConfig ||
        !Number.isFinite(input.rangeConfig.minimum) ||
        !Number.isFinite(input.rangeConfig.maximum) ||
        input.rangeConfig.minimum > input.rangeConfig.maximum)
    )
      throw new BadRequestException(
        "A valid range is required for range-direction KPIs.",
      );
    const unit = (input.unit ?? "").trim().slice(0, 80) || "عدد";
    return this.db.transaction(async (tx) => {
      const ownerId = input.ownerUserId ?? input.actorId;
      const reporterId = input.reporterUserId ?? input.actorId;
      const dataOwnerId = input.dataOwnerUserId ?? ownerId;
      const reviewerId = input.reviewerUserId ?? ownerId;
      for (const userId of new Set([
        ownerId,
        reporterId,
        dataOwnerId,
        ...(reviewerId === null ? [] : [reviewerId]),
      ])) {
        const [person] = await tx
          .select({ approvedAt: users.approvedAt })
          .from(users)
          .innerJoin(memberships, eq(memberships.userId, users.id))
          .where(
            and(
              eq(users.id, userId),
              eq(memberships.companyId, company.id),
              eq(memberships.holdingId, company.holdingId),
              eq(memberships.status, "active"),
              ...(businessUnitId === null
                ? []
                : [eq(memberships.businessUnitId, businessUnitId)]),
            ),
          )
          .limit(1);
        if (!person?.approvedAt)
          throw new BadRequestException(
            "KPI owner and reporter must be approved members of the selected company.",
          );
      }
      let code = KpiManagementRepository.normalizeCode(input.code ?? "");
      if (
        !KpiManagementRepository.validCode(code) ||
        (
          await tx
            .select({ id: kpiManagementKpis.id })
            .from(kpiManagementKpis)
            .where(
              and(
                eq(kpiManagementKpis.companyId, company.id),
                eq(kpiManagementKpis.code, code),
              ),
            )
            .limit(1)
        ).length
      ) {
        do {
          code = `kpi-${randomBytes(4).toString("hex")}`;
        } while (
          (
            await tx
              .select({ id: kpiManagementKpis.id })
              .from(kpiManagementKpis)
              .where(
                and(
                  eq(kpiManagementKpis.companyId, company.id),
                  eq(kpiManagementKpis.code, code),
                ),
              )
              .limit(1)
          ).length
        );
      }
      const inputFields = KpiManagementRepository.inputFieldsFor(inputMode);
      const [kpi] = await tx
        .insert(kpiManagementKpis)
        .values({
          holdingId: company.holdingId,
          companyId: company.id,
          branchId: businessUnit?.branchId ?? null,
          businessUnitId: businessUnit?.id ?? null,
          departmentId: null,
          code,
          name: name.slice(0, 200),
          description: input.description ?? "",
          domain:
            input.domain?.trim().slice(0, 80) || businessUnit?.domain || null,
          category: input.category ?? "عملکرد",
          unit,
          direction: input.direction,
          formulaType,
          targetValue: String(input.targetValue),
          warningValue: String(warning),
          criticalValue: String(critical),
          ownerUserId: ownerId,
          dataOwnerUserId: dataOwnerId,
          reporterUserId: reporterId,
          reviewerUserId: reviewerId,
          source: input.source?.trim().slice(0, 160) || "manual",
          reportingPeriod: (input.reportingPeriod ?? "monthly").slice(0, 32),
          submissionDeadline: input.submissionDeadline ?? null,
          effectiveFrom:
            input.effectiveFrom ?? new Date().toISOString().slice(0, 10),
          frequency,
          inputMode,
          inputFields,
          inputOptions: (input.inputOptions ?? []) as JsonValue,
          formulaConfig: (input.formulaConfig ?? null) as JsonValue,
          rangeConfig: (input.rangeConfig ?? null) as JsonValue,
          weight: String(input.weight ?? 1),
          active: input.active ?? true,
          status: "draft",
        })
        .returning();
      await tx.insert(kpiManagementKpiVersions).values({
        kpiId: kpi.id,
        version: 1,
        definition: {
          code,
          name: kpi.name,
          description: kpi.description,
          domain: kpi.domain,
          category: kpi.category,
          unit: kpi.unit,
          direction: kpi.direction,
          targetValue: kpi.targetValue,
          warningValue: kpi.warningValue,
          criticalValue: kpi.criticalValue,
          inputMode: kpi.inputMode,
          inputOptions: kpi.inputOptions,
          formulaType: kpi.formulaType,
          formulaConfig: kpi.formulaConfig,
          rangeConfig: kpi.rangeConfig,
          inputFields: kpi.inputFields,
          ownerUserId: kpi.ownerUserId?.toString() ?? null,
          dataOwnerUserId: kpi.dataOwnerUserId?.toString() ?? null,
          reporterUserId: kpi.reporterUserId?.toString() ?? null,
          reviewerUserId: kpi.reviewerUserId?.toString() ?? null,
          source: kpi.source,
          reportingPeriod: kpi.reportingPeriod,
          submissionDeadline: kpi.submissionDeadline,
          companyId: kpi.companyId.toString(),
          branchId: kpi.branchId?.toString() ?? null,
          businessUnitId: kpi.businessUnitId?.toString() ?? null,
        },
        effectiveFrom: kpi.effectiveFrom,
        createdBy: input.actorId,
      });
      await tx.insert(auditLogs).values({
        userId: input.actorId,
        holdingId: kpi.holdingId,
        companyId: kpi.companyId,
        membershipId: this.authorization.currentContext(input.actorId)
          ? BigInt(
              this.authorization.currentContext(input.actorId)!.membershipId,
            )
          : null,
        actorName: "System",
        action: "kpi.created",
        subjectType: "KpiDefinition",
        subjectId: kpi.id,
        description: `شاخص «${kpi.name}» ایجاد شد.`,
        context: {
          code,
          holdingId: kpi.holdingId.toString(),
          companyId: kpi.companyId.toString(),
          businessUnitId: kpi.businessUnitId?.toString() ?? null,
          version: kpi.version,
          targetValue: kpi.targetValue,
          warningValue: kpi.warningValue,
          criticalValue: kpi.criticalValue,
          unit: kpi.unit,
          ownerUserId: kpi.ownerUserId?.toString() ?? null,
          dataOwnerUserId: kpi.dataOwnerUserId?.toString() ?? null,
          reporterUserId: kpi.reporterUserId?.toString() ?? null,
          reviewerUserId: kpi.reviewerUserId?.toString() ?? null,
        },
        ipAddress: null,
        userAgent: null,
      });
      return kpi;
    });
  }

  async updateDefinition(
    kpiId: bigint,
    actorId: bigint,
    input: {
      code: string;
      name: string;
      description?: string;
      category?: string;
      unit?: string;
      direction: KpiDirection;
      targetValue: number;
      warningValue?: number | null;
      criticalValue?: number | null;
      ownerUserId?: bigint | null;
      dataOwnerUserId?: bigint | null;
      reporterUserId?: bigint | null;
      reviewerUserId?: bigint | null;
      domain?: string;
      source?: string;
      inputMode?: string;
      inputOptions?: string[];
      formulaType?: string;
      formulaConfig?: Record<string, unknown> | null;
      rangeConfig?: { minimum: number; maximum: number } | null;
      reportingPeriod?: string;
      submissionDeadline?: string | null;
      effectiveFrom?: string;
      frequency?: string;
      weight?: number;
      active?: boolean;
    },
  ) {
    if (!(await this.authorization.hasPermission(actorId, "kpi.update")))
      throw new ForbiddenException("KPI management permission is required.");
    return this.db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(kpiManagementKpis)
        .where(eq(kpiManagementKpis.id, kpiId))
        .for("update")
        .limit(1);
      if (!current) throw new NotFoundException("KPI not found.");
      if (
        !(await this.authorization.canAccessKpi(actorId, kpiId, "kpi.update"))
      )
        throw new ForbiddenException("KPI access denied.");
      const code = KpiManagementRepository.normalizeCode(input.code);
      if (!KpiManagementRepository.validCode(code))
        throw new BadRequestException("Invalid KPI code.");
      const [duplicate] = await tx
        .select({ id: kpiManagementKpis.id })
        .from(kpiManagementKpis)
        .where(
          and(
            eq(kpiManagementKpis.code, code),
            sql`${kpiManagementKpis.id} <> ${kpiId}`,
          ),
        )
        .limit(1);
      if (duplicate)
        throw new BadRequestException("KPI code is already in use.");
      if (
        !Number.isFinite(input.targetValue) ||
        input.targetValue <= 0 ||
        (input.weight !== undefined && (input.weight <= 0 || input.weight > 10))
      )
        throw new BadRequestException("Invalid KPI target or weight.");
      const { warning, critical } = KpiManagementRepository.thresholds(
        input.direction,
        input.targetValue,
        input.warningValue,
        input.criticalValue,
      );
      const inputMode = input.inputMode ?? current.inputMode;
      if (
        !new Set([
          "direct",
          "numeric",
          "count",
          "currency",
          "ratio",
          "percentage",
          "text",
          "textarea",
          "select",
          "multi-select",
          "descriptive",
          "checklist",
          "formula",
          "components",
        ]).has(inputMode)
      )
        throw new BadRequestException("Unsupported KPI input mode.");
      const formulaType = input.formulaType ?? current.formulaType;
      if (
        (inputMode === "formula" || inputMode === "components") &&
        ![
          "sum",
          "average",
          "product",
          "difference",
          "ratio",
          "percentage",
        ].includes(formulaType)
      )
        throw new BadRequestException("Unsupported KPI formula operation.");
      const configuredOptions =
        input.inputOptions ??
        (Array.isArray(current.inputOptions)
          ? current.inputOptions.filter(
              (value): value is string => typeof value === "string",
            )
          : []);
      if (
        ["select", "multi-select"].includes(inputMode) &&
        !configuredOptions.length
      )
        throw new BadRequestException(
          "Select KPI inputs require configured options.",
        );
      const rangeConfig =
        input.rangeConfig ??
        (current.rangeConfig as { minimum: number; maximum: number } | null);
      if (
        input.direction === "range" &&
        (!rangeConfig || rangeConfig.minimum > rangeConfig.maximum)
      )
        throw new BadRequestException(
          "A valid range is required for range-direction KPIs.",
        );
      const ownerId = input.ownerUserId ?? current.ownerUserId;
      const dataOwnerId =
        input.dataOwnerUserId === undefined
          ? current.dataOwnerUserId
          : input.dataOwnerUserId;
      const reporterId =
        input.reporterUserId === undefined
          ? current.reporterUserId
          : input.reporterUserId;
      const reviewerId =
        input.reviewerUserId === undefined
          ? current.reviewerUserId
          : input.reviewerUserId;
      for (const assignedUserId of new Set(
        [ownerId, dataOwnerId, reporterId, reviewerId].filter(
          (id): id is bigint => id !== null,
        ),
      )) {
        const [person] = await tx
          .select({ approvedAt: users.approvedAt })
          .from(users)
          .innerJoin(memberships, eq(memberships.userId, users.id))
          .where(
            and(
              eq(users.id, assignedUserId),
              eq(memberships.companyId, current.companyId),
              eq(memberships.holdingId, current.holdingId),
              eq(memberships.status, "active"),
              ...(current.businessUnitId === null
                ? []
                : [eq(memberships.businessUnitId, current.businessUnitId)]),
            ),
          )
          .limit(1);
        if (!person?.approvedAt)
          throw new BadRequestException(
            "KPI owners, reporters and reviewers must be approved members of the KPI company.",
          );
      }
      const [updated] = await tx
        .update(kpiManagementKpis)
        .set({
          code,
          name: input.name.slice(0, 200),
          description: input.description ?? current.description,
          domain: input.domain ?? current.domain,
          category: input.category ?? current.category,
          unit: input.unit ?? current.unit,
          source: input.source ?? current.source,
          direction: input.direction,
          targetValue: String(input.targetValue),
          warningValue: String(warning),
          criticalValue: String(critical),
          ownerUserId: ownerId,
          dataOwnerUserId: dataOwnerId,
          reporterUserId: reporterId,
          reviewerUserId: reviewerId,
          inputMode,
          inputOptions: configuredOptions as JsonValue,
          formulaType,
          formulaConfig: (input.formulaConfig === undefined
            ? current.formulaConfig
            : input.formulaConfig) as JsonValue,
          rangeConfig: (rangeConfig ?? null) as JsonValue,
          inputFields: input.inputMode
            ? KpiManagementRepository.inputFieldsFor(inputMode)
            : current.inputFields,
          reportingPeriod: input.reportingPeriod ?? current.reportingPeriod,
          submissionDeadline:
            input.submissionDeadline === undefined
              ? current.submissionDeadline
              : input.submissionDeadline,
          frequency: input.frequency ?? current.frequency,
          weight: String(input.weight ?? current.weight),
          active: input.active ?? current.active,
          version: current.version + 1,
          status: "draft",
          effectiveFrom:
            input.effectiveFrom ?? new Date().toISOString().slice(0, 10),
          updatedAt: new Date(),
        })
        .where(eq(kpiManagementKpis.id, kpiId))
        .returning();
      await tx.insert(kpiManagementKpiVersions).values({
        kpiId,
        version: updated.version,
        definition: {
          code: updated.code,
          name: updated.name,
          description: updated.description,
          domain: updated.domain,
          category: updated.category,
          unit: updated.unit,
          direction: updated.direction,
          targetValue: updated.targetValue,
          warningValue: updated.warningValue,
          criticalValue: updated.criticalValue,
          inputMode: updated.inputMode,
          inputOptions: updated.inputOptions,
          formulaType: updated.formulaType,
          formulaConfig: updated.formulaConfig,
          rangeConfig: updated.rangeConfig,
          inputFields: updated.inputFields,
          ownerUserId: updated.ownerUserId?.toString() ?? null,
          dataOwnerUserId: updated.dataOwnerUserId?.toString() ?? null,
          reporterUserId: updated.reporterUserId?.toString() ?? null,
          reviewerUserId: updated.reviewerUserId?.toString() ?? null,
          source: updated.source,
          reportingPeriod: updated.reportingPeriod,
          submissionDeadline: updated.submissionDeadline,
          companyId: updated.companyId.toString(),
          branchId: updated.branchId?.toString() ?? null,
          businessUnitId: updated.businessUnitId?.toString() ?? null,
        },
        effectiveFrom: updated.effectiveFrom,
        createdBy: actorId,
      });
      await tx.insert(auditLogs).values({
        userId: actorId,
        holdingId: updated.holdingId,
        companyId: updated.companyId,
        membershipId: this.authorization.currentContext(actorId)
          ? BigInt(this.authorization.currentContext(actorId)!.membershipId)
          : null,
        actorName: "System",
        action: "kpi.updated",
        subjectType: "KpiDefinition",
        subjectId: kpiId,
        description: `شاخص «${updated.name}» ویرایش شد.`,
        context: {
          code,
          version: updated.version,
          companyId: updated.companyId.toString(),
          before: {
            name: current.name,
            description: current.description,
            unit: current.unit,
            direction: current.direction,
            targetValue: current.targetValue,
            warningValue: current.warningValue,
            criticalValue: current.criticalValue,
            inputMode: current.inputMode,
            formulaType: current.formulaType,
            ownerUserId: current.ownerUserId?.toString() ?? null,
          },
          after: {
            name: updated.name,
            description: updated.description,
            unit: updated.unit,
            direction: updated.direction,
            targetValue: updated.targetValue,
            warningValue: updated.warningValue,
            criticalValue: updated.criticalValue,
            inputMode: updated.inputMode,
            formulaType: updated.formulaType,
            ownerUserId: updated.ownerUserId?.toString() ?? null,
          },
        },
        ipAddress: null,
        userAgent: null,
      });
      return updated;
    });
  }

  async submitDefinitionForReview(kpiId: bigint, actorId: bigint) {
    const [kpi] = await this.db
      .select()
      .from(kpiManagementKpis)
      .where(eq(kpiManagementKpis.id, kpiId))
      .limit(1);
    if (!kpi) throw new NotFoundException("KPI not found.");
    if (!(await this.authorization.canAccessKpi(actorId, kpiId, "kpi.update")))
      throw new ForbiddenException("KPI update permission is required.");
    if (kpi.status !== "draft")
      throw new BadRequestException(
        "Only draft KPI definitions can be submitted for review.",
      );
    if (
      !kpi.name.trim() ||
      !kpi.code.trim() ||
      !kpi.unit.trim() ||
      !kpi.source.trim() ||
      !kpi.frequency.trim() ||
      !kpi.reportingPeriod.trim() ||
      Number(kpi.targetValue) <= 0 ||
      !kpi.ownerUserId ||
      !kpi.dataOwnerUserId ||
      !kpi.reporterUserId ||
      !kpi.reviewerUserId ||
      !kpi.inputMode
    )
      throw new BadRequestException(
        "Complete the KPI definition, scope, owners, input mode and thresholds before review.",
      );
    if (kpi.direction === "range" && !kpi.rangeConfig)
      throw new BadRequestException(
        "Configure the KPI custom range before review.",
      );
    const [updated] = await this.db
      .update(kpiManagementKpis)
      .set({ status: "reviewed", updatedAt: new Date() })
      .where(eq(kpiManagementKpis.id, kpiId))
      .returning();
    await this.db.insert(auditLogs).values({
      userId: actorId,
      holdingId: kpi.holdingId,
      companyId: kpi.companyId,
      membershipId: this.authorization.currentContext(actorId)
        ? BigInt(this.authorization.currentContext(actorId)!.membershipId)
        : null,
      actorName: "System",
      action: "kpi.definition.submitted",
      subjectType: "KpiDefinition",
      subjectId: kpiId,
      description: "KPI definition submitted for review",
      context: { companyId: kpi.companyId.toString(), version: kpi.version },
      ipAddress: null,
      userAgent: null,
    });
    return updated;
  }

  async publishDefinition(kpiId: bigint, actorId: bigint) {
    return this.db.transaction(async (tx) => {
      const [kpi] = await tx
        .select()
        .from(kpiManagementKpis)
        .where(eq(kpiManagementKpis.id, kpiId))
        .for("update")
        .limit(1);
      if (!kpi) throw new NotFoundException("KPI not found.");
      if (
        !(await this.authorization.canAccessKpi(actorId, kpiId, "kpi.approve"))
      )
        throw new ForbiddenException("KPI approval permission is required.");
      if (kpi.status !== "reviewed")
        throw new BadRequestException(
          "Only reviewed KPI definitions can be published.",
        );
      const [version] = await tx
        .select({ createdBy: kpiManagementKpiVersions.createdBy })
        .from(kpiManagementKpiVersions)
        .where(
          and(
            eq(kpiManagementKpiVersions.kpiId, kpiId),
            eq(kpiManagementKpiVersions.version, kpi.version),
          ),
        )
        .limit(1);
      if (version?.createdBy === actorId)
        throw new ForbiddenException(
          "The definition author cannot publish their own KPI definition.",
        );
      const [updated] = await tx
        .update(kpiManagementKpis)
        .set({ status: "published", updatedAt: new Date() })
        .where(eq(kpiManagementKpis.id, kpiId))
        .returning();
      await tx.insert(auditLogs).values({
        userId: actorId,
        holdingId: kpi.holdingId,
        companyId: kpi.companyId,
        membershipId: this.authorization.currentContext(actorId)
          ? BigInt(this.authorization.currentContext(actorId)!.membershipId)
          : null,
        actorName: "System",
        action: "kpi.definition.published",
        subjectType: "KpiDefinition",
        subjectId: kpiId,
        description: "KPI definition published",
        context: {
          companyId: kpi.companyId.toString(),
          version: kpi.version,
        },
        ipAddress: null,
        userAgent: null,
      });
      return updated;
    });
  }

  async dashboardSnapshot(userId: bigint) {
    const [viewer] = await this.db
      .select({
        departmentId: users.departmentId,
        approvedAt: users.approvedAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!viewer?.approvedAt) return null;
    const period = currentJalaliPeriod();
    const candidates = await this.db
      .select()
      .from(kpiManagementKpis)
      .where(
        and(
          eq(kpiManagementKpis.active, true),
          eq(kpiManagementKpis.status, "published"),
        ),
      )
      .orderBy(asc(kpiManagementKpis.name))
      .limit(500);
    const visible = (
      await Promise.all(
        candidates.map(async (kpi) =>
          (await this.authorization.canAccessKpi(userId, kpi.id, "kpi.view"))
            ? kpi
            : null,
        ),
      )
    ).filter((kpi): kpi is (typeof candidates)[number] => kpi !== null);
    const ids = visible.map(({ id }) => id);
    const values = ids.length
      ? await this.db
          .select()
          .from(kpiManagementValues)
          .where(inArray(kpiManagementValues.kpiId, ids))
          .orderBy(
            desc(kpiManagementValues.period),
            desc(kpiManagementValues.createdAt),
            desc(kpiManagementValues.id),
          )
      : [];
    const latest = new Map<bigint, (typeof values)[number]>();
    const currentValues = new Map<bigint, (typeof values)[number]>();
    const submittedIds = new Set<bigint>();
    for (const value of values) {
      if (value.period === period) submittedIds.add(value.kpiId);
      if (value.period === period && !currentValues.has(value.kpiId))
        currentValues.set(value.kpiId, value);
      if (!latest.has(value.kpiId)) latest.set(value.kpiId, value);
    }
    const counts = { green: 0, yellow: 0, red: 0, unknown: 0 };
    for (const kpi of visible) {
      const health = currentValues.get(kpi.id)?.status ?? "unknown";
      counts[health in counts ? (health as keyof typeof counts) : "unknown"]++;
    }
    const total = visible.length;
    const submitted = submittedIds.size;
    const staleCount = visible.filter(
      (kpi) => !currentValues.has(kpi.id) && latest.has(kpi.id),
    ).length;
    const missingCount = visible.filter((kpi) => !latest.has(kpi.id)).length;
    const attentionItems = visible
      .flatMap((kpi) => {
        const status = currentValues.get(kpi.id)?.status ?? "unknown";
        return status === "yellow" || status === "red"
          ? [{ id: kpi.id, name: kpi.name, status }]
          : [];
      })
      .slice(0, 8);
    const due = [...visible]
      .filter((kpi) => latest.get(kpi.id)?.period !== period)
      .sort(
        (a, b) =>
          Number(b.ownerUserId === userId) - Number(a.ownerUserId === userId),
      )
      .slice(0, 4)
      .map(({ id, name }) => ({
        id,
        name,
        period,
        dataState: latest.has(id) ? ("stale" as const) : ("missing" as const),
      }));
    const periods = jalaliPeriodSeries(period, 8);
    const historical =
      ids.length && periods.length
        ? await this.db
            .select({
              period: kpiManagementValues.period,
              actualValue: kpiManagementValues.actualValue,
              targetValue: kpiManagementValues.targetValue,
              status: kpiManagementValues.status,
            })
            .from(kpiManagementValues)
            .where(
              and(
                inArray(kpiManagementValues.kpiId, ids),
                inArray(kpiManagementValues.period, periods),
              ),
            )
        : [];
    const bars = periods.map((item) => {
      const rows = historical.filter((row) => row.period === item);
      if (!rows.length) return { height: 12, health: "unknown" };
      const heights = rows.map((row) => {
        const target = Number(row.targetValue);
        const actual = Number(row.actualValue ?? 0);
        return target <= 0
          ? 40
          : Math.min(88, Math.max(18, Math.round((actual / target) * 72) + 12));
      });
      const healthCounts = { green: 0, yellow: 0, red: 0, unknown: 0 };
      for (const row of rows)
        healthCounts[
          row.status in healthCounts
            ? (row.status as keyof typeof healthCounts)
            : "unknown"
        ]++;
      const peak = Math.max(...Object.values(healthCounts));
      const health =
        (["red", "yellow", "green", "unknown"] as const).find(
          (state) => healthCounts[state] === peak,
        ) ?? "unknown";
      return {
        height: Math.round(
          heights.reduce((sum, value) => sum + value, 0) / heights.length,
        ),
        health,
      };
    });
    const heights = bars.map(({ height }) => height);
    const completion = total === 0 ? 0 : Math.round((submitted / total) * 100);
    return {
      period,
      total,
      submitted,
      completion,
      completionLabel: `${String(completion).replace(/[0-9]/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)])}٪`,
      attention: counts.yellow + counts.red,
      attentionLabel: String(counts.yellow + counts.red).replace(
        /[0-9]/g,
        (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)],
      ),
      dueCount: Math.max(0, total - submitted),
      staleCount,
      missingCount,
      ...counts,
      bars,
      improving: heights.length >= 2 && heights.at(-1)! >= heights[0],
      due: due.map((item) => ({ ...item, id: item.id.toString() })),
      attentionItems: attentionItems.map((item) => ({
        ...item,
        id: item.id.toString(),
      })),
    };
  }

  async submitCheckin(input: {
    kpiId: bigint;
    userId: bigint;
    period: string;
    actualValue: unknown;
    status?: KpiCheckinWorkflowStatus;
    note?: string;
    description?: string;
    blockers?: string;
    dataJson?: Record<string, unknown>;
    unit?: string;
  }) {
    const period = normalizeJalaliPeriod(input.period);
    if (!period)
      throw new BadRequestException("Invalid Jalali reporting period.");
    return this.db.transaction(async (tx) => {
      const [kpi] = await tx
        .select()
        .from(kpiManagementKpis)
        .where(
          and(
            eq(kpiManagementKpis.id, input.kpiId),
            eq(kpiManagementKpis.active, true),
            eq(kpiManagementKpis.status, "published"),
          ),
        )
        .for("update")
        .limit(1);
      if (
        !kpi ||
        !(await this.authorization.canAccessKpi(
          input.userId,
          input.kpiId,
          "kpi.submit",
        ))
      )
        throw new NotFoundException("Active KPI not found.");
      const status = input.status ?? "data_submitted";
      if (!["draft", "submitted", "data_submitted", "revised"].includes(status))
        throw new BadRequestException("Invalid check-in transition.");
      validateReportedUnit(kpi.unit, input.unit);
      let calculation;
      try {
        calculation = calculateKpiInput({
          inputMode: kpi.inputMode,
          actualValue: input.actualValue,
          data: input.dataJson,
          inputOptions: Array.isArray(kpi.inputOptions)
            ? kpi.inputOptions.filter(
                (item): item is string => typeof item === "string",
              )
            : [],
          formulaType: kpi.formulaType,
        });
      } catch (error) {
        if (error instanceof Error)
          throw new BadRequestException(error.message);
        throw error;
      }
      const actualValue = calculation.numericValue;
      if (
        status !== "draft" &&
        ["missing", "null"].includes(calculation.dataState)
      )
        throw new BadRequestException(
          "A valid value is required for this KPI input mode.",
        );
      const now = new Date();
      const existing = await tx
        .select()
        .from(kpiManagementCheckins)
        .where(
          and(
            eq(kpiManagementCheckins.kpiId, kpi.id),
            eq(kpiManagementCheckins.userId, input.userId),
            eq(kpiManagementCheckins.period, period),
          ),
        )
        .limit(1);
      if (
        existing[0]?.status === "approved" ||
        existing[0]?.status === "locked"
      )
        throw new BadRequestException(
          "An approved check-in cannot be changed.",
        );
      const note = (input.note ?? "").trim().slice(0, 500);
      const blockers = (input.blockers ?? "").trim().slice(0, 500);
      const isLate = Boolean(
        kpi.submissionDeadline &&
          new Date().toISOString().slice(0, 10) > kpi.submissionDeadline,
      );
      const dataState =
        calculation.dataState === "valid" && actualValue === 0
          ? "zero"
          : calculation.dataState === "valid"
            ? isLate
              ? "late"
              : "valid"
            : calculation.dataState;
      const dataJson = {
        ...(input.dataJson ?? {}),
        actual: calculation.value,
        unit: kpi.unit,
        dataState:
          status === "draft" && calculation.dataState === "missing"
            ? "missing"
            : dataState,
        note,
        blockers,
      } as JsonValue;
      const values = {
        status,
        dataJson,
        actualValue: actualValue === null ? null : String(actualValue),
        note,
        blockers,
        submittedAt:
          status === "draft" ? (existing[0]?.submittedAt ?? null) : now,
        revisedAt: status === "revised" ? now : null,
        updatedAt: now,
      };
      const checkin = existing[0]
        ? (
            await tx
              .update(kpiManagementCheckins)
              .set(values)
              .where(eq(kpiManagementCheckins.id, existing[0].id))
              .returning()
          )[0]
        : (
            await tx
              .insert(kpiManagementCheckins)
              .values({
                kpiId: kpi.id,
                userId: input.userId,
                period,
                ...values,
              })
              .returning()
          )[0];
      const actorContext = this.authorization.currentContext(input.userId);
      await tx.insert(auditLogs).values({
        userId: input.userId,
        holdingId: kpi.holdingId,
        companyId: kpi.companyId,
        membershipId: actorContext ? BigInt(actorContext.membershipId) : null,
        actorName: "System",
        action: `kpi.checkin.${status}`,
        subjectType: "KpiCheckin",
        subjectId: checkin.id,
        description: `KPI check-in ${status}`,
        context: {
          period,
          holdingId: kpi.holdingId.toString(),
          companyId: kpi.companyId.toString(),
          kpiId: kpi.id.toString(),
        },
        ipAddress: null,
        userAgent: null,
      });
      return {
        checkin,
        dataState:
          status === "draft" && calculation.dataState === "missing"
            ? "missing"
            : dataState,
        health:
          status === "draft"
            ? ("unknown" as const)
            : KpiManagementRepository.health(
                actualValue,
                Number(kpi.targetValue),
                kpi.direction,
                kpi.warningValue === null ? null : Number(kpi.warningValue),
                kpi.criticalValue === null ? null : Number(kpi.criticalValue),
                kpi.rangeConfig as { minimum: number; maximum: number } | null,
              ),
      };
    });
  }

  async reviewCheckin(input: {
    checkinId: bigint;
    actorId: bigint;
    decision: "approved" | "rejected";
    note?: string;
  }) {
    return this.db.transaction(async (tx) => {
      const [checkin] = await tx
        .select()
        .from(kpiManagementCheckins)
        .where(eq(kpiManagementCheckins.id, input.checkinId))
        .for("update")
        .limit(1);
      if (!checkin) throw new NotFoundException("Check-in not found.");
      if (checkin.userId === input.actorId)
        throw new ForbiddenException(
          "Submitters cannot approve their own KPI data.",
        );
      if (!canReviewCheckin(checkin, input.actorId))
        throw new BadRequestException(
          "Only submitted check-ins can be reviewed.",
        );
      if (
        !(await this.authorization.canAccessKpi(
          input.actorId,
          checkin.kpiId,
          "kpi.approve",
        ))
      )
        throw new ForbiddenException("KPI approval permission is required.");
      const [kpi] = await tx
        .select()
        .from(kpiManagementKpis)
        .where(eq(kpiManagementKpis.id, checkin.kpiId))
        .limit(1);
      if (!kpi) throw new NotFoundException("KPI not found.");
      const note = (input.note ?? "").trim().slice(0, 1000);
      const [updated] = await tx
        .update(kpiManagementCheckins)
        .set({
          status: input.decision,
          reviewedBy: input.actorId,
          approvedBy: input.decision === "approved" ? input.actorId : null,
          reviewNote: note,
          updatedAt: new Date(),
        })
        .where(eq(kpiManagementCheckins.id, checkin.id))
        .returning();
      if (input.decision === "approved") {
        const rawValue =
          checkin.dataJson &&
          typeof checkin.dataJson === "object" &&
          !Array.isArray(checkin.dataJson)
            ? (checkin.dataJson as Record<string, unknown>).actual
            : checkin.actualValue;
        if (rawValue === undefined || rawValue === null)
          throw new BadRequestException(
            "A submitted value is required for approval.",
          );
        const actual =
          checkin.actualValue === null ? null : Number(checkin.actualValue);
        const health = KpiManagementRepository.health(
          actual,
          Number(kpi.targetValue),
          kpi.direction,
          kpi.warningValue === null ? null : Number(kpi.warningValue),
          kpi.criticalValue === null ? null : Number(kpi.criticalValue),
          kpi.rangeConfig as { minimum: number; maximum: number } | null,
        );
        const checkinData =
          checkin.dataJson &&
          typeof checkin.dataJson === "object" &&
          !Array.isArray(checkin.dataJson)
            ? (checkin.dataJson as Record<string, unknown>)
            : {};
        const dataState =
          checkinData.dataState === "late"
            ? "late"
            : actual === null
              ? "valid"
              : actual === 0
                ? "zero"
                : "valid";
        const [last] = await tx
          .select({ version: max(kpiManagementValues.version) })
          .from(kpiManagementValues)
          .where(
            and(
              eq(kpiManagementValues.kpiId, kpi.id),
              eq(kpiManagementValues.period, checkin.period),
            ),
          );
        const version = Number(last?.version ?? 0) + 1;
        await tx
          .update(kpiManagementValues)
          .set({ isCurrent: false, updatedAt: new Date() })
          .where(
            and(
              eq(kpiManagementValues.kpiId, kpi.id),
              eq(kpiManagementValues.period, checkin.period),
              eq(kpiManagementValues.isCurrent, true),
            ),
          );
        const [savedValue] = await tx
          .insert(kpiManagementValues)
          .values({
            kpiId: kpi.id,
            companyId: kpi.companyId,
            branchId: kpi.branchId,
            businessUnitId: kpi.businessUnitId,
            period: checkin.period,
            version,
            definitionVersion: kpi.version,
            actualValue: checkin.actualValue,
            rawValue: checkin.dataJson,
            unit: kpi.unit,
            targetValue: kpi.targetValue,
            status: health,
            dataState,
            source: kpi.source,
            submittedBy: checkin.userId,
            reviewedBy: input.actorId,
            approvedBy: input.actorId,
            approvedAt: new Date(),
            isCurrent: true,
            note: checkin.note,
          })
          .returning();
        const applicableRules = await tx
          .select()
          .from(redFlagRules)
          .where(
            and(
              eq(redFlagRules.holdingId, kpi.holdingId),
              eq(redFlagRules.enabled, true),
              or(
                isNull(redFlagRules.companyId),
                eq(redFlagRules.companyId, kpi.companyId),
              ),
              kpi.businessUnitId === null
                ? isNull(redFlagRules.businessUnitId)
                : or(
                    isNull(redFlagRules.businessUnitId),
                    eq(redFlagRules.businessUnitId, kpi.businessUnitId),
                  ),
              or(isNull(redFlagRules.kpiId), eq(redFlagRules.kpiId, kpi.id)),
            ),
          );
        const historyRows = await tx
          .select({ actualValue: kpiManagementValues.actualValue })
          .from(kpiManagementValues)
          .where(
            and(
              eq(kpiManagementValues.kpiId, kpi.id),
              eq(kpiManagementValues.isCurrent, true),
            ),
          )
          .orderBy(desc(kpiManagementValues.period))
          .limit(5);
        const historyValues = historyRows.flatMap((row) =>
          row.actualValue === null ? [] : [Number(row.actualValue)],
        );
        const matchedRules = applicableRules.filter((rule) =>
          matchesRedFlagRule(
            {
              trigger: rule.trigger,
              configuration: rule.configuration as Record<string, unknown>,
            },
            {
              actual,
              threshold:
                kpi.criticalValue === null ? null : Number(kpi.criticalValue),
              direction: kpi.direction,
              history: historyValues,
              dataState,
            },
          ),
        );
        if (health === "red" || matchedRules.length > 0) {
          const [openFlag] = await tx
            .select({ id: redFlags.id })
            .from(redFlags)
            .where(
              and(
                eq(redFlags.kpiId, kpi.id),
                eq(redFlags.period, checkin.period),
                sql`${redFlags.status} not in ('resolved','closed')`,
              ),
            )
            .limit(1);
          if (!openFlag) {
            const matched = matchedRules[0];
            const matchedConfig = matched?.configuration as Record<
              string,
              unknown
            > | null;
            const severity = matched?.severity ?? "critical";
            const [flag] = await tx
              .insert(redFlags)
              .values({
                holdingId: kpi.holdingId,
                companyId: kpi.companyId,
                branchId: kpi.branchId,
                businessUnitId: kpi.businessUnitId,
                kpiId: kpi.id,
                period: checkin.period,
                triggerValue: checkin.actualValue,
                threshold:
                  typeof matchedConfig?.threshold === "number"
                    ? String(matchedConfig.threshold)
                    : kpi.criticalValue,
                description: matched
                  ? `Rule ${matched.trigger} was triggered for KPI ${kpi.name}`
                  : `Approved KPI result crossed its critical threshold: ${kpi.name}`,
                suspectedCause: null,
                severity,
                ownerUserId: kpi.ownerUserId,
                status: "new",
                source: "kpi_rule",
              })
              .returning();
            await tx.insert(auditLogs).values({
              userId: input.actorId,
              holdingId: kpi.holdingId,
              companyId: kpi.companyId,
              membershipId: this.authorization.currentContext(input.actorId)
                ? BigInt(
                    this.authorization.currentContext(input.actorId)!
                      .membershipId,
                  )
                : null,
              actorName: "System",
              action: "kpi.red_flag.created",
              subjectType: "RedFlag",
              subjectId: flag.id,
              description: "KPI rule created a red flag",
              context: {
                kpiId: kpi.id.toString(),
                period: checkin.period,
                valueId: savedValue.id.toString(),
                severity,
                ruleId: matched?.id.toString() ?? null,
              },
              ipAddress: null,
              userAgent: null,
            });
          }
        }
      }
      const actorContext = this.authorization.currentContext(input.actorId);
      const auditedDataState = (
        checkin.dataJson as Record<string, unknown> | null
      )?.dataState;
      await tx.insert(auditLogs).values({
        userId: input.actorId,
        holdingId: kpi.holdingId,
        companyId: kpi.companyId,
        membershipId: actorContext ? BigInt(actorContext.membershipId) : null,
        actorName: "System",
        action: `kpi.checkin.${input.decision}`,
        subjectType: "KpiCheckin",
        subjectId: checkin.id,
        description: `KPI check-in ${input.decision}`,
        context: {
          kpiId: kpi.id.toString(),
          period: checkin.period,
          companyId: kpi.companyId.toString(),
          note,
          actualValue: checkin.actualValue,
          targetValue: kpi.targetValue,
          unit: kpi.unit,
          reviewerUserId: input.actorId.toString(),
          dataState:
            input.decision === "approved"
              ? typeof auditedDataState === "string"
                ? auditedDataState
                : "valid"
              : "rejected",
        },
        ipAddress: null,
        userAgent: null,
      });
      return updated;
    });
  }

  async lockCheckin(checkinId: bigint, actorId: bigint) {
    return this.db.transaction(async (tx) => {
      const [checkin] = await tx
        .select()
        .from(kpiManagementCheckins)
        .where(eq(kpiManagementCheckins.id, checkinId))
        .for("update")
        .limit(1);
      if (!checkin) throw new NotFoundException("Check-in not found.");
      if (checkin.userId === actorId)
        throw new ForbiddenException(
          "Submitters cannot lock their own KPI data.",
        );
      if (checkin.status !== "approved")
        throw new BadRequestException("Only approved check-ins can be locked.");
      if (
        !(await this.authorization.canAccessKpi(
          actorId,
          checkin.kpiId,
          "kpi.approve",
        ))
      )
        throw new ForbiddenException("KPI approval permission is required.");
      const [kpi] = await tx
        .select()
        .from(kpiManagementKpis)
        .where(eq(kpiManagementKpis.id, checkin.kpiId))
        .limit(1);
      if (!kpi) throw new NotFoundException("KPI not found.");
      const [locked] = await tx
        .update(kpiManagementCheckins)
        .set({ status: "locked", updatedAt: new Date() })
        .where(eq(kpiManagementCheckins.id, checkinId))
        .returning();
      const context = this.authorization.currentContext(actorId);
      await tx.insert(auditLogs).values({
        userId: actorId,
        holdingId: kpi.holdingId,
        companyId: kpi.companyId,
        membershipId: context ? BigInt(context.membershipId) : null,
        actorName: "System",
        action: "kpi.checkin.locked",
        subjectType: "KpiCheckin",
        subjectId: checkinId,
        description: "Approved KPI check-in locked",
        context: { kpiId: kpi.id.toString(), period: checkin.period },
        ipAddress: null,
        userAgent: null,
      });
      return locked;
    });
  }

  async checkinBoard(userId: bigint) {
    const period = currentJalaliPeriod();
    const window = jalaliPeriodSeries(period, 5);
    const past = window.slice(0, -1);
    const assignedCandidates = await this.db
      .select({
        kpi: kpiManagementKpis,
        departmentName: departments.name,
        businessUnitName: businessUnits.name,
        companyName: companies.name,
      })
      .from(kpiManagementKpis)
      .leftJoin(departments, eq(kpiManagementKpis.departmentId, departments.id))
      .leftJoin(
        businessUnits,
        eq(kpiManagementKpis.businessUnitId, businessUnits.id),
      )
      .leftJoin(companies, eq(kpiManagementKpis.companyId, companies.id))
      .where(
        and(
          eq(kpiManagementKpis.active, true),
          eq(kpiManagementKpis.status, "published"),
          or(
            eq(kpiManagementKpis.reporterUserId, userId),
            eq(kpiManagementKpis.ownerUserId, userId),
          ),
        ),
      )
      .orderBy(asc(kpiManagementKpis.name));
    const assigned = (
      await Promise.all(
        assignedCandidates.map(async (row) => {
          const allowed = await this.authorization.canAccessKpi(
            userId,
            row.kpi.id,
            "kpi.submit",
          );
          return allowed ? row : null;
        }),
      )
    ).filter((row): row is (typeof assignedCandidates)[number] => row !== null);
    const canSubmit = assigned.length > 0;
    const ids = assigned.map(({ kpi }) => kpi.id);
    const values = ids.length
      ? await this.db
          .select()
          .from(kpiManagementValues)
          .where(inArray(kpiManagementValues.kpiId, ids))
          .orderBy(
            desc(kpiManagementValues.period),
            desc(kpiManagementValues.createdAt),
            desc(kpiManagementValues.id),
          )
      : [];
    const drafts = ids.length
      ? await this.db
          .select()
          .from(kpiManagementCheckins)
          .where(
            and(
              inArray(kpiManagementCheckins.kpiId, ids),
              eq(kpiManagementCheckins.userId, userId),
              eq(kpiManagementCheckins.status, "draft"),
            ),
          )
          .orderBy(desc(kpiManagementCheckins.id))
      : [];
    const covered = new Set(
      values.map((value) => `${value.kpiId}:${value.period}`),
    );
    const latest = new Map<bigint, (typeof values)[number]>();
    for (const value of values)
      if (!latest.has(value.kpiId)) latest.set(value.kpiId, value);
    const draftByPeriod = new Map<string, (typeof drafts)[number]>();
    for (const draft of drafts) {
      const key = `${draft.kpiId}:${draft.period}`;
      if (!draftByPeriod.has(key)) draftByPeriod.set(key, draft);
    }
    const open: ReturnType<KpiManagementRepository["checkinCard"]>[] = [];
    const late: ReturnType<KpiManagementRepository["checkinCard"]>[] = [];
    for (const {
      kpi,
      departmentName,
      businessUnitName,
      companyName,
    } of assigned) {
      const scopeName = businessUnitName ?? departmentName ?? companyName;
      const started = kpi.createdAt
        ? currentJalaliPeriod(kpi.createdAt)
        : period;
      const last = latest.get(kpi.id);
      if (!covered.has(`${kpi.id}:${period}`))
        open.push(
          this.checkinCard(
            kpi,
            scopeName,
            period,
            "due",
            last?.actualValue ?? null,
            last?.status ?? "unknown",
            draftByPeriod.has(`${kpi.id}:${period}`),
          ),
        );
      for (const item of past) {
        if (item < started || covered.has(`${kpi.id}:${item}`)) continue;
        late.push(
          this.checkinCard(
            kpi,
            scopeName,
            item,
            "late",
            last?.actualValue ?? null,
            last?.status ?? "unknown",
            draftByPeriod.has(`${kpi.id}:${item}`),
          ),
        );
      }
    }
    const historyRows = await this.db
      .select({
        checkin: kpiManagementCheckins,
        kpi: kpiManagementKpis,
        departmentName: departments.name,
        businessUnitName: businessUnits.name,
        companyName: companies.name,
      })
      .from(kpiManagementCheckins)
      .innerJoin(
        kpiManagementKpis,
        eq(kpiManagementCheckins.kpiId, kpiManagementKpis.id),
      )
      .leftJoin(departments, eq(kpiManagementKpis.departmentId, departments.id))
      .leftJoin(
        businessUnits,
        eq(kpiManagementKpis.businessUnitId, businessUnits.id),
      )
      .leftJoin(companies, eq(kpiManagementKpis.companyId, companies.id))
      .where(
        and(
          eq(kpiManagementCheckins.userId, userId),
          inArray(kpiManagementCheckins.status, [
            "submitted",
            "data_submitted",
            "revised",
          ]),
        ),
      )
      .orderBy(desc(kpiManagementCheckins.id))
      .limit(40);
    const visibleHistory = (
      await Promise.all(
        historyRows.map(async (row) =>
          (await this.authorization.canAccessKpi(
            userId,
            row.kpi.id,
            "kpi.view",
          )) ||
          (await this.authorization.canAccessKpi(
            userId,
            row.kpi.id,
            "kpi.submit",
          ))
            ? row
            : null,
        ),
      )
    ).filter((row): row is (typeof historyRows)[number] => row !== null);
    const history = visibleHistory.map(
      ({ checkin, kpi, departmentName, businessUnitName, companyName }) =>
        this.checkinCard(
          kpi,
          businessUnitName ?? departmentName ?? companyName,
          checkin.period,
          checkin.status === "revised" ? "revised" : "submitted",
          checkin.actualValue,
          KpiManagementRepository.health(
            checkin.actualValue === null ? null : Number(checkin.actualValue),
            Number(kpi.targetValue),
            kpi.direction,
            kpi.warningValue === null ? null : Number(kpi.warningValue),
            kpi.criticalValue === null ? null : Number(kpi.criticalValue),
          ),
          false,
          checkin.note,
        ),
    );
    return {
      period,
      canSubmit,
      assigned: assigned.length,
      open,
      late,
      history,
    };
  }

  async reviewQueue(userId: bigint) {
    if (!(await this.authorization.hasPermission(userId, "kpi.review")))
      throw new ForbiddenException("KPI review permission is required.");
    const candidates = await this.db
      .select({
        checkin: kpiManagementCheckins,
        kpiName: kpiManagementKpis.name,
        departmentName: departments.name,
        businessUnitName: businessUnits.name,
        companyName: companies.name,
      })
      .from(kpiManagementCheckins)
      .innerJoin(
        kpiManagementKpis,
        eq(kpiManagementCheckins.kpiId, kpiManagementKpis.id),
      )
      .leftJoin(departments, eq(kpiManagementKpis.departmentId, departments.id))
      .leftJoin(
        businessUnits,
        eq(kpiManagementKpis.businessUnitId, businessUnits.id),
      )
      .leftJoin(companies, eq(kpiManagementKpis.companyId, companies.id))
      .where(
        inArray(kpiManagementCheckins.status, [
          "submitted",
          "data_submitted",
          "revised",
        ]),
      )
      .orderBy(asc(kpiManagementCheckins.submittedAt))
      .limit(500);
    const allowed = await Promise.all(
      candidates.map(async (row) =>
        (await this.authorization.canAccessKpi(
          userId,
          row.checkin.kpiId,
          "kpi.approve",
        ))
          ? row
          : null,
      ),
    );
    return allowed
      .filter((row): row is (typeof candidates)[number] => row !== null)
      .map(
        ({
          checkin,
          kpiName,
          departmentName,
          businessUnitName,
          companyName,
        }) => ({
          ...checkin,
          id: checkin.id.toString(),
          kpiId: checkin.kpiId.toString(),
          userId: checkin.userId.toString(),
          kpiName,
          departmentName: businessUnitName ?? departmentName ?? companyName,
        }),
      );
  }

  async kpiHistory(kpiId: bigint, userId: bigint) {
    if (!(await this.authorization.canAccessKpi(userId, kpiId, "kpi.view")))
      throw new NotFoundException("KPI not found.");
    const [definition] = await this.db
      .select()
      .from(kpiManagementKpis)
      .where(eq(kpiManagementKpis.id, kpiId))
      .limit(1);
    if (!definition) throw new NotFoundException("KPI not found.");
    const [versions, values, checkins] = await Promise.all([
      this.db
        .select()
        .from(kpiManagementKpiVersions)
        .where(eq(kpiManagementKpiVersions.kpiId, kpiId))
        .orderBy(desc(kpiManagementKpiVersions.version)),
      this.db
        .select()
        .from(kpiManagementValues)
        .where(eq(kpiManagementValues.kpiId, kpiId))
        .orderBy(
          desc(kpiManagementValues.period),
          desc(kpiManagementValues.version),
        ),
      this.db
        .select()
        .from(kpiManagementCheckins)
        .where(eq(kpiManagementCheckins.kpiId, kpiId))
        .orderBy(desc(kpiManagementCheckins.createdAt)),
    ]);
    return { definition, versions, values, checkins };
  }

  async kpiDetail(kpiId: bigint, userId: bigint) {
    if (!(await this.authorization.canAccessKpi(userId, kpiId, "kpi.view")))
      throw new NotFoundException("KPI not found.");
    const [kpi] = await this.db
      .select({
        definition: kpiManagementKpis,
        companyName: companies.name,
        businessUnitName: businessUnits.name,
      })
      .from(kpiManagementKpis)
      .innerJoin(companies, eq(kpiManagementKpis.companyId, companies.id))
      .leftJoin(
        businessUnits,
        eq(kpiManagementKpis.businessUnitId, businessUnits.id),
      )
      .where(eq(kpiManagementKpis.id, kpiId))
      .limit(1);
    if (!kpi) throw new NotFoundException("KPI not found.");
    const [current] = await this.db
      .select()
      .from(kpiManagementValues)
      .where(
        and(
          eq(kpiManagementValues.kpiId, kpiId),
          eq(kpiManagementValues.isCurrent, true),
        ),
      )
      .orderBy(desc(kpiManagementValues.period))
      .limit(1);
    const [latest] = current
      ? [current]
      : await this.db
          .select()
          .from(kpiManagementValues)
          .where(eq(kpiManagementValues.kpiId, kpiId))
          .orderBy(
            desc(kpiManagementValues.period),
            desc(kpiManagementValues.version),
          )
          .limit(1);
    return {
      ...kpi,
      latest: latest ?? null,
      achievement: latest
        ? calculateAchievement({
            actual:
              latest.actualValue === null ? null : Number(latest.actualValue),
            target: Number(kpi.definition.targetValue),
            direction: kpi.definition.direction,
            range: kpi.definition.rangeConfig as {
              minimum: number;
              maximum: number;
            } | null,
          })
        : null,
    };
  }

  async kpiData(kpiId: bigint, userId: bigint, period?: string) {
    const allowed =
      (await this.authorization.canAccessKpi(userId, kpiId, "kpi.view")) ||
      (await this.authorization.canAccessKpi(userId, kpiId, "kpi.submit"));
    if (!allowed) throw new NotFoundException("KPI not found.");
    const normalized = period
      ? normalizeJalaliPeriod(period)
      : currentJalaliPeriod();
    if (!normalized)
      throw new BadRequestException("Invalid Jalali reporting period.");
    const [kpi] = await this.db
      .select()
      .from(kpiManagementKpis)
      .where(eq(kpiManagementKpis.id, kpiId))
      .limit(1);
    if (!kpi) throw new NotFoundException("KPI not found.");
    const [currentValue] = await this.db
      .select()
      .from(kpiManagementValues)
      .where(
        and(
          eq(kpiManagementValues.kpiId, kpiId),
          eq(kpiManagementValues.period, normalized),
          eq(kpiManagementValues.isCurrent, true),
        ),
      )
      .limit(1);
    const [historicalValue] = currentValue
      ? [currentValue]
      : await this.db
          .select()
          .from(kpiManagementValues)
          .where(
            and(
              eq(kpiManagementValues.kpiId, kpiId),
              eq(kpiManagementValues.period, normalized),
            ),
          )
          .orderBy(desc(kpiManagementValues.version))
          .limit(1);
    const value = currentValue ?? historicalValue;
    const [currentLatest] = await this.db
      .select()
      .from(kpiManagementValues)
      .where(
        and(
          eq(kpiManagementValues.kpiId, kpiId),
          eq(kpiManagementValues.isCurrent, true),
        ),
      )
      .orderBy(desc(kpiManagementValues.period))
      .limit(1);
    const [latestValue] = currentLatest
      ? [currentLatest]
      : await this.db
          .select()
          .from(kpiManagementValues)
          .where(eq(kpiManagementValues.kpiId, kpiId))
          .orderBy(
            desc(kpiManagementValues.period),
            desc(kpiManagementValues.version),
          )
          .limit(1);
    const [checkin] = await this.db
      .select()
      .from(kpiManagementCheckins)
      .where(
        and(
          eq(kpiManagementCheckins.kpiId, kpiId),
          eq(kpiManagementCheckins.period, normalized),
          eq(kpiManagementCheckins.userId, userId),
        ),
      )
      .orderBy(desc(kpiManagementCheckins.updatedAt))
      .limit(1);
    const dataState =
      value?.dataState ??
      (checkin?.status === "rejected"
        ? "rejected"
        : latestValue && latestValue.period < normalized
          ? "stale"
          : normalized < currentJalaliPeriod()
            ? "late"
            : "missing");
    const achievement = value
      ? calculateAchievement({
          actual: value.actualValue === null ? null : Number(value.actualValue),
          target: Number(kpi.targetValue),
          direction: kpi.direction,
          range: kpi.rangeConfig as { minimum: number; maximum: number } | null,
        })
      : null;
    return {
      kpi,
      period: normalized,
      value: value ?? null,
      latestValue: latestValue ?? null,
      checkin: checkin ?? null,
      health: value?.status ?? "unknown",
      achievement,
      dataState,
      displayColor: ["missing", "null", "late", "stale"].includes(dataState)
        ? "gray"
        : "standard",
    };
  }

  async createObservation(input: {
    actorId: bigint;
    period: string;
    text: string;
    tags?: string[];
    relatedKpiIds?: bigint[];
  }) {
    const period = normalizeJalaliPeriod(input.period);
    if (!period || !input.text.trim())
      throw new BadRequestException(
        "A valid period and observation are required.",
      );
    const context = this.authorization.currentContext(input.actorId);
    if (
      !context?.companyId ||
      !(await this.authorization.hasPermission(input.actorId, "kpi.create"))
    )
      throw new ForbiddenException("KPI management permission is required.");
    const related = input.relatedKpiIds ?? [];
    for (const kpiId of related)
      if (
        !(await this.authorization.canAccessKpi(
          input.actorId,
          kpiId,
          "kpi.view",
        ))
      )
        throw new BadRequestException(
          "An observation references a KPI outside your scope.",
        );
    const [observation] = await this.db
      .insert(managementObservations)
      .values({
        holdingId: BigInt(context.holdingId),
        companyId: BigInt(context.companyId),
        branchId: context.branchId ? BigInt(context.branchId) : null,
        businessUnitId: context.businessUnitId
          ? BigInt(context.businessUnitId)
          : null,
        userId: input.actorId,
        period,
        text: input.text.trim().slice(0, 5000),
        tags: (input.tags ?? []).slice(0, 20) as JsonValue,
        relatedKpiIds: related.map(String) as JsonValue,
      })
      .returning();
    await this.db.insert(auditLogs).values({
      userId: input.actorId,
      holdingId: observation.holdingId,
      companyId: observation.companyId,
      membershipId: BigInt(context.membershipId),
      actorName: "System",
      action: "kpi.observation.created",
      subjectType: "ManagementObservation",
      subjectId: observation.id,
      description: "Management observation created",
      context: { companyId: context.companyId, period },
      ipAddress: null,
      userAgent: null,
    });
    return observation;
  }

  async listObservations(userId: bigint, period?: string) {
    const context = this.authorization.currentContext(userId);
    if (
      !context ||
      !(await this.authorization.hasPermission(userId, "kpi.view"))
    )
      throw new ForbiddenException("KPI view permission is required.");
    const normalized = period ? normalizeJalaliPeriod(period) : undefined;
    if (period && !normalized)
      throw new BadRequestException("Invalid Jalali reporting period.");
    const candidates = await this.db
      .select()
      .from(managementObservations)
      .where(
        and(
          context.companyId
            ? eq(managementObservations.companyId, BigInt(context.companyId))
            : eq(managementObservations.holdingId, BigInt(context.holdingId)),
          normalized
            ? eq(managementObservations.period, normalized)
            : undefined,
        ),
      )
      .orderBy(desc(managementObservations.createdAt))
      .limit(500);
    const allowed = await Promise.all(
      candidates.map(async (observation) =>
        (await this.authorization.can(context, "kpi.view", {
          holdingId: observation.holdingId.toString(),
          companyId: observation.companyId.toString(),
          branchId: observation.branchId?.toString() ?? null,
          businessUnitId: observation.businessUnitId?.toString() ?? null,
          ownerId: observation.userId.toString(),
        }))
          ? observation
          : null,
      ),
    );
    return allowed.filter(
      (observation): observation is (typeof candidates)[number] =>
        observation !== null,
    );
  }

  async redFlagBoard(userId: bigint) {
    const context = this.authorization.currentContext(userId);
    if (
      !context ||
      !(await this.authorization.hasPermission(userId, "redflag.view"))
    )
      throw new ForbiddenException("Red flag view permission is required.");
    const candidates = await this.db
      .select()
      .from(redFlags)
      .where(eq(redFlags.holdingId, BigInt(context.holdingId)))
      .orderBy(desc(redFlags.createdAt))
      .limit(500);
    const allowed = await Promise.all(
      candidates.map(async (flag) => {
        if (flag.kpiId !== null)
          return (await this.authorization.canAccessKpi(
            userId,
            flag.kpiId,
            "redflag.view",
          ))
            ? flag
            : null;
        const canView = await this.authorization.can(context, "redflag.view", {
          holdingId: flag.holdingId.toString(),
          companyId: flag.companyId.toString(),
          branchId: flag.branchId?.toString() ?? null,
          businessUnitId: flag.businessUnitId?.toString() ?? null,
        });
        return canView ? flag : null;
      }),
    );
    return allowed.filter(
      (flag): flag is (typeof candidates)[number] => flag !== null,
    );
  }

  async createRedFlag(input: {
    actorId: bigint;
    description: string;
    severity: string;
    kpiId?: bigint | null;
    period?: string;
    suspectedCause?: string | null;
  }) {
    const context = this.authorization.currentContext(input.actorId);
    if (
      !context?.companyId ||
      !(await this.authorization.hasPermission(input.actorId, "redflag.create"))
    )
      throw new ForbiddenException("Red flag creation permission is required.");
    let scope = {
      holdingId: BigInt(context.holdingId),
      companyId: BigInt(context.companyId),
      branchId: context.branchId ? BigInt(context.branchId) : null,
      businessUnitId: context.businessUnitId
        ? BigInt(context.businessUnitId)
        : null,
    };
    if (input.kpiId) {
      if (
        !(await this.authorization.canAccessKpi(
          input.actorId,
          input.kpiId,
          "redflag.create",
        ))
      )
        throw new ForbiddenException("KPI scope access denied.");
      const [kpi] = await this.db
        .select()
        .from(kpiManagementKpis)
        .where(eq(kpiManagementKpis.id, input.kpiId))
        .limit(1);
      if (!kpi) throw new NotFoundException("KPI not found.");
      scope = {
        holdingId: kpi.holdingId,
        companyId: kpi.companyId,
        branchId: kpi.branchId,
        businessUnitId: kpi.businessUnitId,
      };
    }
    const period = input.period ? normalizeJalaliPeriod(input.period) : null;
    if (input.period && !period)
      throw new BadRequestException("Invalid Jalali reporting period.");
    if (!input.description.trim())
      throw new BadRequestException("Red flag description is required.");
    if (!["critical", "high", "medium", "low"].includes(input.severity))
      throw new BadRequestException("Invalid red flag severity.");
    const [flag] = await this.db
      .insert(redFlags)
      .values({
        ...scope,
        kpiId: input.kpiId ?? null,
        period,
        description: input.description.trim().slice(0, 2000),
        suspectedCause: input.suspectedCause?.trim().slice(0, 2000) || null,
        severity: input.severity,
        status: "new",
        source: "manual",
      })
      .returning();
    await this.db.insert(auditLogs).values({
      userId: input.actorId,
      holdingId: scope.holdingId,
      companyId: scope.companyId,
      membershipId: BigInt(context.membershipId),
      actorName: "System",
      action: "kpi.red_flag.created",
      subjectType: "RedFlag",
      subjectId: flag.id,
      description: "Management red flag created",
      context: {
        companyId: scope.companyId.toString(),
        kpiId: input.kpiId?.toString() ?? null,
        period,
      },
      ipAddress: null,
      userAgent: null,
    });
    return flag;
  }

  async updateRedFlag(input: {
    id: bigint;
    actorId: bigint;
    status: "investigating" | "action_required" | "resolved" | "closed";
    suspectedCause?: string;
    ownerUserId?: bigint | null;
    deadline?: string | null;
    closureEvidence?: string;
    exceptionReason?: string;
  }) {
    const [flag] = await this.db
      .select()
      .from(redFlags)
      .where(eq(redFlags.id, input.id))
      .limit(1);
    if (!flag) throw new NotFoundException("Red flag not found.");
    const requiredPermission =
      input.status === "resolved" || input.status === "closed"
        ? "redflag.resolve"
        : "redflag.update";
    const allowed =
      flag.kpiId === null
        ? await this.authorization.can(
            this.authorization.currentContext(input.actorId),
            requiredPermission,
            {
              holdingId: flag.holdingId.toString(),
              companyId: flag.companyId.toString(),
              branchId: flag.branchId?.toString() ?? null,
              businessUnitId: flag.businessUnitId?.toString() ?? null,
            },
          )
        : await this.authorization.canAccessKpi(
            input.actorId,
            flag.kpiId,
            requiredPermission,
          );
    if (!allowed) throw new ForbiddenException("Red flag access denied.");
    const exceptionApproved =
      input.status === "closed" &&
      Boolean(input.exceptionReason?.trim()) &&
      (await this.authorization.hasPermission(input.actorId, "kpi.approve"));
    if (
      input.status === "closed" &&
      !canCloseRedFlag({
        status: flag.status,
        closureEvidence: input.closureEvidence,
        exceptionReason: input.exceptionReason,
        exceptionApproved,
      })
    ) {
      if (flag.status !== "resolved")
        throw new BadRequestException(
          "Resolve the red flag before closing it.",
        );
      if (input.exceptionReason?.trim() && !exceptionApproved)
        throw new ForbiddenException(
          "An authorized reviewer must approve the closure exception.",
        );
      throw new BadRequestException(
        "Closing a red flag requires evidence or an approved exception reason.",
      );
    }
    if (
      input.status === "action_required" &&
      !(await this.authorization.hasPermission(input.actorId, "action.approve"))
    )
      throw new ForbiddenException(
        "A manager must approve the action requirement.",
      );
    if (input.ownerUserId) {
      const [member] = await this.db
        .select({ id: memberships.id })
        .from(memberships)
        .where(
          and(
            eq(memberships.userId, input.ownerUserId),
            eq(memberships.companyId, flag.companyId),
            eq(memberships.status, "active"),
          ),
        )
        .limit(1);
      if (!member)
        throw new BadRequestException(
          "Red flag owner must be an active member of the same company.",
        );
    }
    const [updated] = await this.db
      .update(redFlags)
      .set({
        status: input.status,
        suspectedCause:
          input.suspectedCause?.trim().slice(0, 2000) ?? flag.suspectedCause,
        ownerUserId:
          input.ownerUserId === undefined
            ? flag.ownerUserId
            : input.ownerUserId,
        deadline: input.deadline === undefined ? flag.deadline : input.deadline,
        closureEvidence:
          input.closureEvidence?.trim().slice(0, 2000) ?? flag.closureEvidence,
        exceptionReason:
          input.exceptionReason?.trim().slice(0, 1000) ?? flag.exceptionReason,
        resolvedAt:
          input.status === "resolved" || input.status === "closed"
            ? new Date()
            : flag.resolvedAt,
        updatedAt: new Date(),
      })
      .where(eq(redFlags.id, flag.id))
      .returning();
    const actorContext = this.authorization.currentContext(input.actorId);
    await this.db.insert(auditLogs).values({
      userId: input.actorId,
      holdingId: flag.holdingId,
      companyId: flag.companyId,
      membershipId: actorContext ? BigInt(actorContext.membershipId) : null,
      actorName: "System",
      action: `kpi.red_flag.${input.status}`,
      subjectType: "RedFlag",
      subjectId: flag.id,
      description: `Red flag ${input.status}`,
      context: {
        companyId: flag.companyId.toString(),
        kpiId: flag.kpiId?.toString() ?? null,
        suspectedCause: input.suspectedCause ?? flag.suspectedCause,
      },
      ipAddress: null,
      userAgent: null,
    });
    return updated;
  }

  async redFlagRuleBoard(actorId: bigint) {
    const context = this.authorization.currentContext(actorId);
    if (
      !context ||
      !(await this.authorization.hasPermission(actorId, "redflag.view"))
    )
      throw new ForbiddenException("Red flag view permission is required.");
    const rows = await this.db
      .select()
      .from(redFlagRules)
      .where(
        and(
          eq(redFlagRules.holdingId, BigInt(context.holdingId)),
          context.companyId
            ? or(
                eq(redFlagRules.companyId, BigInt(context.companyId)),
                sql`${redFlagRules.companyId} IS NULL`,
              )
            : undefined,
        ),
      )
      .orderBy(desc(redFlagRules.createdAt));
    return (
      await Promise.all(
        rows.map(async (rule) =>
          (await this.authorization.can(context, "redflag.view", {
            holdingId: rule.holdingId.toString(),
            companyId: rule.companyId?.toString() ?? context.companyId,
            businessUnitId: rule.businessUnitId?.toString() ?? null,
          }))
            ? rule
            : null,
        ),
      )
    ).filter((rule): rule is (typeof rows)[number] => rule !== null);
  }

  async createRedFlagRule(input: {
    actorId: bigint;
    trigger: string;
    severity: string;
    configuration?: Record<string, unknown>;
    businessUnitId?: bigint | null;
    kpiId?: bigint | null;
  }) {
    const context = this.authorization.currentContext(input.actorId);
    const triggers = [
      "kpi_below_threshold",
      "kpi_above_threshold",
      "multiple_period_degradation",
      "data_missing",
      "data_stale",
      "action_overdue",
      "decision_overdue",
    ];
    if (
      !context?.companyId ||
      !(await this.authorization.hasPermission(input.actorId, "redflag.create"))
    )
      throw new ForbiddenException("Red flag creation permission is required.");
    if (
      !triggers.includes(input.trigger) ||
      !["critical", "high", "medium", "low"].includes(input.severity)
    )
      throw new BadRequestException("Invalid red flag rule.");
    let kpi: typeof kpiManagementKpis.$inferSelect | undefined;
    if (input.kpiId) {
      if (
        !(await this.authorization.canAccessKpi(
          input.actorId,
          input.kpiId,
          "redflag.create",
        ))
      )
        throw new ForbiddenException("KPI scope access denied.");
      [kpi] = await this.db
        .select()
        .from(kpiManagementKpis)
        .where(eq(kpiManagementKpis.id, input.kpiId))
        .limit(1);
      if (!kpi) throw new NotFoundException("KPI not found.");
    }
    const businessUnitId =
      input.businessUnitId ??
      kpi?.businessUnitId ??
      (context.businessUnitId ? BigInt(context.businessUnitId) : null);
    if (
      businessUnitId &&
      !(await this.authorization.can(context, "redflag.create", {
        holdingId: context.holdingId,
        companyId: context.companyId,
        businessUnitId: businessUnitId.toString(),
      }))
    )
      throw new ForbiddenException("Rule scope access denied.");
    const [rule] = await this.db
      .insert(redFlagRules)
      .values({
        holdingId: BigInt(context.holdingId),
        companyId: BigInt(context.companyId),
        businessUnitId,
        kpiId: kpi?.id ?? null,
        trigger: input.trigger,
        severity: input.severity,
        configuration: (input.configuration ?? {}) as JsonValue,
        createdBy: input.actorId,
      })
      .returning();
    await this.db.insert(auditLogs).values({
      userId: input.actorId,
      holdingId: rule.holdingId,
      companyId: rule.companyId,
      membershipId: BigInt(context.membershipId),
      actorName: "System",
      action: "kpi.red_flag_rule.created",
      subjectType: "RedFlagRule",
      subjectId: rule.id,
      description: "Red flag rule created",
      context: {
        trigger: rule.trigger,
        severity: rule.severity,
        kpiId: rule.kpiId?.toString() ?? null,
      },
      ipAddress: null,
      userAgent: null,
    });
    return rule;
  }

  async updateRedFlagRule(input: {
    id: bigint;
    actorId: bigint;
    enabled?: boolean;
    severity?: string;
    configuration?: Record<string, unknown>;
  }) {
    const [rule] = await this.db
      .select()
      .from(redFlagRules)
      .where(eq(redFlagRules.id, input.id))
      .limit(1);
    if (!rule) throw new NotFoundException("Red flag rule not found.");
    const context = this.authorization.currentContext(input.actorId);
    const allowed =
      context &&
      (await this.authorization.can(context, "redflag.update", {
        holdingId: rule.holdingId.toString(),
        companyId: rule.companyId?.toString() ?? context.companyId,
        businessUnitId: rule.businessUnitId?.toString() ?? null,
      }));
    if (!allowed) throw new ForbiddenException("Red flag rule access denied.");
    if (
      input.severity &&
      !["critical", "high", "medium", "low"].includes(input.severity)
    )
      throw new BadRequestException("Invalid red flag severity.");
    const [updated] = await this.db
      .update(redFlagRules)
      .set({
        enabled: input.enabled ?? rule.enabled,
        severity: input.severity ?? rule.severity,
        configuration: (input.configuration ?? rule.configuration) as JsonValue,
        updatedAt: new Date(),
      })
      .where(eq(redFlagRules.id, rule.id))
      .returning();
    await this.db.insert(auditLogs).values({
      userId: input.actorId,
      holdingId: rule.holdingId,
      companyId: rule.companyId,
      membershipId: context ? BigInt(context.membershipId) : null,
      actorName: "System",
      action: "kpi.red_flag_rule.updated",
      subjectType: "RedFlagRule",
      subjectId: rule.id,
      description: "Red flag rule updated",
      context: { enabled: updated.enabled, severity: updated.severity },
      ipAddress: null,
      userAgent: null,
    });
    return updated;
  }

  async evaluateRedFlagRules(actorId: bigint, requestedPeriod?: string) {
    const context = this.authorization.currentContext(actorId);
    if (
      !context ||
      !(await this.authorization.hasPermission(actorId, "redflag.create"))
    )
      throw new ForbiddenException("Red flag creation permission is required.");
    const period = requestedPeriod
      ? normalizeJalaliPeriod(requestedPeriod)
      : currentJalaliPeriod();
    if (!period)
      throw new BadRequestException("Invalid Jalali reporting period.");
    const rules = await this.db
      .select()
      .from(redFlagRules)
      .where(
        and(
          eq(redFlagRules.holdingId, BigInt(context.holdingId)),
          eq(redFlagRules.enabled, true),
          context.companyId
            ? or(
                eq(redFlagRules.companyId, BigInt(context.companyId)),
                isNull(redFlagRules.companyId),
              )
            : undefined,
        ),
      )
      .orderBy(desc(redFlagRules.createdAt));
    const candidates = await this.db
      .select()
      .from(kpiManagementKpis)
      .where(
        and(
          eq(kpiManagementKpis.holdingId, BigInt(context.holdingId)),
          eq(kpiManagementKpis.active, true),
          eq(kpiManagementKpis.status, "published"),
          context.companyId
            ? eq(kpiManagementKpis.companyId, BigInt(context.companyId))
            : undefined,
        ),
      )
      .orderBy(asc(kpiManagementKpis.id))
      .limit(1000);
    let created = 0;
    for (const kpi of candidates) {
      if (
        !(await this.authorization.canAccessKpi(
          actorId,
          kpi.id,
          "redflag.create",
        ))
      )
        continue;
      const scopedRules = rules
        .filter(
          (rule) => rule.companyId === null || rule.companyId === kpi.companyId,
        )
        .filter(
          (rule) =>
            rule.businessUnitId === null ||
            rule.businessUnitId === kpi.businessUnitId,
        )
        .filter((rule) => rule.kpiId === null || rule.kpiId === kpi.id);
      if (!scopedRules.length) continue;
      const [periodValue] = await this.db
        .select()
        .from(kpiManagementValues)
        .where(
          and(
            eq(kpiManagementValues.kpiId, kpi.id),
            eq(kpiManagementValues.period, period),
          ),
        )
        .orderBy(desc(kpiManagementValues.version))
        .limit(1);
      const [latestValue] = periodValue
        ? [periodValue]
        : await this.db
            .select()
            .from(kpiManagementValues)
            .where(eq(kpiManagementValues.kpiId, kpi.id))
            .orderBy(
              desc(kpiManagementValues.period),
              desc(kpiManagementValues.version),
            )
            .limit(1);
      const dataState =
        periodValue?.dataState ??
        (latestValue && latestValue.period < period ? "stale" : "missing");
      const history = await this.db
        .select({ actualValue: kpiManagementValues.actualValue })
        .from(kpiManagementValues)
        .where(
          and(
            eq(kpiManagementValues.kpiId, kpi.id),
            eq(kpiManagementValues.isCurrent, true),
          ),
        )
        .orderBy(desc(kpiManagementValues.period))
        .limit(6);
      const historyValues = history.flatMap((value) =>
        value.actualValue === null ? [] : [Number(value.actualValue)],
      );
      const actual =
        periodValue?.actualValue === null || periodValue === undefined
          ? null
          : Number(periodValue.actualValue);
      const matched = scopedRules.find((rule) =>
        matchesRedFlagRule(
          {
            trigger: rule.trigger,
            configuration: rule.configuration as Record<string, unknown>,
          },
          {
            actual,
            threshold:
              kpi.criticalValue === null ? null : Number(kpi.criticalValue),
            direction: kpi.direction,
            history: historyValues,
            dataState,
          },
        ),
      );
      if (!matched) continue;
      const [existing] = await this.db
        .select({ id: redFlags.id })
        .from(redFlags)
        .where(
          and(
            eq(redFlags.kpiId, kpi.id),
            eq(redFlags.period, period),
            sql`${redFlags.status} not in ('resolved','closed')`,
          ),
        )
        .limit(1);
      if (existing) continue;
      await this.db.transaction(async (tx) => {
        const [flag] = await tx
          .insert(redFlags)
          .values({
            holdingId: kpi.holdingId,
            companyId: kpi.companyId,
            branchId: kpi.branchId,
            businessUnitId: kpi.businessUnitId,
            kpiId: kpi.id,
            period,
            triggerValue: periodValue?.actualValue ?? null,
            threshold: kpi.criticalValue,
            description: `Rule ${matched.trigger} was triggered for KPI ${kpi.name}`,
            severity: matched.severity,
            ownerUserId: kpi.ownerUserId,
            status: "new",
            source: "kpi_rule",
          })
          .returning();
        await tx.insert(auditLogs).values({
          userId: actorId,
          holdingId: kpi.holdingId,
          companyId: kpi.companyId,
          membershipId: BigInt(context.membershipId),
          actorName: "System",
          action: "kpi.red_flag.created",
          subjectType: "RedFlag",
          subjectId: flag.id,
          description: "Periodic KPI evaluation created a red flag",
          context: {
            ruleId: matched.id.toString(),
            trigger: matched.trigger,
            period,
            dataState,
            value: periodValue?.actualValue ?? null,
          },
          ipAddress: null,
          userAgent: null,
        });
      });
      created += 1;
    }

    const overdueActions = await this.db
      .select({
        action: correctiveActions,
        kpiId: correctiveAlerts.kpiId,
        holdingId: companies.holdingId,
        companyId: companies.id,
        businessUnitId: businessUnits.id,
        branchId: businessUnits.branchId,
      })
      .from(correctiveActions)
      .leftJoin(
        correctiveAlerts,
        eq(correctiveActions.alertId, correctiveAlerts.id),
      )
      .innerJoin(
        businessUnits,
        eq(businessUnits.legacyDepartmentId, correctiveActions.departmentId),
      )
      .innerJoin(companies, eq(businessUnits.companyId, companies.id))
      .where(
        and(
          eq(companies.holdingId, BigInt(context.holdingId)),
          context.companyId
            ? eq(companies.id, BigInt(context.companyId))
            : undefined,
          isNotNull(correctiveActions.dueAt),
          sql`${correctiveActions.dueAt} < now()`,
          sql`${correctiveActions.status} not in ('closed','canceled','done')`,
        ),
      )
      .limit(1000);
    for (const row of overdueActions) {
      const scope = {
        holdingId: row.holdingId.toString(),
        companyId: row.companyId.toString(),
        branchId: row.branchId?.toString() ?? null,
        businessUnitId: row.businessUnitId.toString(),
      };
      if (!(await this.authorization.can(context, "redflag.create", scope)))
        continue;
      const matching = rules.find(
        (rule) =>
          rule.trigger === "action_overdue" &&
          (rule.companyId === null || rule.companyId === row.companyId) &&
          (rule.businessUnitId === null ||
            rule.businessUnitId === row.businessUnitId) &&
          (rule.kpiId === null || rule.kpiId === row.kpiId),
      );
      if (!matching) continue;
      const [existing] = await this.db
        .select({ id: redFlags.id })
        .from(redFlags)
        .where(
          and(
            eq(redFlags.actionId, row.action.id),
            sql`${redFlags.status} not in ('resolved','closed')`,
          ),
        )
        .limit(1);
      if (existing) continue;
      await this.db.transaction(async (tx) => {
        const [flag] = await tx
          .insert(redFlags)
          .values({
            holdingId: row.holdingId,
            companyId: row.companyId,
            branchId: row.branchId,
            businessUnitId: row.businessUnitId,
            kpiId: row.kpiId,
            actionId: row.action.id,
            period,
            triggerValue: null,
            threshold: null,
            description: `Action is overdue: ${row.action.title}`,
            severity: matching.severity,
            ownerUserId: row.action.ownerUserId,
            deadline: row.action.dueAt?.toISOString().slice(0, 10) ?? null,
            status: "new",
            source: "kpi_rule",
          })
          .returning();
        await tx.insert(auditLogs).values({
          userId: actorId,
          holdingId: row.holdingId,
          companyId: row.companyId,
          membershipId: BigInt(context.membershipId),
          actorName: "System",
          action: "kpi.red_flag.created",
          subjectType: "RedFlag",
          subjectId: flag.id,
          description: "Overdue action rule created a red flag",
          context: {
            actionId: row.action.id.toString(),
            ruleId: matching.id.toString(),
            trigger: matching.trigger,
            dueAt: row.action.dueAt?.toISOString() ?? null,
          },
          ipAddress: null,
          userAgent: null,
        });
      });
      created += 1;
    }
    const overdueDecisions = await this.db
      .select()
      .from(managementDecisions)
      .where(
        and(
          eq(managementDecisions.holdingId, BigInt(context.holdingId)),
          context.companyId
            ? eq(managementDecisions.companyId, BigInt(context.companyId))
            : undefined,
          inArray(managementDecisions.status, [
            "approved",
            "communicated",
            "in_progress",
            "result_review",
          ]),
          sql`${managementDecisions.deadline} < CURRENT_DATE`,
        ),
      )
      .orderBy(asc(managementDecisions.deadline))
      .limit(1000);
    for (const decision of overdueDecisions) {
      const scope = {
        holdingId: decision.holdingId.toString(),
        companyId: decision.companyId.toString(),
        branchId: decision.branchId?.toString() ?? null,
        businessUnitId: decision.businessUnitId?.toString() ?? null,
        ownerId: decision.ownerUserId?.toString() ?? null,
      };
      if (
        !(await this.authorization.can(context, "decision.view", scope)) ||
        !(await this.authorization.can(context, "redflag.create", scope))
      )
        continue;
      const linkedKpiIds = Array.isArray(decision.relatedKpiIds)
        ? decision.relatedKpiIds.map(String)
        : [];
      const matching = rules.find(
        (rule) =>
          rule.trigger === "decision_overdue" &&
          (rule.companyId === null || rule.companyId === decision.companyId) &&
          (rule.businessUnitId === null ||
            rule.businessUnitId === decision.businessUnitId) &&
          (rule.kpiId === null || linkedKpiIds.includes(rule.kpiId.toString())),
      );
      if (!matching) continue;
      const [existing] = await this.db
        .select({ id: redFlags.id })
        .from(redFlags)
        .where(
          and(
            eq(redFlags.decisionId, decision.id),
            sql`${redFlags.status} not in ('resolved','closed')`,
          ),
        )
        .limit(1);
      if (existing) continue;
      await this.db.transaction(async (tx) => {
        const [flag] = await tx
          .insert(redFlags)
          .values({
            holdingId: decision.holdingId,
            companyId: decision.companyId,
            branchId: decision.branchId,
            businessUnitId: decision.businessUnitId,
            decisionId: decision.id,
            period: decision.period ?? period,
            triggerValue: null,
            threshold: null,
            description: `Decision is overdue: ${decision.decisionText.slice(0, 1800)}`,
            severity: matching.severity,
            ownerUserId: decision.ownerUserId,
            deadline: decision.deadline,
            status: "new",
            source: "kpi_rule",
          })
          .returning();
        await tx.insert(auditLogs).values({
          userId: actorId,
          holdingId: decision.holdingId,
          companyId: decision.companyId,
          membershipId: BigInt(context.membershipId),
          actorName: "System",
          action: "kpi.red_flag.created",
          subjectType: "RedFlag",
          subjectId: flag.id,
          description: "Overdue decision rule created a red flag",
          context: {
            decisionId: decision.id.toString(),
            ruleId: matching.id.toString(),
            trigger: matching.trigger,
            deadline: decision.deadline,
          } as JsonValue,
          ipAddress: null,
          userAgent: null,
        });
      });
      created += 1;
    }
    return {
      period,
      evaluatedKpis: candidates.length,
      evaluatedActions: overdueActions.length,
      evaluatedDecisions: overdueDecisions.length,
      createdRedFlags: created,
    };
  }

  async studioBoard(userId: bigint) {
    if (!(await this.authorization.hasPermission(userId, "kpi.view")))
      throw new ForbiddenException("Permission denied.");
    const candidates = await this.db
      .select()
      .from(kpiManagementKpis)
      .where(eq(kpiManagementKpis.active, true))
      .orderBy(asc(kpiManagementKpis.name))
      .limit(500);
    const visible = (
      await Promise.all(
        candidates.map(async (kpi) =>
          (await this.authorization.canAccessKpi(userId, kpi.id, "kpi.view"))
            ? kpi
            : null,
        ),
      )
    ).filter((kpi): kpi is (typeof candidates)[number] => kpi !== null);
    const ids = visible.map(({ id }) => id);
    const ownerIds = [
      ...new Set(
        visible.flatMap((kpi) =>
          kpi.ownerUserId === null ? [] : [kpi.ownerUserId],
        ),
      ),
    ];
    const departmentIds = [
      ...new Set(
        visible.flatMap((kpi) =>
          kpi.departmentId === null ? [] : [kpi.departmentId],
        ),
      ),
    ];
    const businessUnitIds = [
      ...new Set(
        visible.flatMap((kpi) =>
          kpi.businessUnitId === null ? [] : [kpi.businessUnitId],
        ),
      ),
    ];
    const companyIds = [...new Set(visible.map((kpi) => kpi.companyId))];
    const [values, owners, units, businessUnitRows, companyRows] =
      await Promise.all([
        ids.length
          ? this.db
              .select()
              .from(kpiManagementValues)
              .where(inArray(kpiManagementValues.kpiId, ids))
              .orderBy(
                desc(kpiManagementValues.createdAt),
                desc(kpiManagementValues.id),
              )
          : Promise.resolve([]),
        ownerIds.length
          ? this.db
              .select({
                id: users.id,
                firstName: users.firstName,
                lastName: users.lastName,
              })
              .from(users)
              .where(inArray(users.id, ownerIds))
          : Promise.resolve([]),
        departmentIds.length
          ? this.db
              .select({ id: departments.id, name: departments.name })
              .from(departments)
              .where(inArray(departments.id, departmentIds))
          : Promise.resolve([]),
        businessUnitIds.length
          ? this.db
              .select({ id: businessUnits.id, name: businessUnits.name })
              .from(businessUnits)
              .where(inArray(businessUnits.id, businessUnitIds))
          : Promise.resolve([]),
        companyIds.length
          ? this.db
              .select({ id: companies.id, name: companies.name })
              .from(companies)
              .where(inArray(companies.id, companyIds))
          : Promise.resolve([]),
      ]);
    const latest = new Map<bigint, (typeof values)[number]>();
    for (const value of values)
      if (!latest.has(value.kpiId)) latest.set(value.kpiId, value);
    const ownerName = new Map(
      owners.map((owner) => [
        owner.id,
        [owner.firstName, owner.lastName].filter(Boolean).join(" ") ||
          "تعیین نشده",
      ]),
    );
    const departmentName = new Map(units.map((unit) => [unit.id, unit.name]));
    const businessUnitName = new Map(
      businessUnitRows.map((unit) => [unit.id, unit.name]),
    );
    const companyName = new Map(
      companyRows.map((company) => [company.id, company.name]),
    );
    const rows = visible.map((kpi) => ({
      id: kpi.id.toString(),
      companyId: kpi.companyId.toString(),
      businessUnitId: kpi.businessUnitId?.toString() ?? null,
      branchId: kpi.branchId?.toString() ?? null,
      domain: kpi.domain,
      description: kpi.description,
      direction: kpi.direction,
      name: kpi.name,
      code: kpi.code,
      department:
        kpi.businessUnitId !== null
          ? (businessUnitName.get(kpi.businessUnitId) ?? "—")
          : kpi.departmentId !== null
            ? (departmentName.get(kpi.departmentId) ?? "—")
            : (companyName.get(kpi.companyId) ?? "—"),
      unit: kpi.unit,
      target: kpi.targetValue,
      latestValue: latest.get(kpi.id)?.actualValue ?? null,
      latestPeriod: latest.get(kpi.id)?.period ?? null,
      latestUpdatedAt: latest.get(kpi.id)?.updatedAt?.toISOString() ?? null,
      latestDataState: latest.get(kpi.id)?.dataState ?? "missing",
      health: latest.get(kpi.id)?.status ?? "unknown",
      owner:
        kpi.ownerUserId === null
          ? "تعیین نشده"
          : (ownerName.get(kpi.ownerUserId) ?? "تعیین نشده"),
      version: kpi.version,
      status: kpi.status,
      active: kpi.active,
    }));
    return { activeCount: rows.filter((row) => row.active).length, rows };
  }

  private checkinCard(
    kpi: typeof kpiManagementKpis.$inferSelect,
    departmentName: string | null,
    period: string,
    status: "due" | "late" | "submitted" | "revised",
    actual: string | null,
    health: KpiHealth,
    draft: boolean,
    note = "",
  ) {
    return {
      kpiId: kpi.id.toString(),
      name: kpi.name,
      inputMode: kpi.inputMode,
      inputOptions: Array.isArray(kpi.inputOptions) ? kpi.inputOptions : [],
      formulaType: kpi.formulaType,
      department: departmentName ?? "—",
      unit: kpi.unit,
      period,
      target: kpi.targetValue,
      actual,
      health,
      frequency: kpi.frequency,
      direction: kpi.direction,
      status:
        draft && (status === "due" || status === "late")
          ? ("draft" as const)
          : status,
      note,
    };
  }
}
