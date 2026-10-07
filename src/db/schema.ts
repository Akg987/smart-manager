import {
  bigint,
  bigserial,
  boolean,
  check,
  date,
  index,
  integer,
  json,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  varchar,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import {
  relations,
  sql,
  type InferInsertModel,
  type InferSelectModel,
} from "drizzle-orm";

/** Backed enums stay VARCHAR columns, as in the Laravel migrations. */
export type UserRole = "admin" | "user";
export type OtpPurpose = "password-reset" | "two-factor";
export type NotificationType = "info" | "alert" | "action" | "system";
export type CheckinStatus = "draft" | "submitted" | "revised";
export type KpiDirection = "higher" | "lower" | "range";
export type KpiHealth = "green" | "yellow" | "red" | "unknown";
export type ActionStatus = "open" | "in_progress" | "blocked" | "done";
export type AlertSeverity = "low" | "medium" | "high" | "urgent";
export type AlertStatus = "open" | "acknowledged" | "resolved";
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

const id = (name = "id") => bigserial(name, { mode: "bigint" }).primaryKey();
const createdAt = () =>
  timestamp("created_at", { withTimezone: true, mode: "date" });
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true, mode: "date" });
const foreignId = (name: string) => bigint(name, { mode: "bigint" });

export const users = pgTable(
  "users",
  {
    id: id(),
    firstName: varchar("first_name", { length: 100 }),
    lastName: varchar("last_name", { length: 100 }),
    mobile: varchar("mobile", { length: 11 }).notNull(),
    nationalCode: varchar("national_code", { length: 10 }),
    birthDate: date("birth_date", { mode: "string" }),
    address: text("address"),
    avatarPath: varchar("avatar_path", { length: 180 }),
    password: varchar("password", { length: 255 }).notNull(),
    role: varchar("role", { length: 20 })
      .$type<UserRole>()
      .notNull()
      .default("user"),
    accessLevelId: foreignId("access_level_id").references(
      (): AnyPgColumn => accessLevels.id,
      { onDelete: "set null" },
    ),
    departmentId: foreignId("department_id").references(
      (): AnyPgColumn => departments.id,
      { onDelete: "set null" },
    ),
    jobTitle: varchar("job_title", { length: 120 }),
    approvedAt: timestamp("approved_at", { withTimezone: true, mode: "date" }),
    approvedBy: foreignId("approved_by").references(
      (): AnyPgColumn => users.id,
      { onDelete: "set null" },
    ),
    rememberToken: varchar("remember_token", { length: 100 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("users_mobile_unique").on(table.mobile),
    uniqueIndex("users_national_code_unique").on(table.nationalCode),
    index("users_role_index").on(table.role),
    index("users_approved_by_foreign").on(table.approvedBy),
    index("users_department_id_foreign").on(table.departmentId),
    index("users_access_level_id_foreign").on(table.accessLevelId),
  ],
);

export const departments = pgTable(
  "departments",
  {
    id: id(),
    name: varchar("name", { length: 100 }).notNull(),
    code: varchar("code", { length: 32 }).notNull(),
    managerUserId: foreignId("manager_user_id").references(
      (): AnyPgColumn => users.id,
      { onDelete: "set null" },
    ),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("departments_code_unique").on(table.code),
    index("departments_manager_user_id_foreign").on(table.managerUserId),
  ],
);

export const accessLevels = pgTable(
  "access_levels",
  {
    id: id(),
    name: varchar("name", { length: 120 }).notNull(),
    departmentId: foreignId("department_id").references(
      (): AnyPgColumn => departments.id,
      { onDelete: "set null" },
    ),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("access_levels_name_unique").on(table.name),
    index("access_levels_department_id_index").on(table.departmentId),
  ],
);

export const accessLevelPermissions = pgTable(
  "access_level_permissions",
  {
    id: id(),
    accessLevelId: foreignId("access_level_id")
      .references((): AnyPgColumn => accessLevels.id, { onDelete: "cascade" })
      .notNull(),
    permission: varchar("permission", { length: 100 }).notNull(),
  },
  (table) => [
    uniqueIndex(
      "access_level_permissions_access_level_id_permission_unique",
    ).on(table.accessLevelId, table.permission),
    index("access_level_permissions_permission_index").on(table.permission),
  ],
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    id: id(),
    role: varchar("role", { length: 20 }).notNull(),
    permission: varchar("permission", { length: 100 }).notNull(),
  },
  (table) => [
    uniqueIndex("role_permissions_role_permission_unique").on(
      table.role,
      table.permission,
    ),
    index("role_permissions_role_index").on(table.role),
  ],
);

export const passwordResetTokens = pgTable("password_reset_tokens", {
  mobile: varchar("mobile", { length: 11 }).primaryKey(),
  token: varchar("token", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }),
});

