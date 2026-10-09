import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AuthorizationService } from "../authorization/authorization.service.js";
import { CorrectiveActionsService } from "../corrective-actions/corrective-actions.service.js";
import { DecisionsService } from "../decisions/decisions.service.js";
import { KpiManagementService } from "../kpi-management/kpi-management.service.js";
import { DashboardPlatformRepository } from "./dashboard-platform.repository.js";
import type {
  CreateDashboardDto,
  DashboardWidgetDto,
  UpdateDashboardDto,
} from "./dashboard-platform.dto.js";

type Scope = {
  holdingId: string;
  companyId: string | null;
  branchId: string | null;
  businessUnitId: string | null;
};
type Board = NonNullable<
  Awaited<ReturnType<DashboardPlatformRepository["get"]>>
>;
type DashboardRow = Omit<Board, "widgets">;
const kpiWidgets = new Set([
  "kpi_card",
  "trend_chart",
  "line_chart",
  "bar_chart",
  "comparison",
  "progress",
  "table",
]);
const jsonSafe = <T>(value: T): T =>
  JSON.parse(
    JSON.stringify(value, (_key, item) =>
      typeof item === "bigint" ? item.toString() : item,
    ),
  ) as T;

@Injectable()
export class DashboardPlatformService {
  constructor(
    private readonly repository: DashboardPlatformRepository,
    private readonly authorization: AuthorizationService,
    private readonly kpis: KpiManagementService,
    private readonly actions: CorrectiveActionsService,
    private readonly decisions: DecisionsService,
  ) {}

  async list(actorId: bigint) {
    const context = this.context(actorId);
    const rows = await this.repository.list(
      BigInt(context.holdingId),
      context.companyId ? BigInt(context.companyId) : null,
    );
    const roleKeys = await this.repository.findViewerRoleKeys(context.roleIds);
    const allowed = [];
    for (const row of rows)
      if (await this.canView(actorId, row, roleKeys))
        allowed.push(jsonSafe(row));
    return allowed;
  }

  async create(actorId: bigint, input: CreateDashboardDto) {
    const context = this.context(actorId);
    let companyId = context.companyId ? BigInt(context.companyId) : null;
    let businessUnitId = input.businessUnitId
      ? BigInt(input.businessUnitId)
      : context.businessUnitId
        ? BigInt(context.businessUnitId)
        : null;
    if (input.type === "holding") {
      if (context.scopeType !== "holding")
        throw new ForbiddenException(
          "Holding dashboards require holding scope.",
        );
      companyId = null;
      businessUnitId = null;
    } else if (!companyId)
      throw new BadRequestException(
        "Select an active company before creating this dashboard.",
      );
    if (input.type === "company" || input.type === "personal")
      businessUnitId = null;
    if (input.type === "business_unit" && !businessUnitId)
      throw new BadRequestException(
        "A Business Unit dashboard requires an active Business Unit.",
      );
    if (
      businessUnitId &&
      companyId &&
      !(await this.repository.activeBusinessUnit(businessUnitId, companyId))
    )
      throw new BadRequestException(
        "Business Unit is not active in the selected company.",
      );
    if (
      context.scopeType === "businessUnit" &&
      context.businessUnitId !== businessUnitId?.toString()
    )
      throw new ForbiddenException(
        "The requested Business Unit is outside your scope.",
      );
    const scope = {
      holdingId: context.holdingId,
      companyId: companyId?.toString() ?? null,
      branchId: context.branchId,
      businessUnitId: businessUnitId?.toString() ?? null,
    };
    if (!(await this.authorization.can(context, "dashboard.create", scope)))
      throw new ForbiddenException(
        "Dashboard creation permission is required for this scope.",
      );
    const visibility =
      input.visibility ?? (input.type === "holding" ? "holding" : "private");
    if (visibility === "holding" && input.type !== "holding")
      throw new BadRequestException(
        "Only holding dashboards can be shared at holding level.",
      );
    const roleKey = input.roleKey?.trim() || null;
    await this.validateSharing(context, visibility, roleKey, companyId);
    const widgets = input.widgets ?? [];
    await this.validateWidgets(actorId, widgets, scope);
    return this.repository.create({
      holdingId: BigInt(context.holdingId),
      companyId,
      businessUnitId,
      ownerUserId: actorId,
      name: input.name.trim(),
      type: input.type,
      visibility,
      roleKey,
      filters: this.scopedFilters(input.filters ?? {}, context),
      widgets,
    });
  }

