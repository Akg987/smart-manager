import { Inject, Injectable } from "@nestjs/common";
import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import {
  auditLogs,
  businessUnits,
  dashboardVersions,
  dashboardWidgets,
  dashboards,
  roles,
  type JsonValue,
} from "../../../../../src/db/schema.js";
import { BaseRepository } from "../../common/repository/base.repository.js";
import {
  DRIZZLE_DB,
  type DrizzleDatabase,
} from "../../database/database.token.js";
import type { DashboardWidgetDto } from "./dashboard-platform.dto.js";

const toJson = (value: unknown) =>
  JSON.parse(
    JSON.stringify(value, (_key, item) =>
      typeof item === "bigint" ? item.toString() : item,
    ),
  ) as JsonValue;

@Injectable()
export class DashboardPlatformRepository extends BaseRepository {
  constructor(@Inject(DRIZZLE_DB) db: DrizzleDatabase) {
    super(db);
  }

  async findViewerRoleKeys(roleIds: string[]) {
    if (!roleIds.length) return [];
    const rows = await this.db
      .select({ key: roles.key })
      .from(roles)
      .where(inArray(roles.id, roleIds.map(BigInt)));
    return rows.map((row) => row.key);
  }

  async availableRoleKeys(holdingId: bigint) {
    const rows = await this.db
      .select({ key: roles.key })
      .from(roles)
      .where(or(eq(roles.holdingId, holdingId), isNull(roles.holdingId)));
    return rows.map((row) => row.key);
  }

  async activeBusinessUnit(id: bigint, companyId: bigint) {
    const [unit] = await this.db
      .select({ id: businessUnits.id })
      .from(businessUnits)
      .where(
        and(
          eq(businessUnits.id, id),
          eq(businessUnits.companyId, companyId),
          eq(businessUnits.status, "active"),
        ),
      )
      .limit(1);
    return !!unit;
  }

  async list(holdingId: bigint, companyId: bigint | null) {
    return this.db
      .select()
      .from(dashboards)
      .where(
        and(
          eq(dashboards.holdingId, holdingId),
          companyId
            ? or(
                eq(dashboards.companyId, companyId),
                isNull(dashboards.companyId),
              )
            : isNull(dashboards.companyId),
        ),
      )
      .orderBy(desc(dashboards.updatedAt))
      .limit(200);
  }

  async get(id: bigint) {
    const [dashboard] = await this.db
      .select()
      .from(dashboards)
      .where(eq(dashboards.id, id))
      .limit(1);
    if (!dashboard) return null;
    const widgets = await this.db
      .select()
      .from(dashboardWidgets)
      .where(eq(dashboardWidgets.dashboardId, id))
      .orderBy(
        asc(dashboardWidgets.positionY),
        asc(dashboardWidgets.positionX),
      );
    return { ...dashboard, widgets };
  }

