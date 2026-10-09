import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  auditLogs,
  derivedKpiValues,
  derivedKpiVersions,
  derivedKpis,
  kpiManagementKpis,
  kpiManagementValues,
  type JsonValue,
} from "../../../../../src/db/schema.js";
import { BaseRepository } from "../../common/repository/base.repository.js";
import {
  DRIZZLE_DB,
  type DrizzleDatabase,
} from "../../database/database.token.js";
import {
  normalizeJalaliPeriod,
  shiftJalaliPeriod,
} from "../../shared/jalali.js";
import { AuthorizationService } from "../authorization/authorization.service.js";
import {
  evaluateFormula,
  formulaReferences,
  parseFormula,
  validateFormula,
  type FormulaAst,
  type FormulaMetric,
} from "./formula-engine.js";

type DefinitionInput = {
  code: string;
  name: string;
  description?: string;
  formula: string;
  unit: string;
  periodType: string;
  businessUnitId?: bigint | null;
  ownerUserId?: bigint | null;
  targetValue?: number | null;
};
const safe = <T>(value: T): T =>
  JSON.parse(
    JSON.stringify(value, (_key, item) =>
      typeof item === "bigint" ? item.toString() : item,
    ),
  ) as T;

@Injectable()
export class DerivedKpiRepository extends BaseRepository {
  constructor(
    @Inject(DRIZZLE_DB) db: DrizzleDatabase,
    private readonly authorization: AuthorizationService,
  ) {
    super(db);
  }

  private async scope(
    actorId: bigint,
    permission: string,
    businessUnitId?: bigint | null,
  ) {
    const context = this.authorization.currentContext(actorId);
    if (!context?.companyId || !context.membershipId)
      throw new ForbiddenException("An active company membership is required.");
    const unitId =
      businessUnitId === undefined
        ? context.businessUnitId
          ? BigInt(context.businessUnitId)
          : null
        : businessUnitId;
    if (
      context.scopeType === "businessUnit" &&
      context.businessUnitId !== unitId?.toString()
    )
      throw new ForbiddenException(
        "The requested Business Unit is outside your scope.",
      );
    const resource = {
      holdingId: context.holdingId,
      companyId: context.companyId,
      branchId: context.branchId,
      businessUnitId: unitId?.toString() ?? null,
    };
    if (!(await this.authorization.can(context, permission, resource)))
      throw new ForbiddenException(
        `Permission ${permission} is required for this scope.`,
      );
    return {
      context,
      resource,
      holdingId: BigInt(context.holdingId),
      companyId: BigInt(context.companyId),
      businessUnitId: unitId,
    };
  }

  private async accessibleSources(actorId: bigint, companyId: bigint) {
    const rows = await this.db
      .select()
      .from(kpiManagementKpis)
      .where(
        and(
          eq(kpiManagementKpis.companyId, companyId),
          eq(kpiManagementKpis.status, "published"),
          eq(kpiManagementKpis.active, true),
        ),
      );
    const context = this.authorization.currentContext(actorId);
    if (!context)
      throw new ForbiddenException("An active company membership is required.");
    const available = [];
    for (const row of rows) {
      if (await this.authorization.canAccessKpi(actorId, row.id, "kpi.view"))
        available.push({
          id: row.id.toString(),
          code: row.code,
          name: row.name,
          companyId: row.companyId.toString(),
          unit: row.unit,
          periodType: row.reportingPeriod,
          status: row.status,
        });
    }
    return available;
  }

  async list(actorId: bigint) {
    const { context, companyId } = await this.scope(actorId, "formula.view");
    const rows = await this.db
      .select()
      .from(derivedKpis)
      .where(eq(derivedKpis.companyId, companyId))
      .orderBy(desc(derivedKpis.updatedAt));
    const allowed = [];
    for (const row of rows)
      if (
        await this.authorization.can(context, "formula.view", {
          holdingId: row.holdingId.toString(),
          companyId: row.companyId.toString(),
          businessUnitId: row.businessUnitId?.toString() ?? null,
          ownerId: row.ownerUserId?.toString() ?? null,
        })
      )
        allowed.push(row);
    return safe(allowed);
  }