  async update(actorId: bigint, id: bigint, input: UpdateDashboardDto) {
    const current = await this.authorized(actorId, id, "dashboard.update");
    if (current.status === "archived")
      throw new BadRequestException("Archived dashboards cannot be edited.");
    const visibility = input.visibility ?? current.visibility;
    if (visibility === "holding" && current.type !== "holding")
      throw new BadRequestException(
        "Only holding dashboards can be shared at holding level.",
      );
    const roleKey =
      input.roleKey === undefined
        ? current.roleKey
        : input.roleKey.trim() || null;
    await this.validateSharing(
      this.context(actorId),
      visibility,
      roleKey,
      current.companyId,
    );
    const widgets =
      input.widgets ??
      current.widgets.map((widget) => ({
        id: Number(widget.id),
        type: widget.type,
        title: widget.title,
        config: widget.config as Record<string, unknown>,
        positionX: widget.positionX,
        positionY: widget.positionY,
        width: widget.width,
        height: widget.height,
      }));
    const scope = this.boardScope(current);
    await this.validateWidgets(actorId, widgets, scope);
    const row = await this.repository.update(id, actorId, {
      name: input.name?.trim() || current.name,
      visibility,
      roleKey,
      filters: this.scopedFilters(
        input.filters ?? (current.filters as Record<string, unknown>),
        this.context(actorId),
      ),
      widgets,
    });
    if (!row) throw new NotFoundException("Dashboard not found.");
    return jsonSafe(row);
  }

  async duplicate(actorId: bigint, id: bigint, name: string) {
    const current = await this.authorized(actorId, id, "dashboard.view");
    const scope = this.boardScope(current);
    if (
      !(await this.authorization.can(
        this.context(actorId),
        "dashboard.create",
        scope,
      ))
    )
      throw new ForbiddenException(
        "Dashboard creation permission is required for duplication.",
      );
    const widgets = current.widgets.map((widget) => ({
      type: widget.type,
      title: widget.title,
      config: widget.config as Record<string, unknown>,
      positionX: widget.positionX,
      positionY: widget.positionY,
      width: widget.width,
      height: widget.height,
    })) as DashboardWidgetDto[];
    await this.validateWidgets(actorId, widgets, scope);
    return jsonSafe(
      await this.repository.create({
        holdingId: current.holdingId,
        companyId: current.companyId,
        businessUnitId: current.businessUnitId,
        ownerUserId: actorId,
        name: name.trim(),
        type: current.type,
        visibility: "private",
        roleKey: null,
        filters: current.filters as Record<string, unknown>,
        widgets,
      }),
    );
  }

  async publish(actorId: bigint, id: bigint) {
    const current = await this.authorized(actorId, id, "dashboard.update");
    await this.validateSharing(
      this.context(actorId),
      current.visibility,
      current.roleKey,
      current.companyId,
    );
    await this.validateWidgets(
      actorId,
      current.widgets as unknown as DashboardWidgetDto[],
      this.boardScope(current),
    );
    const row = await this.repository.publish(id, actorId);
    if (!row) throw new NotFoundException("Dashboard not found.");
    return jsonSafe(row);
  }

  async archive(actorId: bigint, id: bigint) {
    await this.authorized(actorId, id, "dashboard.delete");
    const row = await this.repository.archive(id, actorId);
    if (!row) throw new NotFoundException("Dashboard not found.");
    return jsonSafe(row);
  }

  async view(
    actorId: bigint,
    id: bigint,
    mode: "view" | "edit" | "preview" = "view",
  ) {
    const board = await this.authorized(
      actorId,
      id,
      mode === "edit" ? "dashboard.update" : "dashboard.view",
    );
    if (mode === "edit" && board.status !== "draft")
      throw new BadRequestException(
        "Only draft dashboards can be opened in edit mode.",
      );
    const widgets = await Promise.all(
      board.widgets.map(async (widget) => ({
        ...jsonSafe(widget),
        data: await this.renderWidget(
          actorId,
          widget.type,
          widget.config as Record<string, unknown>,
          this.boardScope(board),
        ),
      })),
    );
    return { ...jsonSafe(board), mode, widgets };
  }