  async create(input: {
    holdingId: bigint;
    companyId: bigint | null;
    businessUnitId: bigint | null;
    ownerUserId: bigint;
    name: string;
    type: "holding" | "company" | "business_unit" | "role" | "personal";
    visibility: "private" | "role" | "company" | "holding";
    roleKey: string | null;
    filters: Record<string, unknown>;
    widgets: DashboardWidgetDto[];
  }) {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(dashboards)
        .values({
          holdingId: input.holdingId,
          companyId: input.companyId,
          businessUnitId: input.businessUnitId,
          ownerUserId: input.ownerUserId,
          name: input.name,
          type: input.type,
          visibility: input.visibility,
          roleKey: input.roleKey,
          filters: input.filters as JsonValue,
          layout: input.widgets as unknown as JsonValue,
          status: "draft",
          version: 1,
        })
        .returning();
      if (input.widgets.length)
        await tx
          .insert(dashboardWidgets)
          .values(
            input.widgets.map((widget) => this.widgetValues(row.id, widget)),
          );
      await tx
        .insert(dashboardVersions)
        .values({
          dashboardId: row.id,
          version: 1,
          definition: toJson({ ...row, widgets: input.widgets }),
          createdBy: input.ownerUserId,
        });
      await this.audit(
        tx,
        input.ownerUserId,
        row.id,
        input.holdingId,
        input.companyId,
        "dashboard.created",
        { type: row.type, version: 1 },
      );
      return { ...row, widgets: input.widgets };
    });
  }

  async update(
    id: bigint,
    actorId: bigint,
    input: {
      name: string;
      visibility: "private" | "role" | "company" | "holding";
      roleKey: string | null;
      filters: Record<string, unknown>;
      widgets: DashboardWidgetDto[];
    },
  ) {
    return this.db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(dashboards)
        .where(eq(dashboards.id, id))
        .for("update")
        .limit(1);
      if (!current) return null;
      const nextVersion = current.version + 1;
      await tx
        .delete(dashboardWidgets)
        .where(eq(dashboardWidgets.dashboardId, id));
      if (input.widgets.length)
        await tx
          .insert(dashboardWidgets)
          .values(input.widgets.map((widget) => this.widgetValues(id, widget)));
      const [updated] = await tx
        .update(dashboards)
        .set({
          name: input.name,
          visibility: input.visibility,
          roleKey: input.roleKey,
          filters: input.filters as JsonValue,
          layout: input.widgets as unknown as JsonValue,
          version: nextVersion,
          updatedAt: new Date(),
        })
        .where(eq(dashboards.id, id))
        .returning();
      await tx
        .insert(dashboardVersions)
        .values({
          dashboardId: id,
          version: nextVersion,
          definition: toJson({ ...updated, widgets: input.widgets }),
          createdBy: actorId,
        });
      await this.audit(
        tx,
        actorId,
        id,
        current.holdingId,
        current.companyId,
        "dashboard.updated",
        { version: nextVersion },
      );
      return { ...updated, widgets: input.widgets };
    });
  }

  async publish(id: bigint, actorId: bigint) {
    return this.db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(dashboards)
        .where(eq(dashboards.id, id))
        .for("update")
        .limit(1);
      if (!current) return null;
      const widgets = await tx
        .select()
        .from(dashboardWidgets)
        .where(eq(dashboardWidgets.dashboardId, id))
        .orderBy(
          asc(dashboardWidgets.positionY),
          asc(dashboardWidgets.positionX),
        );
      const version = current.version + 1;
      const [updated] = await tx
        .update(dashboards)
        .set({
          status: "published",
          version,
          publishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(dashboards.id, id))
        .returning();
      await tx
        .insert(dashboardVersions)
        .values({
          dashboardId: id,
          version,
          definition: toJson({ ...updated, widgets }),
          createdBy: actorId,
        });
      await this.audit(
        tx,
        actorId,
        id,
        current.holdingId,
        current.companyId,
        "dashboard.published",
        { version },
      );
      return { ...updated, widgets };
    });
  }

  async archive(id: bigint, actorId: bigint) {
    const [row] = await this.db
      .update(dashboards)
      .set({
        status: "archived",
        updatedAt: new Date(),
        version: sql`${dashboards.version} + 1`,
      })
      .where(eq(dashboards.id, id))
      .returning();
    if (row)
      await this.audit(
        this.db,
        actorId,
        row.id,
        row.holdingId,
        row.companyId,
        "dashboard.archived",
        { version: row.version },
      );
    return row ?? null;
  }

  async versions(id: bigint) {
    return this.db
      .select()
      .from(dashboardVersions)
      .where(eq(dashboardVersions.dashboardId, id))
      .orderBy(desc(dashboardVersions.version))
      .limit(100);
  }

  private widgetValues(dashboardId: bigint, widget: DashboardWidgetDto) {
    return {
      dashboardId,
      type: widget.type,
      title: widget.title?.trim().slice(0, 160) ?? "",
      config: widget.config as JsonValue,
      positionX: widget.positionX,
      positionY: widget.positionY,
      width: widget.width,
      height: widget.height,
    };
  }

  private audit(
    tx: Pick<DrizzleDatabase, "insert">,
    actorId: bigint,
    dashboardId: bigint,
    holdingId: bigint,
    companyId: bigint | null,
    action: string,
    details: Record<string, unknown>,
  ) {
    return tx.insert(auditLogs).values({
      userId: actorId,
      holdingId,
      companyId,
      actorName: "System",
      action,
      subjectType: "Dashboard",
      subjectId: dashboardId,
      description: action.replaceAll(".", " "),
      context: { dashboardId: dashboardId.toString(), ...details },
      ipAddress: null,
      userAgent: null,
    });
  }
}