  async sources(actorId: bigint) {
    const { companyId } = await this.scope(actorId, "formula.view");
    return this.accessibleSources(actorId, companyId);
  }

  async validate(
    actorId: bigint,
    input: Pick<
      DefinitionInput,
      "formula" | "unit" | "periodType" | "businessUnitId"
    >,
  ) {
    const { companyId } = await this.scope(
      actorId,
      "formula.create",
      input.businessUnitId,
    );
    const sources = await this.accessibleSources(actorId, companyId);
    const ast = parseFormula(input.formula, sources) as FormulaAst;
    const validation = validateFormula({
      ast,
      metrics: sources.map((source) => ({ ...source, actual: null })),
      companyId: companyId.toString(),
      expectedUnit: input.unit,
      expectedPeriodType: input.periodType,
    });
    return {
      valid: true,
      ast,
      sourceKpis: validation.sourceKpis,
      unit: validation.unit,
      periodType: input.periodType,
    };
  }

  async create(actorId: bigint, input: DefinitionInput) {
    const { context, resource, holdingId, companyId, businessUnitId } =
      await this.scope(actorId, "formula.create", input.businessUnitId);
    if (!(await this.authorization.can(context, "kpi.create", resource)))
      throw new ForbiddenException(
        "KPI creation permission is required for this scope.",
      );
    const code = input.code.trim().toLowerCase();
    if (!/^[a-z][a-z0-9_-]{1,63}$/.test(code))
      throw new BadRequestException(
        "Derived KPI code must use 2–64 lowercase letters, numbers, underscores, or hyphens and start with a letter.",
      );
    if (!input.name.trim() || !input.unit.trim())
      throw new BadRequestException("A KPI name and result unit are required.");
    const [baseConflict] = await this.db
      .select({ id: kpiManagementKpis.id })
      .from(kpiManagementKpis)
      .where(
        and(
          eq(kpiManagementKpis.companyId, companyId),
          eq(kpiManagementKpis.code, code),
        ),
      )
      .limit(1);
    const [derivedConflict] = await this.db
      .select({ id: derivedKpis.id })
      .from(derivedKpis)
      .where(
        and(eq(derivedKpis.companyId, companyId), eq(derivedKpis.code, code)),
      )
      .limit(1);
    if (baseConflict || derivedConflict)
      throw new BadRequestException(
        "KPI code is already used in this company.",
      );
    const sources = await this.accessibleSources(actorId, companyId);
    const ast = parseFormula(input.formula, sources) as FormulaAst;
    const validation = validateFormula({
      ast,
      metrics: sources.map((source) => ({ ...source, actual: null })),
      companyId: companyId.toString(),
      expectedUnit: input.unit,
      expectedPeriodType: input.periodType,
    });
    const [row] = await this.db
      .insert(derivedKpis)
      .values({
        holdingId,
        companyId,
        businessUnitId,
        code,
        name: input.name.trim().slice(0, 200),
        description: input.description?.trim().slice(0, 2000) ?? "",
        sourceKpis: validation.sourceKpis,
        formulaAst: ast as unknown as JsonValue,
        formulaSource: input.formula.trim(),
        formulaVersion: 1,
        unit: input.unit.trim(),
        periodType: input.periodType.trim(),
        ownerUserId: input.ownerUserId ?? actorId,
        targetValue:
          input.targetValue == null ? null : String(input.targetValue),
        status: "draft",
        version: 1,
        createdBy: actorId,
      })
      .returning();
    await this.saveVersion(actorId, row);
    await this.audit(actorId, row, "formula.created", {
      version: row.version,
      sourceKpis: validation.sourceKpis,
    });
    return safe(row);
  }

