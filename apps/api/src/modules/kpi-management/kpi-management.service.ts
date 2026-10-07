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
  max,
  or,
  sql,
} from "drizzle-orm";
import { randomBytes } from "node:crypto";
import {
  DRIZZLE_DB,
  type DrizzleDatabase,
} from "../../database/database.token.js";
import { AuthorizationService } from "../authorization/authorization.service.js";
import {
  currentJalaliPeriod,
  jalaliPeriodSeries,
  normalizeJalaliPeriod,
} from "../../shared/jalali.js";
import {
  auditLogs,
  correctiveAlerts,
  departments,
  inboxNotifications,
  kpiManagementCheckins,
  kpiManagementKpis,
  kpiManagementValues,
  kpiStudioOptions,
  users,
  type CheckinStatus,
  type JsonValue,
  type KpiDirection,
  type KpiHealth,
} from "../../../../../src/db/schema.js";

@Injectable()
export class KpiManagementService {
  static health(
    actual: number | null,
    target: number,
    direction: KpiDirection,
    warning: number | null = null,
    critical: number | null = null,
  ): KpiHealth {
    if (actual === null || !Number.isFinite(actual)) return "unknown";
    const criticalBound =
      critical ??
      warning ??
      (direction === "lower" ? target * 1.3 : target * 0.7);
    if (direction === "higher")
      return actual >= target
        ? "green"
        : actual < criticalBound
          ? "red"
          : "yellow";
    if (direction === "lower")
      return actual <= target
        ? "green"
        : actual > criticalBound
          ? "red"
          : "yellow";
    return actual >= target
      ? "green"
      : actual < criticalBound
        ? "red"
        : "yellow";
  }