export const sessions = pgTable(
  "sessions",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    userId: foreignId("user_id"),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    payload: text("payload").notNull(),
    lastActivity: integer("last_activity").notNull(),
  },
  (table) => [
    index("sessions_user_id_index").on(table.userId),
    index("sessions_last_activity_index").on(table.lastActivity),
  ],
);

export const cache = pgTable(
  "cache",
  {
    key: varchar("key", { length: 255 }).primaryKey(),
    value: text("value").notNull(),
    expiration: integer("expiration").notNull(),
  },
  (table) => [index("cache_expiration_index").on(table.expiration)],
);

export const cacheLocks = pgTable(
  "cache_locks",
  {
    key: varchar("key", { length: 255 }).primaryKey(),
    owner: varchar("owner", { length: 255 }).notNull(),
    expiration: integer("expiration").notNull(),
  },
  (table) => [index("cache_locks_expiration_index").on(table.expiration)],
);

export const jobs = pgTable(
  "jobs",
  {
    id: id(),
    queue: varchar("queue", { length: 255 }).notNull(),
    payload: text("payload").notNull(),
    attempts: smallint("attempts").notNull(),
    reservedAt: bigint("reserved_at", { mode: "number" }),
    availableAt: bigint("available_at", { mode: "number" }).notNull(),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
  },
  (table) => [
    index("jobs_queue_index").on(table.queue),
    check(
      "jobs_attempts_unsigned_check",
      sqlCheckUnsigned(table.attempts, 255),
    ),
    check(
      "jobs_reserved_at_unsigned_check",
      sqlCheckUnsigned(table.reservedAt, 4_294_967_295),
    ),
    check(
      "jobs_available_at_unsigned_check",
      sqlCheckUnsigned(table.availableAt, 4_294_967_295),
    ),
    check(
      "jobs_created_at_unsigned_check",
      sqlCheckUnsigned(table.createdAt, 4_294_967_295),
    ),
  ],
);