  async history(actorId: bigint, id: bigint) {
    await this.authorized(actorId, id, "dashboard.view");
    return jsonSafe(await this.repository.versions(id));
  }

  async templates(actorId: bigint) {
    const context = this.context(actorId);
    const roles = await this.repository.findViewerRoleKeys(context.roleIds);
    const candidate = roles.some((role) =>
      ["COMPANY_CEO", "GROUP_CEO", "GROUP_COO"].includes(role),
    )
      ? [
          "kpi_card",
          "red_flag_list",
          "action_list",
          "decision_list",
          "company_scorecard",
          "data_quality",
        ]
      : roles.includes("SALES_MANAGER")
        ? ["kpi_card", "trend_chart", "comparison", "progress", "table"]
        : roles.includes("FINANCE_MANAGER")
          ? ["kpi_card", "trend_chart", "comparison", "data_quality"]
          : [
              "kpi_card",
              "trend_chart",
              "red_flag_list",
              "action_list",
              "decision_list",
            ];
    const allowed = [];
    for (const widget of candidate)
      if (
        await this.widgetPermission(actorId, widget, {
          holdingId: context.holdingId,
          companyId: context.companyId,
          branchId: context.branchId,
          businessUnitId: context.businessUnitId,
        })
      )
        allowed.push(widget);
    return {
      roleKeys: roles,
      widgets: allowed,
      canCreate: await this.authorization.can(context, "dashboard.create", {
        holdingId: context.holdingId,
        companyId: context.companyId,
        branchId: context.branchId,
        businessUnitId: context.businessUnitId,
      }),
    };
  }

  private async renderWidget(
    actorId: bigint,
    type: string,
    config: Record<string, unknown>,
    scope: Scope,
  ) {
    if (!(await this.widgetPermission(actorId, type, scope)))
      return { restricted: true };
    if (kpiWidgets.has(type)) {
      const ids = [
        config.kpiId,
        ...(Array.isArray(config.kpiIds) ? config.kpiIds : []),
      ].filter(
        (value): value is string | number =>
          typeof value === "string" || typeof value === "number",
      );
      if (ids.length)
        return Promise.all(
          ids.map((id) =>
            this.kpis.kpiData(
              BigInt(id),
              actorId,
              typeof config.period === "string" ? config.period : undefined,
            ),
          ),
        );
      return this.kpis.dashboardSnapshot(actorId);
    }
    if (type === "red_flag_list") return this.kpis.redFlagBoard(actorId);
    if (type === "action_list") return this.actions.actionBoard(actorId);
    if (type === "decision_list") return this.decisions.list(actorId);
    if (type === "data_quality") return this.kpis.dashboardSnapshot(actorId);
    if (type === "company_scorecard") {
      const [allowKpi, allowRedFlags, allowActions, allowDecisions] =
        await Promise.all([
          this.widgetPermission(actorId, "kpi_card", scope),
          this.widgetPermission(actorId, "red_flag_list", scope),
          this.widgetPermission(actorId, "action_list", scope),
          this.widgetPermission(actorId, "decision_list", scope),
        ]);
      const [kpiData, redFlagData, actionData, decisionData] =
        await Promise.all([
          allowKpi
            ? this.kpis.dashboardSnapshot(actorId)
            : Promise.resolve(null),
          allowRedFlags
            ? this.kpis.redFlagBoard(actorId)
            : Promise.resolve(null),
          allowActions
            ? this.actions.actionBoard(actorId)
            : Promise.resolve(null),
          allowDecisions ? this.decisions.list(actorId) : Promise.resolve(null),
        ]);
      return {
        kpis: kpiData,
        redFlags: redFlagData,
        actions: actionData,
        decisions: decisionData,
      };
    }
    throw new BadRequestException("Unsupported dashboard widget type.");
  }