  async update(actorId: bigint, id: bigint, input: Partial<DefinitionInput>) {
    const current = await this.findAuthorized(actorId, id, "formula.update");
    if (current.status !== "draft")
      throw new BadRequestException(
        "Only draft derived KPIs can be edited; publish a new version through the revision workflow.",
      );
    const nextBusinessUnitId =
      input.businessUnitId === undefined
        ? current.businessUnitId
        : input.businessUnitId;
    const { companyId, resource, context } = await this.scope(
      actorId,
      "formula.update",
      nextBusinessUnitId,
    );
    if (companyId !== current.companyId)
      throw new ForbiddenException(
        "A derived KPI cannot move between companies.",
      );
    const next = { ...current, ...input };
    const sources = await this.accessibleSources(actorId, current.companyId);
    const ast = parseFormula(
      next.formula ?? current.formulaSource,
      sources,
    ) as FormulaAst;
    const validation = validateFormula({
      ast,
      metrics: sources.map((source) => ({ ...source, actual: null })),
      companyId: companyId.toString(),
      expectedUnit: next.unit ?? current.unit,
      expectedPeriodType: next.periodType ?? current.periodType,
      derivedId: id.toString(),
    });
    const changedFormula =
      JSON.stringify(ast) !== JSON.stringify(current.formulaAst);
    const [row] = await this.db
      .update(derivedKpis)
      .set({
        name: input.name?.trim().slice(0, 200) ?? current.name,
        description:
          input.description?.trim().slice(0, 2000) ?? current.description,
        formulaAst: ast as unknown as JsonValue,
        formulaSource: next.formula?.trim() ?? current.formulaSource,
        sourceKpis: validation.sourceKpis,
        formulaVersion: current.formulaVersion + (changedFormula ? 1 : 0),
        unit: next.unit ?? current.unit,
        periodType: next.periodType ?? current.periodType,
        businessUnitId: nextBusinessUnitId,
        ownerUserId:
          input.ownerUserId === undefined
            ? current.ownerUserId
            : input.ownerUserId,
        targetValue:
          input.targetValue === undefined
            ? current.targetValue
            : input.targetValue === null
              ? null
              : String(input.targetValue),
        version: current.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(derivedKpis.id, id))
      .returning();
    await this.saveVersion(actorId, row);
    await this.audit(actorId, row, "formula.updated", {
      version: row.version,
      formulaVersion: row.formulaVersion,
      changedFormula,
    });
    return safe(row);
  }

  async publish(actorId: bigint, id: bigint) {
    const row = await this.findAuthorized(actorId, id, "formula.publish");
    if (row.status !== "draft")
      throw new BadRequestException(
        "Only draft derived KPIs can be published.",
      );
    const { context, companyId } = await this.scope(
      actorId,
      "formula.publish",
      row.businessUnitId,
    );
    const sources = await this.accessibleSources(actorId, companyId);
    const validation = validateFormula({
      ast: row.formulaAst as unknown as FormulaAst,
      metrics: sources.map((source) => ({ ...source, actual: null })),
      companyId: row.companyId.toString(),
      expectedUnit: row.unit,
      expectedPeriodType: row.periodType,
      derivedId: row.id.toString(),
    });
    if (
      validation.sourceKpis.length !==
      formulaReferences(row.formulaAst as unknown as FormulaAst).length
    )
      throw new BadRequestException("Formula references are invalid.");
    const [updated] = await this.db
      .update(derivedKpis)
      .set({
        status: "published",
        version: row.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(derivedKpis.id, id))
      .returning();
    await this.saveVersion(actorId, updated);
    await this.audit(actorId, updated, "formula.published", {
      version: updated.version,
      formulaVersion: updated.formulaVersion,
    });
    return safe(updated);
  }

  async calculate(actorId: bigint, id: bigint, requestedPeriod: string) {
    const row = await this.findAuthorized(actorId, id, "formula.view");
    if (row.status !== "published")
      throw new BadRequestException(
        "Only published derived KPIs can be calculated.",
      );
    const period = normalizeJalaliPeriod(requestedPeriod);
    if (!period)
      throw new BadRequestException("A valid reporting period is required.");
    const sourceIds = (
      Array.isArray(row.sourceKpis) ? row.sourceKpis : []
    ).filter((value): value is string => typeof value === "string");
    if (!sourceIds.length)
      throw new BadRequestException("Formula has no valid source KPIs.");
    const parsedIds = sourceIds.map(BigInt);
    const baseRows = await this.db
      .select()
      .from(kpiManagementKpis)
      .where(
        and(
          eq(kpiManagementKpis.companyId, row.companyId),
          inArray(kpiManagementKpis.id, parsedIds),
        ),
      );
    const previousPeriod = shiftJalaliPeriod(period, -1);
    const values = await this.db
      .select()
      .from(kpiManagementValues)
      .where(
        and(
          eq(kpiManagementValues.companyId, row.companyId),
          eq(kpiManagementValues.period, period),
          eq(kpiManagementValues.isCurrent, true),
          inArray(kpiManagementValues.kpiId, parsedIds),
        ),
      );
    const previousValues = previousPeriod
      ? await this.db
          .select()
          .from(kpiManagementValues)
          .where(
            and(
              eq(kpiManagementValues.companyId, row.companyId),
              eq(kpiManagementValues.period, previousPeriod),
              eq(kpiManagementValues.isCurrent, true),
              inArray(kpiManagementValues.kpiId, parsedIds),
            ),
          )
      : [];
    const byId = new Map(
      values.map((value) => [value.kpiId.toString(), value]),
    );
    const previousById = new Map(
      previousValues.map((value) => [value.kpiId.toString(), value]),
    );
    const metrics = new Map<
      string,
      { actual: number | null; previousActual: number | null }
    >();
    const snapshot: Record<string, JsonValue> = {};
    for (const sourceId of sourceIds) {
      const base = baseRows.find(
        (candidate) => candidate.id.toString() === sourceId,
      );
      if (
        !base ||
        !(await this.authorization.canAccessKpi(actorId, base.id, "kpi.view"))
      )
        throw new ForbiddenException(
          "A formula source is no longer accessible.",
        );
      const value = byId.get(sourceId);
      const previous = previousById.get(sourceId);
      const actual =
        value?.actualValue == null ? null : Number(value.actualValue);
      const previousActual =
        previous?.actualValue == null ? null : Number(previous.actualValue);
      metrics.set(sourceId, { actual, previousActual });
      snapshot[sourceId] = {
        kpiId: sourceId,
        code: base.code,
        name: base.name,
        unit: base.unit,
        period,
        actualValue: actual,
        source: value?.source ?? null,
        reporterId: value?.submittedBy?.toString() ?? null,
        reviewerId: value?.reviewedBy?.toString() ?? null,
        approvedBy: value?.approvedBy?.toString() ?? null,
        recordId: value?.id.toString() ?? null,
        approvedAt: value?.approvedAt?.toISOString() ?? null,
        evidence: value?.rawValue ?? null,
      };
    }
    const result = evaluateFormula(
      row.formulaAst as unknown as FormulaAst,
      metrics,
    );
    const { context } = await this.scope(
      actorId,
      "formula.view",
      row.businessUnitId,
    );
    await this.db
      .insert(derivedKpiValues)
      .values({
        derivedKpiId: row.id,
        companyId: row.companyId,
        businessUnitId: row.businessUnitId,
        period,
        formulaVersion: row.formulaVersion,
        actualValue: result.toFixed(4),
        sourceSnapshot: snapshot,
        calculatedBy: actorId,
      })
      .onConflictDoUpdate({
        target: [
          derivedKpiValues.derivedKpiId,
          derivedKpiValues.period,
          derivedKpiValues.formulaVersion,
        ],
        set: {
          actualValue: result.toFixed(4),
          sourceSnapshot: snapshot,
          calculatedBy: actorId,
          calculatedAt: new Date(),
        },
      });
    await this.audit(actorId, row, "formula.calculated", {
      period,
      result,
      formulaVersion: row.formulaVersion,
    });
    return safe({
      derivedKpiId: row.id,
      code: row.code,
      name: row.name,
      period,
      actualValue: result,
      unit: row.unit,
      formulaVersion: row.formulaVersion,
      sourceSnapshot: snapshot,
    });
  }

  async drilldown(actorId: bigint, id: bigint, period: string) {
    const row = await this.findAuthorized(actorId, id, "formula.view");
    const normalized = normalizeJalaliPeriod(period);
    if (!normalized)
      throw new BadRequestException("A valid reporting period is required.");
    const [value] = await this.db
      .select()
      .from(derivedKpiValues)
      .where(
        and(
          eq(derivedKpiValues.derivedKpiId, id),
          eq(derivedKpiValues.period, normalized),
          eq(derivedKpiValues.companyId, row.companyId),
        ),
      )
      .orderBy(desc(derivedKpiValues.calculatedAt))
      .limit(1);
    return safe({
      summary: {
        id: row.id,
        name: row.name,
        code: row.code,
        formulaVersion: row.formulaVersion,
      },
      period: normalized,
      value: value ?? null,
      sources: value?.sourceSnapshot ?? [],
    });
  }

  async history(actorId: bigint, id: bigint) {
    const row = await this.findAuthorized(actorId, id, "formula.view");
    const [versions, values] = await Promise.all([
      this.db
        .select()
        .from(derivedKpiVersions)
        .where(eq(derivedKpiVersions.derivedKpiId, row.id))
        .orderBy(desc(derivedKpiVersions.version))
        .limit(100),
      this.db
        .select()
        .from(derivedKpiValues)
        .where(eq(derivedKpiValues.derivedKpiId, row.id))
        .orderBy(desc(derivedKpiValues.calculatedAt))
        .limit(100),
    ]);
    return safe({ versions, values });
  }

  async detail(actorId: bigint, id: bigint) {
    const row = await this.findAuthorized(actorId, id, "formula.view");
    return safe(row);
  }

  private async findAuthorized(
    actorId: bigint,
    id: bigint,
    permission: string,
  ) {
    const [row] = await this.db
      .select()
      .from(derivedKpis)
      .where(eq(derivedKpis.id, id))
      .limit(1);
    if (!row) throw new NotFoundException("Derived KPI not found.");
    const context = this.authorization.currentContext(actorId);
    if (
      !context ||
      !(await this.authorization.can(context, permission, {
        holdingId: row.holdingId.toString(),
        companyId: row.companyId.toString(),
        businessUnitId: row.businessUnitId?.toString() ?? null,
        ownerId: row.ownerUserId?.toString() ?? null,
      }))
    )
      throw new ForbiddenException(
        "Derived KPI is outside your authorized scope.",
      );
    return row;
  }

  private saveVersion(actorId: bigint, row: typeof derivedKpis.$inferSelect) {
    const definition = {
      code: row.code,
      name: row.name,
      description: row.description,
      sourceKpis: row.sourceKpis,
      formulaAst: row.formulaAst,
      formulaSource: row.formulaSource,
      formulaVersion: row.formulaVersion,
      unit: row.unit,
      periodType: row.periodType,
      businessUnitId: row.businessUnitId?.toString() ?? null,
      ownerUserId: row.ownerUserId?.toString() ?? null,
      targetValue: row.targetValue,
      status: row.status,
    } as JsonValue;
    return this.db
      .insert(derivedKpiVersions)
      .values({
        derivedKpiId: row.id,
        version: row.version,
        formulaVersion: row.formulaVersion,
        definition,
        createdBy: actorId,
      });
  }

  private audit(
    actorId: bigint,
    row: typeof derivedKpis.$inferSelect,
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
      subjectType: "DerivedKpi",
      subjectId: row.id,
      description: action.replaceAll(".", " "),
      context: {
        derivedKpiId: row.id.toString(),
        companyId: row.companyId.toString(),
        ...detail,
      },
      ipAddress: null,
      userAgent: null,
    });
  }
}