export const jobBatches = pgTable("job_batches", {
  id: varchar("id", { length: 255 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  totalJobs: integer("total_jobs").notNull(),
  pendingJobs: integer("pending_jobs").notNull(),
  failedJobs: integer("failed_jobs").notNull(),
  failedJobIds: text("failed_job_ids").notNull(),
  options: text("options"),
  cancelledAt: integer("cancelled_at"),
  createdAt: integer("created_at").notNull(),
  finishedAt: integer("finished_at"),
});

export const failedJobs = pgTable(
  "failed_jobs",
  {
    id: id(),
    uuid: varchar("uuid", { length: 255 }).notNull(),
    connection: text("connection").notNull(),
    queue: text("queue").notNull(),
    payload: text("payload").notNull(),
    exception: text("exception").notNull(),
    failedAt: timestamp("failed_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("failed_jobs_uuid_unique").on(table.uuid)],
);

export const modules = pgTable(
  "modules",
  {
    id: id(),
    slug: varchar("slug", { length: 100 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    version: varchar("version", { length: 20 }).notNull(),
    isActive: boolean("is_active").notNull().default(false),
    settings: json("settings").$type<JsonValue>(),
    activatedAt: timestamp("activated_at", {
      withTimezone: true,
      mode: "date",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("modules_slug_unique").on(table.slug),
    index("modules_is_active_index").on(table.isActive),
  ],
);

export const otpChallenges = pgTable(
  "otp_challenges",
  {
    id: id(),
    purpose: varchar("purpose", { length: 40 }).$type<OtpPurpose>().notNull(),
    identifier: varchar("identifier", { length: 64 }).notNull(),
    codeHash: varchar("code_hash", { length: 255 }).notNull(),
    attempts: smallint("attempts").notNull().default(0),
    sentAt: timestamp("sent_at", {
      withTimezone: false,
      mode: "date",
    }).notNull(),
    expiresAt: timestamp("expires_at", {
      withTimezone: false,
      mode: "date",
    }).notNull(),
  },
  (table) => [
    uniqueIndex("otp_challenges_purpose_identifier_unique").on(
      table.purpose,
      table.identifier,
    ),
    index("otp_challenges_expires_at_index").on(table.expiresAt),
    check(
      "otp_challenges_attempts_unsigned_check",
      sqlCheckUnsigned(table.attempts, 255),
    ),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    userId: foreignId("user_id").references((): AnyPgColumn => users.id, {
      onDelete: "set null",
    }),
    actorName: varchar("actor_name", { length: 150 }).notNull(),
    action: varchar("action", { length: 64 }).notNull(),
    subjectType: varchar("subject_type", { length: 191 }),
    subjectId: foreignId("subject_id"),
    description: varchar("description", { length: 500 }).notNull(),
    context: json("context").$type<JsonValue>(),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: varchar("user_agent", { length: 500 }),
    createdAt: createdAt(),
  },
  (table) => [
    index("audit_logs_user_id_index").on(table.userId),
    index("audit_logs_action_index").on(table.action),
    index("audit_logs_created_at_index").on(table.createdAt),
    index("audit_logs_subject_type_subject_id_index").on(
      table.subjectType,
      table.subjectId,
    ),
  ],
);

export const siteSettings = pgTable("site_settings", {
  id: id(),
  companyName: varchar("company_name", { length: 120 }).notNull().default(""),
  logoPath: varchar("logo_path", { length: 255 }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const inboxNotifications = pgTable(
  "inbox_notifications",
  {
    id: id(),
    userId: foreignId("user_id")
      .references((): AnyPgColumn => users.id, { onDelete: "cascade" })
      .notNull(),
    type: varchar("type", { length: 20 }).$type<NotificationType>().notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    body: varchar("body", { length: 500 }).notNull().default(""),
    href: varchar("href", { length: 255 }).notNull().default(""),
    readAt: timestamp("read_at", { withTimezone: true, mode: "date" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("inbox_notifications_user_id_read_at_index").on(
      table.userId,
      table.readAt,
    ),
    index("inbox_notifications_user_id_created_at_index").on(
      table.userId,
      table.createdAt,
    ),
  ],
);

export const kpiManagementKpis = pgTable(
  "kpi_management_kpis",
  {
    id: id(),
    departmentId: foreignId("department_id")
      .references((): AnyPgColumn => departments.id, { onDelete: "restrict" })
      .notNull(),
    code: varchar("code", { length: 64 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    description: varchar("description", { length: 3000 }).notNull().default(""),
    category: varchar("category", { length: 100 }).notNull().default("عملکرد"),
    unit: varchar("unit", { length: 80 }).notNull().default("عدد"),
    direction: varchar("direction", { length: 10 })
      .$type<KpiDirection>()
      .notNull(),
    targetValue: numeric("target_value", {
      precision: 14,
      scale: 4,
      mode: "string",
    }).notNull(),
    warningValue: numeric("warning_value", {
      precision: 14,
      scale: 4,
      mode: "string",
    }),
    criticalValue: numeric("critical_value", {
      precision: 14,
      scale: 4,
      mode: "string",
    }),
    ownerUserId: foreignId("owner_user_id").references(
      (): AnyPgColumn => users.id,
      { onDelete: "set null" },
    ),
    reporterUserId: foreignId("reporter_user_id").references(
      (): AnyPgColumn => users.id,
      { onDelete: "set null" },
    ),
    frequency: varchar("frequency", { length: 50 }).notNull().default("هفتگی"),
    inputMode: varchar("input_mode", { length: 64 })
      .notNull()
      .default("direct"),
    inputFields: json("input_fields").$type<JsonValue>().notNull(),
    active: boolean("active").notNull().default(true),
    weight: numeric("weight", { precision: 5, scale: 2, mode: "string" })
      .notNull()
      .default("1.00"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("kpi_management_kpis_code_unique").on(table.code),
    index("kpi_management_kpis_owner_user_id_foreign").on(table.ownerUserId),
    index("kpi_management_kpis_department_id_active_index").on(
      table.departmentId,
      table.active,
    ),
    index("kpi_management_kpis_reporter_user_id_foreign").on(
      table.reporterUserId,
    ),
  ],
);

export const kpiManagementValues = pgTable(
  "kpi_management_values",
  {
    id: id(),
    kpiId: foreignId("kpi_id")
      .references((): AnyPgColumn => kpiManagementKpis.id, {
        onDelete: "cascade",
      })
      .notNull(),
    period: varchar("period", { length: 10 }).notNull(),
    actualValue: numeric("actual_value", {
      precision: 14,
      scale: 4,
      mode: "string",
    }),
    targetValue: numeric("target_value", {
      precision: 14,
      scale: 4,
      mode: "string",
    }).notNull(),
    status: varchar("status", { length: 16 }).$type<KpiHealth>().notNull(),
    source: varchar("source", { length: 32 }).notNull().default("checkin"),
    submittedBy: foreignId("submitted_by").references(
      (): AnyPgColumn => users.id,
      { onDelete: "set null" },
    ),
    note: varchar("note", { length: 500 }).notNull().default(""),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("kpi_management_values_kpi_id_period_unique").on(
      table.kpiId,
      table.period,
    ),
    index("kpi_management_values_submitted_by_foreign").on(table.submittedBy),
    index("kpi_management_values_period_index").on(table.period),
  ],
);

export const kpiManagementCheckins = pgTable(
  "kpi_management_checkins",
  {
    id: id(),
    kpiId: foreignId("kpi_id")
      .references((): AnyPgColumn => kpiManagementKpis.id, {
        onDelete: "cascade",
      })
      .notNull(),
    userId: foreignId("user_id")
      .references((): AnyPgColumn => users.id, { onDelete: "cascade" })
      .notNull(),
    period: varchar("period", { length: 10 }).notNull(),
    status: varchar("status", { length: 16 }).$type<CheckinStatus>().notNull(),
    dataJson: json("data_json").$type<JsonValue>().notNull(),
    actualValue: numeric("actual_value", {
      precision: 14,
      scale: 4,
      mode: "string",
    }),
    note: varchar("note", { length: 500 }).notNull().default(""),
    blockers: varchar("blockers", { length: 500 }).notNull().default(""),
    submittedAt: timestamp("submitted_at", {
      withTimezone: true,
      mode: "date",
    }),
    revisedAt: timestamp("revised_at", { withTimezone: true, mode: "date" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("kpi_management_checkins_kpi_id_period_index").on(
      table.kpiId,
      table.period,
    ),
    index("kpi_management_checkins_user_id_period_index").on(
      table.userId,
      table.period,
    ),
  ],
);

export const kpiStudioOptions = pgTable(
  "kpi_studio_options",
  {
    id: id(),
    group: varchar("group", { length: 32 }).notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    slug: varchar("slug", { length: 64 }).notNull(),
    position: numeric("position", {
      precision: 10,
      scale: 0,
      mode: "number",
    }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("kpi_studio_options_group_name_unique").on(
      table.group,
      table.name,
    ),
    uniqueIndex("kpi_studio_options_group_slug_unique").on(
      table.group,
      table.slug,
    ),
    index("kpi_studio_options_group_position_index").on(
      table.group,
      table.position,
    ),
    check(
      "kpi_studio_options_position_unsigned_check",
      sqlCheckUnsigned(table.position, 4_294_967_295),
    ),
  ],
);

export const correctiveAlerts = pgTable(
  "corrective_alerts",
  {
    id: id(),
    departmentId: foreignId("department_id").references(
      (): AnyPgColumn => departments.id,
      { onDelete: "set null" },
    ),
    // Deliberately no FK to KPI: this module is connected to KPI by an event hook.
    kpiId: foreignId("kpi_id"),
    period: varchar("period", { length: 10 }),
    title: varchar("title", { length: 240 }).notNull(),
    description: varchar("description", { length: 2000 }).notNull().default(""),
    severity: varchar("severity", { length: 16 })
      .$type<AlertSeverity>()
      .notNull(),
    status: varchar("status", { length: 16 }).$type<AlertStatus>().notNull(),
    assignedTo: foreignId("assigned_to").references(
      (): AnyPgColumn => users.id,
      { onDelete: "set null" },
    ),
    acknowledgedAt: timestamp("acknowledged_at", {
      withTimezone: true,
      mode: "date",
    }),
    acknowledgedBy: foreignId("acknowledged_by").references(
      (): AnyPgColumn => users.id,
      { onDelete: "set null" },
    ),
    resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: "date" }),
    resolvedBy: foreignId("resolved_by").references(
      (): AnyPgColumn => users.id,
      { onDelete: "set null" },
    ),
    resolutionNote: varchar("resolution_note", { length: 1000 })
      .notNull()
      .default(""),
    dueAt: timestamp("due_at", { withTimezone: true, mode: "date" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("corrective_alerts_assigned_to_foreign").on(table.assignedTo),
    index("corrective_alerts_acknowledged_by_foreign").on(table.acknowledgedBy),
    index("corrective_alerts_resolved_by_foreign").on(table.resolvedBy),
    index("corrective_alerts_department_id_status_index").on(
      table.departmentId,
      table.status,
    ),
    index("corrective_alerts_kpi_id_period_status_index").on(
      table.kpiId,
      table.period,
      table.status,
    ),
  ],
);

export const actionPriorities = pgTable(
  "action_priorities",
  {
    id: id(),
    name: varchar("name", { length: 80 }).notNull(),
    position: numeric("position", {
      precision: 10,
      scale: 0,
      mode: "number",
    }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("action_priorities_name_unique").on(table.name),
    check(
      "action_priorities_position_unsigned_check",
      sqlCheckUnsigned(table.position, 4_294_967_295),
    ),
  ],
);

export const correctiveActions = pgTable(
  "corrective_actions",
  {
    id: id(),
    departmentId: foreignId("department_id")
      .references((): AnyPgColumn => departments.id, { onDelete: "restrict" })
      .notNull(),
    alertId: foreignId("alert_id").references(
      (): AnyPgColumn => correctiveAlerts.id,
      { onDelete: "set null" },
    ),
    title: varchar("title", { length: 240 }).notNull(),
    description: varchar("description", { length: 2000 }).notNull().default(""),
    successMetric: varchar("success_metric", { length: 240 })
      .notNull()
      .default(""),
    ownerUserId: foreignId("owner_user_id")
      .references((): AnyPgColumn => users.id, { onDelete: "restrict" })
      .notNull(),
    createdBy: foreignId("created_by")
      .references((): AnyPgColumn => users.id, { onDelete: "restrict" })
      .notNull(),
    status: varchar("status", { length: 16 }).$type<ActionStatus>().notNull(),
    priority: varchar("priority", { length: 80 }).notNull(),
    dueAt: timestamp("due_at", { withTimezone: true, mode: "date" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("corrective_actions_alert_id_foreign").on(table.alertId),
    index("corrective_actions_created_by_foreign").on(table.createdBy),
    index("corrective_actions_department_id_status_index").on(
      table.departmentId,
      table.status,
    ),
    index("corrective_actions_owner_user_id_status_index").on(
      table.ownerUserId,
      table.status,
    ),
  ],
);

export const smsIppanelSettings = pgTable("sms_ippanel_settings", {
  id: id(),
  apiKey: text("apikey"),
  sender: varchar("sender", { length: 32 }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const smsIppanelCreditAlerts = pgTable(
  "sms_ippanel_credit_alerts",
  {
    id: id(),
    userId: foreignId("user_id")
      .references((): AnyPgColumn => users.id, { onDelete: "cascade" })
      .notNull(),
    threshold: varchar("threshold", { length: 32 }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("sms_ippanel_credit_alerts_user_id_unique").on(table.userId),
  ],
);

export const smsIppanelSendCounters = pgTable(
  "sms_ippanel_send_counters",
  {
    id: id(),
    sentOn: date("sent_on", { mode: "string" }).notNull(),
    sentCount: numeric("sent_count", {
      precision: 10,
      scale: 0,
      mode: "number",
    })
      .notNull()
      .default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("sms_ippanel_send_counters_sent_on_unique").on(table.sentOn),
    check(
      "sms_ippanel_send_counters_sent_count_unsigned_check",
      sqlCheckUnsigned(table.sentCount, 4_294_967_295),
    ),
  ],
);

export const migrations = pgTable(
  "migrations",
  {
    id: bigint("id", { mode: "number" })
      .generatedByDefaultAsIdentity()
      .primaryKey(),
    migration: varchar("migration", { length: 255 }).notNull(),
    batch: integer("batch").notNull(),
  },
  (table) => [
    check(
      "migrations_id_unsigned_check",
      sqlCheckUnsigned(table.id, 4_294_967_295),
    ),
  ],
);

function sqlCheckUnsigned(column: AnyPgColumn, max?: number) {
  return max === undefined
    ? sql`${column} >= 0`
    : sql`${column} >= 0 AND ${column} <= ${sql.raw(String(max))}`;
}

// PostgreSQL counterparts for Eloquent belongsTo / hasMany / hasOne edges.
export const usersRelations = relations(users, ({ one, many }) => ({
  accessLevel: one(accessLevels, {
    fields: [users.accessLevelId],
    references: [accessLevels.id],
    relationName: "userAccessLevel",
  }),
  department: one(departments, {
    fields: [users.departmentId],
    references: [departments.id],
    relationName: "userDepartment",
  }),
  approver: one(users, {
    fields: [users.approvedBy],
    references: [users.id],
    relationName: "userApprover",
  }),
  approvedUsers: many(users, { relationName: "userApprover" }),
  inboxNotifications: many(inboxNotifications),
  auditLogs: many(auditLogs),
  sessions: many(sessions),
  managedDepartments: many(departments, { relationName: "departmentManager" }),
  creditAlerts: many(smsIppanelCreditAlerts),
  ownedKpis: many(kpiManagementKpis, { relationName: "kpiOwner" }),
  reportedKpis: many(kpiManagementKpis, { relationName: "kpiReporter" }),
  submittedValues: many(kpiManagementValues, {
    relationName: "kpiValueSubmitter",
  }),
  checkins: many(kpiManagementCheckins, { relationName: "checkinReporter" }),
  assignedAlerts: many(correctiveAlerts, { relationName: "alertAssignee" }),
  acknowledgedAlerts: many(correctiveAlerts, {
    relationName: "alertAcknowledger",
  }),
  resolvedAlerts: many(correctiveAlerts, { relationName: "alertResolver" }),
  ownedActions: many(correctiveActions, { relationName: "actionOwner" }),
  createdActions: many(correctiveActions, { relationName: "actionCreator" }),
}));

export const departmentsRelations = relations(departments, ({ one, many }) => ({
  manager: one(users, {
    fields: [departments.managerUserId],
    references: [users.id],
    relationName: "departmentManager",
  }),
  users: many(users, { relationName: "userDepartment" }),
  accessLevels: many(accessLevels, { relationName: "accessLevelDepartment" }),
  kpis: many(kpiManagementKpis),
  alerts: many(correctiveAlerts),
  actions: many(correctiveActions),
}));

export const accessLevelsRelations = relations(
  accessLevels,
  ({ one, many }) => ({
    department: one(departments, {
      fields: [accessLevels.departmentId],
      references: [departments.id],
      relationName: "accessLevelDepartment",
    }),
    users: many(users, { relationName: "userAccessLevel" }),
    permissions: many(accessLevelPermissions),
  }),
);

export const accessLevelPermissionsRelations = relations(
  accessLevelPermissions,
  ({ one }) => ({
    accessLevel: one(accessLevels, {
      fields: [accessLevelPermissions.accessLevelId],
      references: [accessLevels.id],
    }),
  }),
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, { fields: [auditLogs.userId], references: [users.id] }),
}));

export const inboxNotificationsRelations = relations(
  inboxNotifications,
  ({ one }) => ({
    recipient: one(users, {
      fields: [inboxNotifications.userId],
      references: [users.id],
    }),
  }),
);

export const kpiManagementKpisRelations = relations(
  kpiManagementKpis,
  ({ one, many }) => ({
    department: one(departments, {
      fields: [kpiManagementKpis.departmentId],
      references: [departments.id],
    }),
    owner: one(users, {
      fields: [kpiManagementKpis.ownerUserId],
      references: [users.id],
      relationName: "kpiOwner",
    }),
    reporter: one(users, {
      fields: [kpiManagementKpis.reporterUserId],
      references: [users.id],
      relationName: "kpiReporter",
    }),
    values: many(kpiManagementValues),
    checkins: many(kpiManagementCheckins),
  }),
);

export const kpiManagementValuesRelations = relations(
  kpiManagementValues,
  ({ one }) => ({
    kpi: one(kpiManagementKpis, {
      fields: [kpiManagementValues.kpiId],
      references: [kpiManagementKpis.id],
    }),
    submitter: one(users, {
      fields: [kpiManagementValues.submittedBy],
      references: [users.id],
      relationName: "kpiValueSubmitter",
    }),
  }),
);

export const kpiManagementCheckinsRelations = relations(
  kpiManagementCheckins,
  ({ one }) => ({
    kpi: one(kpiManagementKpis, {
      fields: [kpiManagementCheckins.kpiId],
      references: [kpiManagementKpis.id],
    }),
    reporter: one(users, {
      fields: [kpiManagementCheckins.userId],
      references: [users.id],
      relationName: "checkinReporter",
    }),
  }),
);

export const correctiveAlertsRelations = relations(
  correctiveAlerts,
  ({ one, many }) => ({
    department: one(departments, {
      fields: [correctiveAlerts.departmentId],
      references: [departments.id],
    }),
    assignee: one(users, {
      fields: [correctiveAlerts.assignedTo],
      references: [users.id],
      relationName: "alertAssignee",
    }),
    acknowledger: one(users, {
      fields: [correctiveAlerts.acknowledgedBy],
      references: [users.id],
      relationName: "alertAcknowledger",
    }),
    resolver: one(users, {
      fields: [correctiveAlerts.resolvedBy],
      references: [users.id],
      relationName: "alertResolver",
    }),
    actions: many(correctiveActions),
  }),
);

export const correctiveActionsRelations = relations(
  correctiveActions,
  ({ one }) => ({
    department: one(departments, {
      fields: [correctiveActions.departmentId],
      references: [departments.id],
    }),
    alert: one(correctiveAlerts, {
      fields: [correctiveActions.alertId],
      references: [correctiveAlerts.id],
    }),
    owner: one(users, {
      fields: [correctiveActions.ownerUserId],
      references: [users.id],
      relationName: "actionOwner",
    }),
    creator: one(users, {
      fields: [correctiveActions.createdBy],
      references: [users.id],
      relationName: "actionCreator",
    }),
  }),
);

export const smsIppanelCreditAlertsRelations = relations(
  smsIppanelCreditAlerts,
  ({ one }) => ({
    user: one(users, {
      fields: [smsIppanelCreditAlerts.userId],
      references: [users.id],
    }),
  }),
);

// Explicit model type exports for every legacy table, including framework tables.
export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
export type Department = InferSelectModel<typeof departments>;
export type NewDepartment = InferInsertModel<typeof departments>;
export type AccessLevel = InferSelectModel<typeof accessLevels>;
export type NewAccessLevel = InferInsertModel<typeof accessLevels>;
export type AccessLevelPermission = InferSelectModel<
  typeof accessLevelPermissions
>;
export type NewAccessLevelPermission = InferInsertModel<
  typeof accessLevelPermissions
>;
export type RolePermission = InferSelectModel<typeof rolePermissions>;
export type NewRolePermission = InferInsertModel<typeof rolePermissions>;
export type PasswordResetToken = InferSelectModel<typeof passwordResetTokens>;
export type NewPasswordResetToken = InferInsertModel<
  typeof passwordResetTokens
>;
export type Session = InferSelectModel<typeof sessions>;
export type NewSession = InferInsertModel<typeof sessions>;
export type CacheEntry = InferSelectModel<typeof cache>;
export type NewCacheEntry = InferInsertModel<typeof cache>;
export type CacheLock = InferSelectModel<typeof cacheLocks>;
export type NewCacheLock = InferInsertModel<typeof cacheLocks>;
export type Job = InferSelectModel<typeof jobs>;
export type NewJob = InferInsertModel<typeof jobs>;
export type JobBatch = InferSelectModel<typeof jobBatches>;
export type NewJobBatch = InferInsertModel<typeof jobBatches>;
export type FailedJob = InferSelectModel<typeof failedJobs>;
export type NewFailedJob = InferInsertModel<typeof failedJobs>;
export type Module = InferSelectModel<typeof modules>;
export type NewModule = InferInsertModel<typeof modules>;
export type OtpChallenge = InferSelectModel<typeof otpChallenges>;
export type NewOtpChallenge = InferInsertModel<typeof otpChallenges>;
export type AuditLog = InferSelectModel<typeof auditLogs>;
export type NewAuditLog = InferInsertModel<typeof auditLogs>;
export type SiteSetting = InferSelectModel<typeof siteSettings>;
export type NewSiteSetting = InferInsertModel<typeof siteSettings>;
export type InboxNotification = InferSelectModel<typeof inboxNotifications>;
export type NewInboxNotification = InferInsertModel<typeof inboxNotifications>;
export type KpiDefinition = InferSelectModel<typeof kpiManagementKpis>;
export type NewKpiDefinition = InferInsertModel<typeof kpiManagementKpis>;
export type KpiValue = InferSelectModel<typeof kpiManagementValues>;
export type NewKpiValue = InferInsertModel<typeof kpiManagementValues>;
export type KpiCheckin = InferSelectModel<typeof kpiManagementCheckins>;
export type NewKpiCheckin = InferInsertModel<typeof kpiManagementCheckins>;
export type KpiStudioOption = InferSelectModel<typeof kpiStudioOptions>;
export type NewKpiStudioOption = InferInsertModel<typeof kpiStudioOptions>;
export type CorrectiveAlert = InferSelectModel<typeof correctiveAlerts>;
export type NewCorrectiveAlert = InferInsertModel<typeof correctiveAlerts>;
export type ActionPriority = InferSelectModel<typeof actionPriorities>;
export type NewActionPriority = InferInsertModel<typeof actionPriorities>;
export type CorrectiveAction = InferSelectModel<typeof correctiveActions>;
export type NewCorrectiveAction = InferInsertModel<typeof correctiveActions>;
export type SmsIppanelSetting = InferSelectModel<typeof smsIppanelSettings>;
export type NewSmsIppanelSetting = InferInsertModel<typeof smsIppanelSettings>;
export type SmsIppanelCreditAlert = InferSelectModel<
  typeof smsIppanelCreditAlerts
>;
export type NewSmsIppanelCreditAlert = InferInsertModel<
  typeof smsIppanelCreditAlerts
>;
export type SmsIppanelSendCounter = InferSelectModel<
  typeof smsIppanelSendCounters
>;
export type NewSmsIppanelSendCounter = InferInsertModel<
  typeof smsIppanelSendCounters
>;
export type LegacyMigration = InferSelectModel<typeof migrations>;
export type NewLegacyMigration = InferInsertModel<typeof migrations>;