  static defaultWarning(target: number, direction: KpiDirection): number {
    return direction === "lower" ? target * 1.15 : target * 0.85;
  }
  static defaultCritical(target: number, direction: KpiDirection): number {
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
      warning ?? KpiManagementService.defaultWarning(target, direction);
    const resolvedCritical =
      critical ?? KpiManagementService.defaultCritical(target, direction);
    if (
      direction === "lower"
        ? resolvedCritical < resolvedWarning
        : resolvedCritical > resolvedWarning
    )
      throw new BadRequestException(
        "Critical threshold is inconsistent with warning threshold.",
      );
    return { warning: resolvedWarning, critical: resolvedCritical };
  }

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase,
    private readonly authorization: AuthorizationService,
  ) {}

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
        KpiManagementService.normalizeCode(name) ||
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
    if (!(await this.authorization.hasPermission(actorId, "kpi.manage")))
      throw new ForbiddenException("KPI management permission is required.");
    const globalScope = await this.authorization.hasPermission(
      actorId,
      "access-all-departments",
    );
    const [viewer] = await this.db
      .select({ departmentId: users.departmentId })
      .from(users)
      .where(eq(users.id, actorId))
      .limit(1);
    const departmentScope = globalScope
      ? undefined
      : viewer?.departmentId
        ? eq(departments.id, viewer.departmentId)
        : sql`false`;
    const peopleScope = globalScope
      ? undefined
      : viewer?.departmentId
        ? eq(users.departmentId, viewer.departmentId)
        : sql`false`;
    const [departmentRows, peopleRows, inputModes, directions, frequencies] =
      await Promise.all([
        this.db
          .select({ id: departments.id, name: departments.name })
          .from(departments)
          .where(departmentScope)
          .orderBy(asc(departments.name)),
        this.db
          .select({
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            mobile: users.mobile,
            departmentId: users.departmentId,
          })
          .from(users)
          .where(and(isNotNull(users.approvedAt), peopleScope))
          .orderBy(asc(users.firstName), asc(users.lastName), asc(users.id)),
        this.listStudioOptions("input_mode"),
        this.listStudioOptions("direction"),
        this.listStudioOptions("frequency"),
      ]);
    const option = (row: { slug: string; name: string }) => ({
      slug: row.slug,
      name: row.name,
    });
    return {
      actorId: actorId.toString(),
      departments: departmentRows.map((row) => ({
        id: row.id.toString(),
        name: row.name,
      })),
      people: peopleRows.map((row) => ({
        id: row.id.toString(),
        firstName: row.firstName ?? "",
        lastName: row.lastName ?? "",
        mobile: row.mobile,
        departmentId: row.departmentId?.toString() ?? null,
      })),
      inputModes: inputModes.map(option),
      directions: directions
        .filter(
          (row) =>
            row.slug === "higher" ||
            row.slug === "lower" ||
            row.slug === "range",
        )
        .map(option),
      frequencies: frequencies.map(option),
    };
  }

  async createDefinition(input: {
    actorId: bigint;
    departmentId: bigint;
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
    frequency?: string;
    inputMode?: string;
    weight?: number;
    active?: boolean;
  }) {
    if (!(await this.authorization.hasPermission(input.actorId, "kpi.manage")))
      throw new ForbiddenException("KPI management permission is required.");
    const name = input.name.trim();
    if (!name) throw new BadRequestException("KPI name is required.");
    const globalScope = await this.authorization.hasPermission(
      input.actorId,
      "access-all-departments",
    );
    if (
      !(await this.authorization.canAccessDepartment(
        input.actorId,
        input.departmentId,
        globalScope,
      ))
    )
      throw new ForbiddenException("Department access denied.");
    const [department] = await this.db
      .select({ id: departments.id })
      .from(departments)
      .where(eq(departments.id, input.departmentId))
      .limit(1);
    if (!department)
      throw new BadRequestException("The selected department does not exist.");
    if (
      !Number.isFinite(input.targetValue) ||
      input.targetValue <= 0 ||
      (input.weight !== undefined && (input.weight <= 0 || input.weight > 10))
    )
      throw new BadRequestException("Invalid KPI target or weight.");
    const { warning, critical } = KpiManagementService.thresholds(
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
    const unit = (input.unit ?? "").trim().slice(0, 80) || "عدد";
    return this.db.transaction(async (tx) => {
      const ownerId = input.ownerUserId ?? input.actorId;
      const reporterId = input.reporterUserId ?? input.actorId;
      for (const userId of new Set([ownerId, reporterId])) {
        const [person] = await tx
          .select({
            departmentId: users.departmentId,
            approvedAt: users.approvedAt,
          })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);
        if (
          !person?.approvedAt ||
          (!globalScope && person.departmentId !== input.departmentId)
        )
          throw new BadRequestException(
            "KPI owner and reporter must be approved members of the selected department.",
          );
      }
      let code = KpiManagementService.normalizeCode(input.code ?? "");
      if (
        !KpiManagementService.validCode(code) ||
        (
          await tx
            .select({ id: kpiManagementKpis.id })
            .from(kpiManagementKpis)
            .where(eq(kpiManagementKpis.code, code))
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
              .where(eq(kpiManagementKpis.code, code))
              .limit(1)
          ).length
        );
      }
      const inputFields = [
        { key: "actual", label: "مقدار واقعی", type: "number", required: true },
        { key: "note", label: "توضیحات", type: "text", required: false },
      ] as JsonValue;
      const [kpi] = await tx
        .insert(kpiManagementKpis)
        .values({
          departmentId: input.departmentId,
          code,
          name: name.slice(0, 200),
          description: input.description ?? "",
          category: input.category ?? "عملکرد",
          unit,
          direction: input.direction,
          targetValue: String(input.targetValue),
          warningValue: String(warning),
          criticalValue: String(critical),
          ownerUserId: ownerId,
          reporterUserId: reporterId,
          frequency,
          inputMode,
          inputFields,
          weight: String(input.weight ?? 1),
          active: input.active ?? true,
        })
        .returning();
      await tx
        .insert(auditLogs)
        .values({
          userId: input.actorId,
          actorName: "System",
          action: "kpi.created",
          subjectType: "KpiDefinition",
          subjectId: kpi.id,
          description: `شاخص «${kpi.name}» ایجاد شد.`,
          context: { code },
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
      frequency?: string;
      weight?: number;
      active?: boolean;
    },
  ) {
    if (!(await this.authorization.hasPermission(actorId, "kpi.manage")))
      throw new ForbiddenException("KPI management permission is required.");
    const globalScope = await this.authorization.hasPermission(
      actorId,
      "access-all-departments",
    );
    return this.db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(kpiManagementKpis)
        .where(eq(kpiManagementKpis.id, kpiId))
        .for("update")
        .limit(1);
      if (!current) throw new NotFoundException("KPI not found.");
      if (
        !(await this.authorization.canAccessDepartment(
          actorId,
          current.departmentId,
          globalScope,
        ))
      )
        throw new ForbiddenException("Department access denied.");
      const code = KpiManagementService.normalizeCode(input.code);
      if (!KpiManagementService.validCode(code))
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
      const { warning, critical } = KpiManagementService.thresholds(
        input.direction,
        input.targetValue,
        input.warningValue,
        input.criticalValue,
      );
      const ownerId = input.ownerUserId ?? current.ownerUserId;
      if (ownerId !== null) {
        const [owner] = await tx
          .select({
            departmentId: users.departmentId,
            approvedAt: users.approvedAt,
          })
          .from(users)
          .where(eq(users.id, ownerId))
          .limit(1);
        if (
          !owner?.approvedAt ||
          (!globalScope && owner.departmentId !== current.departmentId)
        )
          throw new BadRequestException(
            "KPI owner must be an approved member of the selected department.",
          );
      }
      const [updated] = await tx
        .update(kpiManagementKpis)
        .set({
          code,
          name: input.name.slice(0, 200),
          description: input.description ?? current.description,
          category: input.category ?? current.category,
          unit: input.unit ?? current.unit,
          direction: input.direction,
          targetValue: String(input.targetValue),
          warningValue: String(warning),
          criticalValue: String(critical),
          ownerUserId: ownerId,
          frequency: input.frequency ?? current.frequency,
          weight: String(input.weight ?? current.weight),
          active: input.active ?? current.active,
          updatedAt: new Date(),
        })
        .where(eq(kpiManagementKpis.id, kpiId))
        .returning();
      await tx
        .insert(auditLogs)
        .values({
          userId: actorId,
          actorName: "System",
          action: "kpi.updated",
          subjectType: "KpiDefinition",
          subjectId: kpiId,
          description: `شاخص «${updated.name}» ویرایش شد.`,
          context: { code },
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
    const globalScope = await this.authorization.hasPermission(
      userId,
      "access-all-departments",
    );
    const period = currentJalaliPeriod();
    const visible = await this.db
      .select({
        id: kpiManagementKpis.id,
        name: kpiManagementKpis.name,
        departmentId: kpiManagementKpis.departmentId,
        ownerUserId: kpiManagementKpis.ownerUserId,
      })
      .from(kpiManagementKpis)
      .where(
        and(
          eq(kpiManagementKpis.active, true),
          globalScope
            ? undefined
            : viewer.departmentId === null
              ? sql`false`
              : eq(kpiManagementKpis.departmentId, viewer.departmentId),
        ),
      )
      .orderBy(asc(kpiManagementKpis.name));
    const ids = visible.map(({ id }) => id);
    const values = ids.length
      ? await this.db
          .select()
          .from(kpiManagementValues)
          .where(inArray(kpiManagementValues.kpiId, ids))
          .orderBy(
            desc(kpiManagementValues.createdAt),
            desc(kpiManagementValues.id),
          )
      : [];
    const latest = new Map<bigint, (typeof values)[number]>();
    const submittedIds = new Set<bigint>();
    for (const value of values) {
      if (value.period === period) submittedIds.add(value.kpiId);
      if (!latest.has(value.kpiId)) latest.set(value.kpiId, value);
    }
    const counts = { green: 0, yellow: 0, red: 0, unknown: 0 };
    for (const kpi of visible) {
      const health = latest.get(kpi.id)?.status ?? "unknown";
      counts[health in counts ? (health as keyof typeof counts) : "unknown"]++;
    }
    const total = visible.length;
    const submitted = submittedIds.size;
    const attentionItems = visible
      .flatMap((kpi) => {
        const status = latest.get(kpi.id)?.status ?? "unknown";
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
      .map(({ id, name }) => ({ id, name, period }));
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
    actualValue: number | null;
    status?: CheckinStatus;
    note?: string;
    description?: string;
    blockers?: string;
    dataJson?: Record<string, unknown>;
  }) {
    const period = normalizeJalaliPeriod(input.period);
    if (!period)
      throw new BadRequestException("Invalid Jalali reporting period.");
    const globalScope = await this.authorization.hasPermission(
      input.userId,
      "access-all-departments",
    );
    return this.db.transaction(async (tx) => {
      const [kpi] = await tx
        .select()
        .from(kpiManagementKpis)
        .where(
          and(
            eq(kpiManagementKpis.id, input.kpiId),
            eq(kpiManagementKpis.active, true),
          ),
        )
        .for("update")
        .limit(1);
      if (!kpi) throw new NotFoundException("Active KPI not found.");
      if (
        !(await this.authorization.canAccessDepartment(
          input.userId,
          kpi.departmentId,
          globalScope,
        ))
      )
        throw new NotFoundException("Active KPI not found.");
      const now = new Date();
      const status = input.status ?? "submitted";
      const writesValue = status === "submitted" || status === "revised";
      if (writesValue && input.actualValue === null)
        throw new Error("A value is required for a submitted check-in.");
      const actual =
        input.actualValue === null ? null : String(input.actualValue);
      const target = Number(kpi.targetValue);
      const health = KpiManagementService.health(
        input.actualValue,
        target,
        kpi.direction,
        kpi.warningValue === null ? null : Number(kpi.warningValue),
        kpi.criticalValue === null ? null : Number(kpi.criticalValue),
      );
      const note = (input.note ?? "").trim().slice(0, 500);
      const description = (input.description ?? "").trim().slice(0, 500);
      const blockers = (input.blockers ?? "").trim().slice(0, 500);
      const dataJson = (input.dataJson ?? {
        actual: input.actualValue,
        note,
        description,
        blockers,
      }) as JsonValue;
      const [checkin] = await tx
        .insert(kpiManagementCheckins)
        .values({
          kpiId: kpi.id,
          userId: input.userId,
          period,
          status,
          dataJson,
          actualValue: actual,
          note,
          blockers,
          submittedAt: writesValue ? now : null,
          revisedAt: status === "revised" ? now : null,
        })
        .returning();
      if (!writesValue || actual === null)
        return { checkin, health: "unknown" as const };
      await tx
        .insert(auditLogs)
        .values({
          userId: input.userId,
          actorName: "System",
          action: `kpi.checkin.${status}`,
          subjectType: "KpiDefinition",
          subjectId: kpi.id,
          description: `ثبت مقدار شاخص «${kpi.name}» برای دوره ${period}`,
          context: { period, health },
          ipAddress: null,
          userAgent: null,
        });
      await tx
        .insert(kpiManagementValues)
        .values({
          kpiId: kpi.id,
          period,
          actualValue: actual,
          targetValue: kpi.targetValue,
          status: health,
          source: "checkin",
          submittedBy: input.userId,
          note,
        })
        .onConflictDoUpdate({
          target: [kpiManagementValues.kpiId, kpiManagementValues.period],
          set: {
            actualValue: actual,
            targetValue: kpi.targetValue,
            status: health,
            source: "checkin",
            submittedBy: input.userId,
            note,
            updatedAt: now,
          },
        });
      if (health === "red" || health === "yellow") {
        const severe = health === "red";
        const [openAlert] = await tx
          .select({ id: correctiveAlerts.id })
          .from(correctiveAlerts)
          .where(
            and(
              eq(correctiveAlerts.kpiId, kpi.id),
              eq(correctiveAlerts.period, period),
              sql`${correctiveAlerts.status} <> 'resolved'`,
            ),
          )
          .limit(1);
        if (!openAlert) {
          const [owner] =
            kpi.ownerUserId === null
              ? [null]
              : await tx
                  .select({ id: users.id, approvedAt: users.approvedAt })
                  .from(users)
                  .where(eq(users.id, kpi.ownerUserId))
                  .limit(1);
          const assignedTo = owner?.approvedAt ? owner.id : null;
          const [alert] = await tx
            .insert(correctiveAlerts)
            .values({
              departmentId: kpi.departmentId,
              kpiId: kpi.id,
              period,
              title: severe
                ? `شاخص بحرانی: ${kpi.name.slice(0, 200)}`
                : `شاخص زرد: ${kpi.name.slice(0, 200)}`,
              description: severe
                ? `مقدار دوره ${period} از آستانه بحرانی عبور کرد.`
                : `مقدار دوره ${period} در محدوده هشدار زرد است.`,
              severity: severe ? "urgent" : "medium",
              status: "open",
              assignedTo,
            })
            .returning();
          if (assignedTo !== null)
            await tx
              .insert(inboxNotifications)
              .values({
                userId: assignedTo,
                type: "alert",
                title: alert.title,
                body: alert.description.slice(0, 500),
                href: "/alerts",
              });
        }
      }
      if (
        health === "red" &&
        kpi.ownerUserId !== null &&
        kpi.ownerUserId !== input.userId
      ) {
        const [owner] = await tx
          .select({ approvedAt: users.approvedAt })
          .from(users)
          .where(eq(users.id, kpi.ownerUserId))
          .limit(1);
        if (owner?.approvedAt)
          await tx
            .insert(inboxNotifications)
            .values({
              userId: kpi.ownerUserId,
              type: "alert",
              title: `نیاز به بررسی: ${kpi.name.slice(0, 140)}`,
              body: "مقدار گزارش‌شده زیر آستانه شاخص قرار گرفته است.",
              href: `/kpis/${kpi.id}`,
            });
      }
      return { checkin, health };
    });
  }

  async checkinBoard(userId: bigint) {
    const canView = await this.authorization.hasPermission(userId, "kpi.view");
    const canSubmit = await this.authorization.hasPermission(
      userId,
      "kpi.submit",
    );
    if (!canView && !canSubmit)
      throw new ForbiddenException("Permission denied.");
    const period = currentJalaliPeriod();
    const window = jalaliPeriodSeries(period, 5);
    const past = window.slice(0, -1);
    const assigned = await this.db
      .select({ kpi: kpiManagementKpis, departmentName: departments.name })
      .from(kpiManagementKpis)
      .leftJoin(departments, eq(kpiManagementKpis.departmentId, departments.id))
      .where(
        and(
          eq(kpiManagementKpis.active, true),
          or(
            eq(kpiManagementKpis.reporterUserId, userId),
            eq(kpiManagementKpis.ownerUserId, userId),
          ),
        ),
      )
      .orderBy(asc(kpiManagementKpis.name));
    const ids = assigned.map(({ kpi }) => kpi.id);
    const values = ids.length
      ? await this.db
          .select()
          .from(kpiManagementValues)
          .where(inArray(kpiManagementValues.kpiId, ids))
          .orderBy(
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
    const open: ReturnType<KpiManagementService["checkinCard"]>[] = [];
    const late: ReturnType<KpiManagementService["checkinCard"]>[] = [];
    for (const { kpi, departmentName } of assigned) {
      const started = kpi.createdAt
        ? currentJalaliPeriod(kpi.createdAt)
        : period;
      const last = latest.get(kpi.id);
      if (!covered.has(`${kpi.id}:${period}`))
        open.push(
          this.checkinCard(
            kpi,
            departmentName,
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
            departmentName,
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
      })
      .from(kpiManagementCheckins)
      .innerJoin(
        kpiManagementKpis,
        eq(kpiManagementCheckins.kpiId, kpiManagementKpis.id),
      )
      .leftJoin(departments, eq(kpiManagementKpis.departmentId, departments.id))
      .where(
        and(
          eq(kpiManagementCheckins.userId, userId),
          inArray(kpiManagementCheckins.status, ["submitted", "revised"]),
        ),
      )
      .orderBy(desc(kpiManagementCheckins.id))
      .limit(40);
    const history = historyRows.map(({ checkin, kpi, departmentName }) =>
      this.checkinCard(
        kpi,
        departmentName,
        checkin.period,
        checkin.status === "revised" ? "revised" : "submitted",
        checkin.actualValue,
        KpiManagementService.health(
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

  async studioBoard(userId: bigint) {
    if (!(await this.authorization.hasPermission(userId, "kpi.view")))
      throw new ForbiddenException("Permission denied.");
    const [viewer] = await this.db
      .select({ departmentId: users.departmentId })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const globalScope = await this.authorization.hasPermission(
      userId,
      "access-all-departments",
    );
    const visible = await this.db
      .select()
      .from(kpiManagementKpis)
      .where(
        globalScope
          ? undefined
          : eq(kpiManagementKpis.departmentId, viewer?.departmentId ?? -1n),
      )
      .orderBy(asc(kpiManagementKpis.name))
      .limit(500);
    const ids = visible.map(({ id }) => id);
    const ownerIds = [
      ...new Set(
        visible.flatMap((kpi) =>
          kpi.ownerUserId === null ? [] : [kpi.ownerUserId],
        ),
      ),
    ];
    const departmentIds = [...new Set(visible.map((kpi) => kpi.departmentId))];
    const [values, owners, units] = await Promise.all([
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
    const rows = visible.map((kpi) => ({
      id: kpi.id.toString(),
      name: kpi.name,
      code: kpi.code,
      department: departmentName.get(kpi.departmentId) ?? "—",
      unit: kpi.unit,
      target: kpi.targetValue,
      health: latest.get(kpi.id)?.status ?? "unknown",
      owner:
        kpi.ownerUserId === null
          ? "تعیین نشده"
          : (ownerName.get(kpi.ownerUserId) ?? "تعیین نشده"),
      version: 1,
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