  private async validateWidgets(
    actorId: bigint,
    widgets: DashboardWidgetDto[],
    scope: Scope,
  ) {
    if (widgets.length > 24)
      throw new BadRequestException(
        "A dashboard can contain at most 24 widgets.",
      );
    for (const widget of widgets) {
      if (!(await this.widgetPermission(actorId, widget.type, scope)))
        throw new ForbiddenException(
          `Widget ${widget.type} is outside your permission scope.`,
        );
      const config = widget.config ?? {};
      const ids = [
        config.kpiId,
        ...(Array.isArray(config.kpiIds) ? config.kpiIds : []),
      ].filter(
        (value): value is string | number =>
          typeof value === "string" || typeof value === "number",
      );
      for (const id of ids)
        if (
          !(await this.authorization.canAccessKpi(
            actorId,
            BigInt(id),
            "kpi.view",
          ))
        )
          throw new ForbiddenException(
            "A dashboard widget references a KPI outside your scope.",
          );
      if (
        config.companyId !== undefined &&
        String(config.companyId) !== scope.companyId
      )
        throw new ForbiddenException(
          "Dashboard widgets cannot select another company.",
        );
    }
  }

  private async widgetPermission(actorId: bigint, type: string, scope: Scope) {
    const permission =
      kpiWidgets.has(type) || type === "data_quality"
        ? "kpi.view"
        : type === "red_flag_list"
          ? "redflag.view"
          : type === "action_list"
            ? "action.view"
            : type === "decision_list"
              ? "decision.view"
              : type === "company_scorecard"
                ? "company.view"
                : "";
    if (!permission) return false;
    return this.authorization.can(this.context(actorId), permission, scope);
  }

  private async validateSharing(
    context: ReturnType<DashboardPlatformService["context"]>,
    visibility: string,
    roleKey: string | null,
    companyId: bigint | null,
  ) {
    if (visibility === "role") {
      if (
        !roleKey ||
        !(await this.repository
          .availableRoleKeys(BigInt(context.holdingId))
          .then((keys) => keys.includes(roleKey)))
      )
        throw new BadRequestException(
          "Select a role that belongs to this holding.",
        );
    }
    if (
      visibility !== "private" &&
      !(await this.authorization.can(context, "dashboard.share", {
        holdingId: context.holdingId,
        companyId: companyId?.toString() ?? null,
      }))
    )
      throw new ForbiddenException("Dashboard sharing permission is required.");
  }

  private async authorized(
    actorId: bigint,
    id: bigint,
    permission: string,
  ): Promise<Board> {
    const board = await this.repository.get(id);
    if (
      !board ||
      !(await this.canView(
        actorId,
        board,
        await this.repository.findViewerRoleKeys(this.context(actorId).roleIds),
      ))
    )
      throw new NotFoundException("Dashboard not found.");
    const context = this.context(actorId);
    if (
      !(await this.authorization.can(
        context,
        permission,
        this.boardScope(board),
      ))
    )
      throw new ForbiddenException(
        `Permission ${permission} is required for this dashboard.`,
      );
    return board;
  }

  private async canView(
    actorId: bigint,
    board: DashboardRow,
    roleKeys: string[],
  ) {
    if (
      board.status === "archived" ||
      (board.status === "draft" && board.ownerUserId !== actorId)
    )
      return false;
    const context = this.context(actorId);
    if (board.holdingId.toString() !== context.holdingId) return false;
    if (board.visibility === "private" && board.ownerUserId !== actorId)
      return false;
    if (
      board.visibility === "role" &&
      (!board.roleKey || !roleKeys.includes(board.roleKey))
    )
      return false;
    if (board.visibility === "holding" && board.type !== "holding")
      return false;
    if (
      board.companyId &&
      context.companyId !== board.companyId.toString() &&
      context.scopeType !== "holding"
    )
      return false;
    return this.authorization.can(
      context,
      "dashboard.view",
      this.boardScope(board),
    );
  }

  private boardScope(
    board: Pick<Board, "holdingId" | "companyId" | "businessUnitId">,
  ): Scope {
    return {
      holdingId: board.holdingId.toString(),
      companyId: board.companyId?.toString() ?? null,
      branchId: null,
      businessUnitId: board.businessUnitId?.toString() ?? null,
    };
  }

  private scopedFilters(
    filters: Record<string, unknown>,
    context: ReturnType<DashboardPlatformService["context"]>,
  ) {
    if (
      filters.companyId !== undefined &&
      String(filters.companyId) !== context.companyId
    )
      throw new ForbiddenException(
        "Dashboard filters cannot select another company.",
      );
    return { ...filters, companyId: context.companyId };
  }

  private context(actorId: bigint) {
    const context = this.authorization.currentContext(actorId);
    if (!context)
      throw new ForbiddenException("An active tenant membership is required.");
    return context;
  }
}
