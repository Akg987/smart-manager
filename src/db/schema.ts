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

/** Backed enums stay VARCHAR columns to match the current database contract. */
export type UserRole = "admin" | "user";
export type OtpPurpose = "password-reset" | "two-factor";
export type NotificationType = "info" | "alert" | "action" | "system";
export type CheckinStatus = "draft" | "submitted" | "revised";
export type KpiDefinitionStatus = "draft" | "reviewed" | "published" | "locked";
export type KpiCheckinWorkflowStatus =
  | "draft"
  | "submitted"
  | "data_submitted"
  | "approved"
  | "rejected"
  | "revised"
  | "locked";
export type KpiDataState =
  | "valid"
  | "zero"
  | "null"
  | "missing"
  | "rejected"
  | "late"
  | "stale";
export type RedFlagStatus =
  | "new"
  | "investigating"
  | "action_required"
  | "resolved"
  | "closed";
export type ManagementDecisionStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "communicated"
  | "in_progress"
  | "result_review"
  | "resolved"
  | "closed"
  | "rejected"
  | "cancelled";
export type KpiDirection = "higher" | "lower" | "range";
export type KpiHealth = "green" | "yellow" | "red" | "unknown";
export type DashboardType =
  | "holding"
  | "company"
  | "business_unit"
  | "role"
  | "personal";
export type DashboardVisibility = "private" | "role" | "company" | "holding";
export type DashboardStatus = "draft" | "published" | "archived";
export type DashboardWidgetType =
  | "kpi_card"
  | "trend_chart"
  | "line_chart"
  | "bar_chart"
  | "comparison"
  | "progress"
  | "table"
  | "red_flag_list"
  | "action_list"
  | "decision_list"
  | "data_quality"
  | "company_scorecard";
export type DerivedKpiStatus = "draft" | "published" | "archived";
export type ManagementReviewType = "wbr" | "mbr";
export type ManagementReviewStatus = "draft" | "published" | "closed";
export type ActionStatus =
  | "open"
  | "proposed"
  | "approved"
  | "in_progress"
  | "blocked"
  | "pending_completion_approval"
  | "closed"
  | "canceled"
  | "done";
export type AlertSeverity = "low" | "medium" | "high" | "urgent";
export type AlertStatus = "open" | "acknowledged" | "resolved";
export type TenantScopeType =
  | "holding"
  | "company"
  | "branch"
  | "businessUnit"
  | "own"
  | "assigned"
  | "domain";
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

export const holdings = pgTable(
  "holdings",
  {
    id: id(),
    name: varchar("name", { length: 160 }).notNull(),
    code: varchar("code", { length: 48 }).notNull(),
    status: varchar("status", { length: 24 }).notNull().default("active"),
    logo: varchar("logo", { length: 255 }),
    calendar: varchar("calendar", { length: 32 }).notNull().default("jalali"),
    timezone: varchar("timezone", { length: 64 })
      .notNull()
      .default("Asia/Tehran"),
    currency: varchar("currency", { length: 8 }).notNull().default("IRR"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("holdings_code_unique").on(table.code),
    index("holdings_status_index").on(table.status),
  ],
);

export const companies = pgTable(
  "companies",
  {
    id: id(),
    holdingId: foreignId("holding_id")
      .references((): AnyPgColumn => holdings.id, { onDelete: "restrict" })
      .notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    code: varchar("code", { length: 48 }).notNull(),
    legalName: varchar("legal_name", { length: 200 }),
    ceoUserId: foreignId("ceo_user_id").references(
      (): AnyPgColumn => users.id,
      { onDelete: "set null" },
    ),
    pnlOwnerUserId: foreignId("pnl_owner_user_id").references(
      (): AnyPgColumn => users.id,
      { onDelete: "set null" },
    ),
    dataOwnerUserId: foreignId("data_owner_user_id").references(
      (): AnyPgColumn => users.id,
      { onDelete: "set null" },
    ),
    pmoReviewerUserId: foreignId("pmo_reviewer_user_id").references(
      (): AnyPgColumn => users.id,
      { onDelete: "set null" },
    ),
    status: varchar("status", { length: 24 }).notNull().default("active"),
    calendar: varchar("calendar", { length: 32 }).notNull().default("jalali"),
    currency: varchar("currency", { length: 8 }).notNull().default("IRR"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    archivedAt: timestamp("archived_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    uniqueIndex("companies_holding_id_code_unique").on(
      table.holdingId,
      table.code,
    ),
    index("companies_holding_id_status_index").on(
      table.holdingId,
      table.status,
    ),
    index("companies_ceo_user_id_index").on(table.ceoUserId),
  ],
);

export const branches = pgTable(
  "branches",
  {
    id: id(),
    companyId: foreignId("company_id")
      .references((): AnyPgColumn => companies.id, { onDelete: "cascade" })
      .notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    code: varchar("code", { length: 48 }).notNull(),
    managerUserId: foreignId("manager_user_id").references(
      (): AnyPgColumn => users.id,
      { onDelete: "set null" },
    ),
    status: varchar("status", { length: 24 }).notNull().default("active"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("branches_company_id_code_unique").on(
      table.companyId,
      table.code,
    ),
    index("branches_company_id_status_index").on(table.companyId, table.status),
  ],
);

export const businessUnits = pgTable(
  "business_units",
  {
    id: id(),
    companyId: foreignId("company_id")
      .references((): AnyPgColumn => companies.id, { onDelete: "cascade" })
      .notNull(),
    branchId: foreignId("branch_id").references(
      (): AnyPgColumn => branches.id,
      { onDelete: "set null" },
    ),
    legacyDepartmentId: foreignId("legacy_department_id").references(
      (): AnyPgColumn => departments.id,
      { onDelete: "set null" },
    ),
    name: varchar("name", { length: 160 }).notNull(),
    code: varchar("code", { length: 48 }).notNull(),
    managerUserId: foreignId("manager_user_id").references(
      (): AnyPgColumn => users.id,
      { onDelete: "set null" },
    ),
    domain: varchar("domain", { length: 64 }).notNull().default("general"),
    status: varchar("status", { length: 24 }).notNull().default("active"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("business_units_company_id_code_unique").on(
      table.companyId,
      table.code,
    ),
    uniqueIndex("business_units_legacy_department_id_unique").on(
      table.legacyDepartmentId,
    ),
    index("business_units_company_id_branch_id_index").on(
      table.companyId,
      table.branchId,
    ),
  ],
);

export const roles = pgTable(
  "roles",
  {
    id: id(),
    holdingId: foreignId("holding_id").references(
      (): AnyPgColumn => holdings.id,
      { onDelete: "cascade" },
    ),
    key: varchar("key", { length: 64 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    description: varchar("description", { length: 500 }),
    isSystem: boolean("is_system").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("roles_holding_id_key_unique").on(table.holdingId, table.key),
    index("roles_is_system_index").on(table.isSystem),
  ],
);

export const permissions = pgTable(
  "permissions",
  {
    id: id(),
    key: varchar("key", { length: 120 }).notNull(),
    resource: varchar("resource", { length: 64 }).notNull(),
    action: varchar("action", { length: 64 }).notNull(),
    description: varchar("description", { length: 300 }),
    isSystem: boolean("is_system").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("permissions_key_unique").on(table.key),
    uniqueIndex("permissions_resource_action_unique").on(
      table.resource,
      table.action,
    ),
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
    role: varchar("role", { length: 20 }),
    permission: varchar("permission", { length: 100 }),
    roleId: foreignId("role_id").references((): AnyPgColumn => roles.id, {
      onDelete: "cascade",
    }),
    permissionId: foreignId("permission_id").references(
      (): AnyPgColumn => permissions.id,
      { onDelete: "cascade" },
    ),
    scopeType: varchar("scope_type", { length: 24 }).$type<TenantScopeType>(),
    domain: varchar("domain", { length: 64 }),
  },
  (table) => [
    uniqueIndex("role_permissions_role_permission_unique").on(
      table.role,
      table.permission,
    ),
    index("role_permissions_role_index").on(table.role),
    uniqueIndex("role_permissions_role_id_permission_id_unique").on(
      table.roleId,
      table.permissionId,
    ),
  ],
);

export const memberships = pgTable(
  "memberships",
  {
    id: id(),
    userId: foreignId("user_id")
      .references((): AnyPgColumn => users.id, { onDelete: "cascade" })
      .notNull(),
    holdingId: foreignId("holding_id")
      .references((): AnyPgColumn => holdings.id, { onDelete: "cascade" })
      .notNull(),
    companyId: foreignId("company_id").references(
      (): AnyPgColumn => companies.id,
      { onDelete: "cascade" },
    ),
    branchId: foreignId("branch_id").references(
      (): AnyPgColumn => branches.id,
      { onDelete: "cascade" },
    ),
    businessUnitId: foreignId("business_unit_id").references(
      (): AnyPgColumn => businessUnits.id,
      { onDelete: "cascade" },
    ),
    roleId: foreignId("role_id").references((): AnyPgColumn => roles.id, {
      onDelete: "restrict",
    }),
    scopeType: varchar("scope_type", { length: 24 })
      .$type<TenantScopeType>()
      .notNull()
      .default("company"),
    status: varchar("status", { length: 24 }).notNull().default("active"),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("memberships_user_id_status_index").on(table.userId, table.status),
    index("memberships_holding_id_company_id_index").on(
      table.holdingId,
      table.companyId,
    ),
    uniqueIndex("memberships_user_org_scope_unique").on(
      table.userId,
      table.holdingId,
      table.companyId,
      table.branchId,
      table.businessUnitId,
      table.roleId,
    ),
  ],
);

export const membershipRoles = pgTable(
  "membership_roles",
  {
    id: id(),
    membershipId: foreignId("membership_id")
      .references((): AnyPgColumn => memberships.id, { onDelete: "cascade" })
      .notNull(),
    roleId: foreignId("role_id")
      .references((): AnyPgColumn => roles.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("membership_roles_membership_id_role_id_unique").on(
      table.membershipId,
      table.roleId,
    ),
    index("membership_roles_role_id_index").on(table.roleId),
  ],
);

export const invitations = pgTable(
  "invitations",
  {
    id: id(),
    holdingId: foreignId("holding_id")
      .references((): AnyPgColumn => holdings.id, { onDelete: "cascade" })
      .notNull(),
    companyId: foreignId("company_id").references(
      (): AnyPgColumn => companies.id,
      { onDelete: "cascade" },
    ),
    mobile: varchar("mobile", { length: 11 }).notNull(),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    roleId: foreignId("role_id").references((): AnyPgColumn => roles.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: "date" }),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
    createdBy: foreignId("created_by").references((): AnyPgColumn => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("invitations_token_hash_unique").on(table.tokenHash),
    index("invitations_holding_id_mobile_index").on(
      table.holdingId,
      table.mobile,
    ),
    index("invitations_expires_at_index").on(table.expiresAt),
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

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: foreignId("user_id")
      .references((): AnyPgColumn => users.id, { onDelete: "cascade" })
      .notNull(),
    membershipId: foreignId("membership_id")
      .references((): AnyPgColumn => memberships.id, { onDelete: "cascade" })
      .notNull(),
    activeCompanyId: foreignId("active_company_id").references(
      (): AnyPgColumn => companies.id,
      { onDelete: "cascade" },
    ),
    tokenVersion: integer("token_version").notNull().default(1),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
    lastActivityAt: timestamp("last_activity_at", {
      withTimezone: true,
      mode: "date",
    }),
    createdAt: createdAt(),
  },
  (table) => [
    index("auth_sessions_user_id_revoked_at_index").on(
      table.userId,
      table.revokedAt,
    ),
    index("auth_sessions_membership_id_index").on(table.membershipId),
    index("auth_sessions_expires_at_index").on(table.expiresAt),
  ],
);

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    sessionId: varchar("session_id", { length: 36 })
      .references((): AnyPgColumn => authSessions.id, { onDelete: "cascade" })
      .notNull(),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true, mode: "date" }),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
    replacedById: varchar("replaced_by_id", { length: 36 }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("refresh_tokens_token_hash_unique").on(table.tokenHash),
    index("refresh_tokens_session_id_revoked_at_index").on(
      table.sessionId,
      table.revokedAt,
    ),
    index("refresh_tokens_expires_at_index").on(table.expiresAt),
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
    holdingId: foreignId("holding_id").references(
      (): AnyPgColumn => holdings.id,
      { onDelete: "set null" },
    ),
    companyId: foreignId("company_id").references(
      (): AnyPgColumn => companies.id,
      { onDelete: "set null" },
    ),
    membershipId: foreignId("membership_id").references(
      (): AnyPgColumn => memberships.id,
      { onDelete: "set null" },
    ),
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
    index("audit_logs_company_id_created_at_index").on(
      table.companyId,
      table.createdAt,
    ),
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

export const dashboards = pgTable(
  "dashboards",
  {
    id: id(),
    holdingId: foreignId("holding_id")
      .references((): AnyPgColumn => holdings.id, { onDelete: "restrict" })
      .notNull(),
    companyId: foreignId("company_id").references(
      (): AnyPgColumn => companies.id,
      { onDelete: "cascade" },
    ),
    businessUnitId: foreignId("business_unit_id").references(
      (): AnyPgColumn => businessUnits.id,
      { onDelete: "cascade" },
    ),
    ownerUserId: foreignId("owner_user_id")
      .references((): AnyPgColumn => users.id, { onDelete: "restrict" })
      .notNull(),
    roleKey: varchar("role_key", { length: 80 }),
    name: varchar("name", { length: 160 }).notNull(),
    type: varchar("type", { length: 24 }).$type<DashboardType>().notNull(),
    visibility: varchar("visibility", { length: 16 })
      .$type<DashboardVisibility>()
      .notNull()
      .default("private"),
    layout: json("layout")
      .$type<JsonValue>()
      .notNull()
      .default(sql`'[]'::json`),
    filters: json("filters")
      .$type<JsonValue>()
      .notNull()
      .default(sql`'{}'::json`),
    status: varchar("status", { length: 16 })
      .$type<DashboardStatus>()
      .notNull()
      .default("draft"),
    version: integer("version").notNull().default(1),
    publishedAt: timestamp("published_at", {
      withTimezone: true,
      mode: "date",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("dashboards_holding_status_index").on(table.holdingId, table.status),
    index("dashboards_company_status_index").on(table.companyId, table.status),
    index("dashboards_owner_updated_index").on(
      table.ownerUserId,
      table.updatedAt,
    ),
  ],
);

export const dashboardWidgets = pgTable(
  "dashboard_widgets",
  {
    id: id(),
    dashboardId: foreignId("dashboard_id")
      .references((): AnyPgColumn => dashboards.id, { onDelete: "cascade" })
      .notNull(),
    type: varchar("type", { length: 32 })
      .$type<DashboardWidgetType>()
      .notNull(),
    title: varchar("title", { length: 160 }).notNull().default(""),
    config: json("config")
      .$type<JsonValue>()
      .notNull()
      .default(sql`'{}'::json`),
    positionX: integer("position_x").notNull().default(0),
    positionY: integer("position_y").notNull().default(0),
    width: integer("width").notNull().default(6),
    height: integer("height").notNull().default(4),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("dashboard_widgets_dashboard_position_index").on(
      table.dashboardId,
      table.positionY,
      table.positionX,
    ),
  ],
);

export const dashboardVersions = pgTable(
  "dashboard_versions",
  {
    id: id(),
    dashboardId: foreignId("dashboard_id")
      .references((): AnyPgColumn => dashboards.id, { onDelete: "restrict" })
      .notNull(),
    version: integer("version").notNull(),
    definition: json("definition").$type<JsonValue>().notNull(),
    createdBy: foreignId("created_by").references((): AnyPgColumn => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("dashboard_versions_dashboard_version_unique").on(
      table.dashboardId,
      table.version,
    ),
  ],
);

export const derivedKpis = pgTable(
  "derived_kpis",
  {
    id: id(),
    holdingId: foreignId("holding_id")
      .references((): AnyPgColumn => holdings.id, { onDelete: "restrict" })
      .notNull(),
    companyId: foreignId("company_id")
      .references((): AnyPgColumn => companies.id, { onDelete: "restrict" })
      .notNull(),
    businessUnitId: foreignId("business_unit_id").references(
      (): AnyPgColumn => businessUnits.id,
      { onDelete: "set null" },
    ),
    code: varchar("code", { length: 64 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    description: varchar("description", { length: 2000 }).notNull().default(""),
    sourceKpis: json("source_kpis")
      .$type<JsonValue>()
      .notNull()
      .default(sql`'[]'::json`),
    formulaAst: json("formula_ast").$type<JsonValue>().notNull(),
    formulaSource: varchar("formula_source", { length: 2000 }).notNull(),
    formulaVersion: integer("formula_version").notNull().default(1),
    unit: varchar("unit", { length: 80 }).notNull(),
    periodType: varchar("period_type", { length: 32 }).notNull(),
    ownerUserId: foreignId("owner_user_id").references(
      (): AnyPgColumn => users.id,
      { onDelete: "set null" },
    ),
    targetValue: numeric("target_value", {
      precision: 14,
      scale: 4,
      mode: "string",
    }),
    status: varchar("status", { length: 16 })
      .$type<DerivedKpiStatus>()
      .notNull()
      .default("draft"),
    version: integer("version").notNull().default(1),
    createdBy: foreignId("created_by").references((): AnyPgColumn => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("derived_kpis_company_code_unique").on(
      table.companyId,
      table.code,
    ),
    index("derived_kpis_company_status_index").on(
      table.companyId,
      table.status,
    ),
  ],
);

export const derivedKpiVersions = pgTable(
  "derived_kpi_versions",
  {
    id: id(),
    derivedKpiId: foreignId("derived_kpi_id")
      .references((): AnyPgColumn => derivedKpis.id, { onDelete: "restrict" })
      .notNull(),
    version: integer("version").notNull(),
    formulaVersion: integer("formula_version").notNull(),
    definition: json("definition").$type<JsonValue>().notNull(),
    createdBy: foreignId("created_by").references((): AnyPgColumn => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("derived_kpi_versions_entity_version_unique").on(
      table.derivedKpiId,
      table.version,
    ),
  ],
);

export const derivedKpiValues = pgTable(
  "derived_kpi_values",
  {
    id: id(),
    derivedKpiId: foreignId("derived_kpi_id")
      .references((): AnyPgColumn => derivedKpis.id, { onDelete: "restrict" })
      .notNull(),
    companyId: foreignId("company_id")
      .references((): AnyPgColumn => companies.id, { onDelete: "restrict" })
      .notNull(),
    businessUnitId: foreignId("business_unit_id").references(
      (): AnyPgColumn => businessUnits.id,
      { onDelete: "set null" },
    ),
    period: varchar("period", { length: 10 }).notNull(),
    formulaVersion: integer("formula_version").notNull(),
    actualValue: numeric("actual_value", {
      precision: 14,
      scale: 4,
      mode: "string",
    }).notNull(),
    sourceSnapshot: json("source_snapshot").$type<JsonValue>().notNull(),
    calculatedBy: foreignId("calculated_by").references(
      (): AnyPgColumn => users.id,
      { onDelete: "set null" },
    ),
    calculatedAt: timestamp("calculated_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("derived_kpi_values_period_formula_version_unique").on(
      table.derivedKpiId,
      table.period,
      table.formulaVersion,
    ),
    index("derived_kpi_values_company_period_index").on(
      table.companyId,
      table.period,
    ),
  ],
);

export const managementReviewMeetings = pgTable(
  "management_review_meetings",
  {
    id: id(),
    holdingId: foreignId("holding_id")
      .references((): AnyPgColumn => holdings.id, { onDelete: "restrict" })
      .notNull(),
    companyId: foreignId("company_id")
      .references((): AnyPgColumn => companies.id, { onDelete: "restrict" })
      .notNull(),
    businessUnitId: foreignId("business_unit_id").references(
      (): AnyPgColumn => businessUnits.id,
      { onDelete: "set null" },
    ),
    type: varchar("type", { length: 8 })
      .$type<ManagementReviewType>()
      .notNull(),
    period: varchar("period", { length: 10 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    status: varchar("status", { length: 16 })
      .$type<ManagementReviewStatus>()
      .notNull()
      .default("draft"),
    scheduledAt: timestamp("scheduled_at", {
      withTimezone: true,
      mode: "date",
    }),
    ownerUserId: foreignId("owner_user_id").references(
      (): AnyPgColumn => users.id,
      { onDelete: "set null" },
    ),
    sections: json("sections")
      .$type<JsonValue>()
      .notNull()
      .default(sql`'{}'::json`),
    snapshot: json("snapshot")
      .$type<JsonValue>()
      .notNull()
      .default(sql`'{}'::json`),
    version: integer("version").notNull().default(1),
    createdBy: foreignId("created_by").references((): AnyPgColumn => users.id, {
      onDelete: "set null",
    }),
    publishedAt: timestamp("published_at", {
      withTimezone: true,
      mode: "date",
    }),
    closedAt: timestamp("closed_at", { withTimezone: true, mode: "date" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("management_review_scope_period_unique").on(
      table.companyId,
      sql`coalesce(${table.businessUnitId}, 0)`,
      table.type,
      table.period,
    ),
    index("management_review_company_status_period_index").on(
      table.companyId,
      table.status,
      table.period,
    ),
  ],
);

export const managementEscalationRules = pgTable(
  "management_escalation_rules",
  {
    id: id(),
    holdingId: foreignId("holding_id")
      .references((): AnyPgColumn => holdings.id, { onDelete: "cascade" })
      .notNull(),
    companyId: foreignId("company_id").references(
      (): AnyPgColumn => companies.id,
      { onDelete: "cascade" },
    ),
    trigger: varchar("trigger", { length: 32 }).notNull(),
    configuration: json("configuration")
      .$type<JsonValue>()
      .notNull()
      .default(sql`'{}'::json`),
    escalationLevels: json("escalation_levels").$type<JsonValue>().notNull(),
    enabled: boolean("enabled").notNull().default(true),
    createdBy: foreignId("created_by").references((): AnyPgColumn => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("management_escalation_rules_scope_enabled_index").on(
      table.holdingId,
      table.companyId,
      table.enabled,
    ),
  ],
);

export const managementEscalationEvents = pgTable(
  "management_escalation_events",
  {
    id: id(),
    ruleId: foreignId("rule_id")
      .references((): AnyPgColumn => managementEscalationRules.id, {
        onDelete: "cascade",
      })
      .notNull(),
    holdingId: foreignId("holding_id")
      .references((): AnyPgColumn => holdings.id, { onDelete: "restrict" })
      .notNull(),
    companyId: foreignId("company_id")
      .references((): AnyPgColumn => companies.id, { onDelete: "restrict" })
      .notNull(),
    targetType: varchar("target_type", { length: 24 }).notNull(),
    targetId: foreignId("target_id").notNull(),
    level: integer("level").notNull(),
    recipientUserId: foreignId("recipient_user_id").references(
      (): AnyPgColumn => users.id,
      { onDelete: "set null" },
    ),
    recipientRole: varchar("recipient_role", { length: 80 }),
    detail: json("detail")
      .$type<JsonValue>()
      .notNull()
      .default(sql`'{}'::json`),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("management_escalation_target_level_unique").on(
      table.ruleId,
      table.targetType,
      table.targetId,
      table.level,
    ),
    index("management_escalation_company_created_index").on(
      table.companyId,
      table.createdAt,
    ),
  ],
);

export const managementReminderPolicies = pgTable(
  "management_reminder_policies",
  {
    id: id(),
    holdingId: foreignId("holding_id")
      .references((): AnyPgColumn => holdings.id, { onDelete: "cascade" })
      .notNull(),
    companyId: foreignId("company_id").references(
      (): AnyPgColumn => companies.id,
      { onDelete: "cascade" },
    ),
    itemType: varchar("item_type", { length: 24 }).notNull(),
    offsetsMinutes: json("offsets_minutes")
      .$type<JsonValue>()
      .notNull()
      .default(sql`'[-1440,0,1440]'::json`),
    enabled: boolean("enabled").notNull().default(true),
    createdBy: foreignId("created_by").references((): AnyPgColumn => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("management_reminder_scope_item_unique").on(
      table.holdingId,
      table.companyId,
      table.itemType,
    ),
  ],
);

export const managementReminders = pgTable(
  "management_reminders",
  {
    id: id(),
    policyId: foreignId("policy_id").references(
      (): AnyPgColumn => managementReminderPolicies.id,
      { onDelete: "set null" },
    ),
    holdingId: foreignId("holding_id")
      .references((): AnyPgColumn => holdings.id, { onDelete: "restrict" })
      .notNull(),
    companyId: foreignId("company_id")
      .references((): AnyPgColumn => companies.id, { onDelete: "restrict" })
      .notNull(),
    targetType: varchar("target_type", { length: 24 }).notNull(),
    targetId: foreignId("target_id").notNull(),
    recipientUserId: foreignId("recipient_user_id")
      .references((): AnyPgColumn => users.id, { onDelete: "cascade" })
      .notNull(),
    phase: varchar("phase", { length: 16 }).notNull(),
    scheduledFor: timestamp("scheduled_for", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("management_reminders_idempotent_unique").on(
      table.targetType,
      table.targetId,
      table.recipientUserId,
      table.phase,
      table.scheduledFor,
    ),
    index("management_reminders_due_index").on(
      table.sentAt,
      table.scheduledFor,
    ),
  ],
);

export const kpiManagementKpis = pgTable(
  "kpi_management_kpis",
  {
    id: id(),
    departmentId: foreignId("department_id").references(
      (): AnyPgColumn => departments.id,
      { onDelete: "restrict" },
    ),
    holdingId: foreignId("holding_id")
      .references((): AnyPgColumn => holdings.id, { onDelete: "restrict" })
      .notNull(),
    companyId: foreignId("company_id")
      .references((): AnyPgColumn => companies.id, { onDelete: "restrict" })
      .notNull(),
    branchId: foreignId("branch_id").references(
      (): AnyPgColumn => branches.id,
      { onDelete: "set null" },
    ),
    businessUnitId: foreignId("business_unit_id").references(
      (): AnyPgColumn => businessUnits.id,
      { onDelete: "set null" },
    ),
    code: varchar("code", { length: 64 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    description: varchar("description", { length: 3000 }).notNull().default(""),
    domain: varchar("domain", { length: 80 }),
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
    dataOwnerUserId: foreignId("data_owner_user_id").references(
      (): AnyPgColumn => users.id,
      { onDelete: "set null" },
    ),
    reporterUserId: foreignId("reporter_user_id").references(
      (): AnyPgColumn => users.id,
      { onDelete: "set null" },
    ),
    reviewerUserId: foreignId("reviewer_user_id").references(
      (): AnyPgColumn => users.id,
      { onDelete: "set null" },
    ),
    source: varchar("source", { length: 160 }).notNull().default("manual"),
    formulaType: varchar("formula_type", { length: 48 })
      .notNull()
      .default("direct"),
    reportingPeriod: varchar("reporting_period", { length: 32 })
      .notNull()
      .default("monthly"),
    submissionDeadline: date("submission_deadline", { mode: "string" }),
    version: integer("version").notNull().default(1),
    effectiveFrom: date("effective_from", { mode: "string" })
      .notNull()
      .default(sql`CURRENT_DATE`),
    status: varchar("status", { length: 16 })
      .$type<KpiDefinitionStatus>()
      .notNull()
      .default("draft"),
    frequency: varchar("frequency", { length: 50 }).notNull().default("هفتگی"),
    inputMode: varchar("input_mode", { length: 64 })
      .notNull()
      .default("direct"),
    inputFields: json("input_fields").$type<JsonValue>().notNull(),
    inputOptions: json("input_options")
      .$type<JsonValue>()
      .notNull()
      .default(sql`'[]'::json`),
    formulaConfig: json("formula_config").$type<JsonValue>(),
    rangeConfig: json("range_config").$type<JsonValue>(),
    active: boolean("active").notNull().default(true),
    weight: numeric("weight", { precision: 5, scale: 2, mode: "string" })
      .notNull()
      .default("1.00"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("kpi_management_kpis_company_code_unique").on(
      table.companyId,
      table.code,
    ),
    index("kpi_management_kpis_owner_user_id_foreign").on(table.ownerUserId),
    index("kpi_management_kpis_department_id_active_index").on(
      table.departmentId,
      table.active,
    ),
    index("kpi_management_kpis_reporter_user_id_foreign").on(
      table.reporterUserId,
    ),
    index("kpi_management_kpis_company_status_index").on(
      table.companyId,
      table.status,
    ),
    index("kpi_management_kpis_business_unit_index").on(table.businessUnitId),
  ],
);

export const kpiManagementKpiVersions = pgTable(
  "kpi_management_kpi_versions",
  {
    id: id(),
    kpiId: foreignId("kpi_id")
      .references((): AnyPgColumn => kpiManagementKpis.id, {
        onDelete: "restrict",
      })
      .notNull(),
    version: integer("version").notNull(),
    definition: json("definition").$type<JsonValue>().notNull(),
    effectiveFrom: date("effective_from", { mode: "string" }).notNull(),
    createdBy: foreignId("created_by").references((): AnyPgColumn => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("kpi_management_kpi_versions_kpi_version_unique").on(
      table.kpiId,
      table.version,
    ),
    index("kpi_management_kpi_versions_effective_index").on(
      table.kpiId,
      table.effectiveFrom,
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
    companyId: foreignId("company_id").references(
      (): AnyPgColumn => companies.id,
      { onDelete: "restrict" },
    ),
    branchId: foreignId("branch_id").references(
      (): AnyPgColumn => branches.id,
      { onDelete: "set null" },
    ),
    businessUnitId: foreignId("business_unit_id").references(
      (): AnyPgColumn => businessUnits.id,
      { onDelete: "set null" },
    ),
    period: varchar("period", { length: 10 }).notNull(),
    version: integer("version").notNull().default(1),
    definitionVersion: integer("definition_version").notNull().default(1),
    actualValue: numeric("actual_value", {
      precision: 14,
      scale: 4,
      mode: "string",
    }),
    rawValue: json("raw_value").$type<JsonValue>(),
    unit: varchar("unit", { length: 80 }).notNull().default(""),
    targetValue: numeric("target_value", {
      precision: 14,
      scale: 4,
      mode: "string",
    }).notNull(),
    status: varchar("status", { length: 16 }).$type<KpiHealth>().notNull(),
    dataState: varchar("data_state", { length: 16 })
      .$type<KpiDataState>()
      .notNull()
      .default("valid"),
    source: varchar("source", { length: 32 }).notNull().default("checkin"),
    submittedBy: foreignId("submitted_by").references(
      (): AnyPgColumn => users.id,
      { onDelete: "set null" },
    ),
    reviewedBy: foreignId("reviewed_by").references(
      (): AnyPgColumn => users.id,
      { onDelete: "set null" },
    ),
    approvedBy: foreignId("approved_by").references(
      (): AnyPgColumn => users.id,
      { onDelete: "set null" },
    ),
    approvedAt: timestamp("approved_at", { withTimezone: true, mode: "date" }),
    isCurrent: boolean("is_current").notNull().default(false),
    note: varchar("note", { length: 500 }).notNull().default(""),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("kpi_management_values_kpi_period_version_unique").on(
      table.kpiId,
      table.period,
      table.version,
    ),
    uniqueIndex("kpi_management_values_one_current_period_unique")
      .on(table.kpiId, table.period)
      .where(sql`${table.isCurrent} = true`),
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
    status: varchar("status", { length: 16 })
      .$type<KpiCheckinWorkflowStatus>()
      .notNull(),
    dataJson: json("data_json").$type<JsonValue>().notNull(),
    actualValue: numeric("actual_value", {
      precision: 14,
      scale: 4,
      mode: "string",
    }),
    note: varchar("note", { length: 500 }).notNull().default(""),
    blockers: varchar("blockers", { length: 500 }).notNull().default(""),
    reviewedBy: foreignId("reviewed_by").references(
      (): AnyPgColumn => users.id,
      { onDelete: "set null" },
    ),
    approvedBy: foreignId("approved_by").references(
      (): AnyPgColumn => users.id,
      { onDelete: "set null" },
    ),
    reviewNote: varchar("review_note", { length: 1000 }).notNull().default(""),
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

export const kpiImportRuns = pgTable(
  "kpi_import_runs",
  {
    id: id(),
    holdingId: foreignId("holding_id")
      .references((): AnyPgColumn => holdings.id, { onDelete: "restrict" })
      .notNull(),
    companyId: foreignId("company_id")
      .references((): AnyPgColumn => companies.id, { onDelete: "restrict" })
      .notNull(),
    actorId: foreignId("actor_id").references((): AnyPgColumn => users.id, {
      onDelete: "set null",
    }),
    fileName: varchar("file_name", { length: 160 }).notNull(),
    rowCount: integer("row_count").notNull(),
    importedCount: integer("imported_count").notNull().default(0),
    duplicateCount: integer("duplicate_count").notNull().default(0),
    rejectedCount: integer("rejected_count").notNull().default(0),
    status: varchar("status", { length: 16 })
      .$type<"completed" | "partial" | "failed">()
      .notNull(),
    createdAt: createdAt().notNull().defaultNow(),
  },
  (table) => [
    index("kpi_import_runs_company_created_index").on(
      table.companyId,
      table.createdAt,
    ),
  ],
);

export const kpiImportRecords = pgTable(
  "kpi_import_records",
  {
    id: id(),
    runId: foreignId("run_id")
      .references((): AnyPgColumn => kpiImportRuns.id, { onDelete: "restrict" })
      .notNull(),
    holdingId: foreignId("holding_id")
      .references((): AnyPgColumn => holdings.id, { onDelete: "restrict" })
      .notNull(),
    companyId: foreignId("company_id")
      .references((): AnyPgColumn => companies.id, { onDelete: "restrict" })
      .notNull(),
    branchId: foreignId("branch_id").references(
      (): AnyPgColumn => branches.id,
      { onDelete: "set null" },
    ),
    businessUnitId: foreignId("business_unit_id").references(
      (): AnyPgColumn => businessUnits.id,
      { onDelete: "set null" },
    ),
    kpiId: foreignId("kpi_id")
      .references((): AnyPgColumn => kpiManagementKpis.id, {
        onDelete: "restrict",
      })
      .notNull(),
    checkinId: foreignId("checkin_id").references(
      (): AnyPgColumn => kpiManagementCheckins.id,
      { onDelete: "set null" },
    ),
    externalId: varchar("external_id", { length: 128 }).notNull(),
    source: varchar("source", { length: 64 }).notNull(),
    period: varchar("period", { length: 10 }).notNull(),
    value: numeric("value", { precision: 14, scale: 4, mode: "string" }).notNull(),
    unit: varchar("unit", { length: 32 }).notNull(),
    payloadHash: varchar("payload_hash", { length: 64 }).notNull(),
    kpiVersion: integer("kpi_version").notNull(),
    importedAt: timestamp("imported_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("kpi_import_records_company_source_external_unique").on(
      table.companyId,
      table.source,
      table.externalId,
    ),
    uniqueIndex("kpi_import_records_company_kpi_period_unique").on(
      table.companyId,
      table.kpiId,
      table.period,
    ),
    index("kpi_import_records_run_index").on(table.runId),
  ],
);

export const managementObservations = pgTable(
  "management_observations",
  {
    id: id(),
    holdingId: foreignId("holding_id")
      .references((): AnyPgColumn => holdings.id, { onDelete: "restrict" })
      .notNull(),
    companyId: foreignId("company_id")
      .references((): AnyPgColumn => companies.id, { onDelete: "restrict" })
      .notNull(),
    branchId: foreignId("branch_id").references(
      (): AnyPgColumn => branches.id,
      { onDelete: "set null" },
    ),
    businessUnitId: foreignId("business_unit_id").references(
      (): AnyPgColumn => businessUnits.id,
      { onDelete: "set null" },
    ),
    userId: foreignId("user_id")
      .references((): AnyPgColumn => users.id, { onDelete: "restrict" })
      .notNull(),
    period: varchar("period", { length: 10 }).notNull(),
    text: text("text").notNull(),
    tags: json("tags").$type<JsonValue>().notNull().default([]),
    relatedKpiIds: json("related_kpi_ids")
      .$type<JsonValue>()
      .notNull()
      .default([]),
    status: varchar("status", { length: 16 }).notNull().default("submitted"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("management_observations_company_period_index").on(
      table.companyId,
      table.period,
    ),
    index("management_observations_business_unit_period_index").on(
      table.businessUnitId,
      table.period,
    ),
    index("management_observations_user_created_index").on(
      table.userId,
      table.createdAt,
    ),
  ],
);

export const managementDecisions = pgTable(
  "management_decisions",
  {
    id: id(),
    holdingId: foreignId("holding_id")
      .references((): AnyPgColumn => holdings.id, { onDelete: "restrict" })
      .notNull(),
    companyId: foreignId("company_id")
      .references((): AnyPgColumn => companies.id, { onDelete: "restrict" })
      .notNull(),
    branchId: foreignId("branch_id").references(
      (): AnyPgColumn => branches.id,
      { onDelete: "set null" },
    ),
    businessUnitId: foreignId("business_unit_id").references(
      (): AnyPgColumn => businessUnits.id,
      { onDelete: "set null" },
    ),
    period: varchar("period", { length: 10 }),
    sourceMeeting: varchar("source_meeting", { length: 250 }),
    decisionText: text("decision_text").notNull(),
    ownerUserId: foreignId("owner_user_id").references(
      (): AnyPgColumn => users.id,
      { onDelete: "set null" },
    ),
    deadline: date("deadline", { mode: "string" }).notNull(),
    status: varchar("status", { length: 24 })
      .$type<ManagementDecisionStatus>()
      .notNull()
      .default("pending_approval"),
    relatedKpiIds: json("related_kpi_ids")
      .$type<JsonValue>()
      .notNull()
      .default([]),
    actionIds: json("action_ids").$type<JsonValue>().notNull().default([]),
    createdBy: foreignId("created_by").references((): AnyPgColumn => users.id, {
      onDelete: "set null",
    }),
    approvedBy: foreignId("approved_by").references(
      (): AnyPgColumn => users.id,
      { onDelete: "set null" },
    ),
    approvedAt: timestamp("approved_at", { withTimezone: true, mode: "date" }),
    outcome: text("outcome"),
    closureEvidence: varchar("closure_evidence", { length: 2000 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    closedAt: timestamp("closed_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    index("management_decisions_company_status_deadline_index").on(
      table.companyId,
      table.status,
      table.deadline,
    ),
    index("management_decisions_business_unit_status_deadline_index").on(
      table.businessUnitId,
      table.status,
      table.deadline,
    ),
    index("management_decisions_owner_deadline_index").on(
      table.ownerUserId,
      table.deadline,
    ),
  ],
);

export const redFlags = pgTable(
  "red_flags",
  {
    id: id(),
    holdingId: foreignId("holding_id")
      .references((): AnyPgColumn => holdings.id, { onDelete: "restrict" })
      .notNull(),
    companyId: foreignId("company_id")
      .references((): AnyPgColumn => companies.id, { onDelete: "restrict" })
      .notNull(),
    branchId: foreignId("branch_id").references(
      (): AnyPgColumn => branches.id,
      { onDelete: "set null" },
    ),
    businessUnitId: foreignId("business_unit_id").references(
      (): AnyPgColumn => businessUnits.id,
      { onDelete: "set null" },
    ),
    kpiId: foreignId("kpi_id").references(
      (): AnyPgColumn => kpiManagementKpis.id,
      { onDelete: "restrict" },
    ),
    decisionId: foreignId("decision_id").references(
      (): AnyPgColumn => managementDecisions.id,
      { onDelete: "set null" },
    ),
    period: varchar("period", { length: 10 }),
    triggerValue: numeric("trigger_value", {
      precision: 14,
      scale: 4,
      mode: "string",
    }),
    threshold: numeric("threshold", {
      precision: 14,
      scale: 4,
      mode: "string",
    }),
    description: varchar("description", { length: 2000 }).notNull(),
    suspectedCause: varchar("suspected_cause", { length: 2000 }),
    severity: varchar("severity", { length: 16 }).notNull(),
    ownerUserId: foreignId("owner_user_id").references(
      (): AnyPgColumn => users.id,
      { onDelete: "set null" },
    ),
    deadline: date("deadline", { mode: "string" }),
    status: varchar("status", { length: 24 })
      .$type<RedFlagStatus>()
      .notNull()
      .default("new"),
    source: varchar("source", { length: 24 }).notNull().default("manual"),
    actionId: foreignId("action_id"),
    closureEvidence: varchar("closure_evidence", { length: 2000 }),
    exceptionReason: varchar("exception_reason", { length: 1000 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    index("red_flags_holding_company_status_index").on(
      table.holdingId,
      table.companyId,
      table.status,
    ),
    index("red_flags_kpi_period_index").on(table.kpiId, table.period),
    index("red_flags_owner_deadline_index").on(
      table.ownerUserId,
      table.deadline,
    ),
  ],
);

export const redFlagRules = pgTable(
  "red_flag_rules",
  {
    id: id(),
    holdingId: foreignId("holding_id")
      .references((): AnyPgColumn => holdings.id, { onDelete: "cascade" })
      .notNull(),
    companyId: foreignId("company_id").references(
      (): AnyPgColumn => companies.id,
      { onDelete: "cascade" },
    ),
    businessUnitId: foreignId("business_unit_id").references(
      (): AnyPgColumn => businessUnits.id,
      { onDelete: "cascade" },
    ),
    kpiId: foreignId("kpi_id").references(
      (): AnyPgColumn => kpiManagementKpis.id,
      { onDelete: "cascade" },
    ),
    trigger: varchar("trigger", { length: 40 }).notNull(),
    configuration: json("configuration")
      .$type<JsonValue>()
      .notNull()
      .default(sql`'{}'::json`),
    severity: varchar("severity", { length: 16 }).notNull().default("high"),
    enabled: boolean("enabled").notNull().default(true),
    createdBy: foreignId("created_by").references((): AnyPgColumn => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("red_flag_rules_scope_enabled_index").on(
      table.holdingId,
      table.companyId,
      table.enabled,
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
    companyId: foreignId("company_id").references(
      (): AnyPgColumn => companies.id,
      { onDelete: "restrict" },
    ),
    businessUnitId: foreignId("business_unit_id").references(
      (): AnyPgColumn => businessUnits.id,
      { onDelete: "restrict" },
    ),
    departmentId: foreignId("department_id")
      .references((): AnyPgColumn => departments.id, { onDelete: "restrict" })
      .notNull(),
    alertId: foreignId("alert_id").references(
      (): AnyPgColumn => correctiveAlerts.id,
      { onDelete: "set null" },
    ),
    sourceKpiId: foreignId("source_kpi_id").references(
      (): AnyPgColumn => kpiManagementKpis.id,
      { onDelete: "set null" },
    ),
    sourceRedFlagId: foreignId("source_red_flag_id").references(
      (): AnyPgColumn => redFlags.id,
      { onDelete: "set null" },
    ),
    sourceDecisionId: foreignId("source_decision_id").references(
      (): AnyPgColumn => managementDecisions.id,
      { onDelete: "set null" },
    ),
    title: varchar("title", { length: 240 }).notNull(),
    description: varchar("description", { length: 2000 }).notNull().default(""),
    successMetric: varchar("success_metric", { length: 240 })
      .notNull()
      .default(""),
    baseline: numeric("baseline", { precision: 14, scale: 4, mode: "string" }),
    target: numeric("target", { precision: 14, scale: 4, mode: "string" }),
    ownerUserId: foreignId("owner_user_id")
      .references((): AnyPgColumn => users.id, { onDelete: "restrict" })
      .notNull(),
    approverUserId: foreignId("approver_user_id").references(
      (): AnyPgColumn => users.id,
      { onDelete: "set null" },
    ),
    createdBy: foreignId("created_by")
      .references((): AnyPgColumn => users.id, { onDelete: "restrict" })
      .notNull(),
    status: varchar("status", { length: 40 }).$type<ActionStatus>().notNull(),
    progress: integer("progress").notNull().default(0),
    blockerReason: text("blocker_reason"),
    delayReason: text("delay_reason"),
    priority: varchar("priority", { length: 80 }).notNull(),
    dueAt: timestamp("due_at", { withTimezone: true, mode: "date" }),
    evaluationDueAt: date("evaluation_due_at", { mode: "string" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("corrective_actions_company_business_unit_index").on(
      table.companyId,
      table.businessUnitId,
    ),
    index("corrective_actions_source_red_flag_index").on(table.sourceRedFlagId),
    index("corrective_actions_source_decision_index").on(table.sourceDecisionId),
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

export const correctiveActionEvidence = pgTable(
  "corrective_action_evidence",
  {
    id: id(),
    actionId: foreignId("action_id")
      .references((): AnyPgColumn => correctiveActions.id, {
        onDelete: "restrict",
      })
      .notNull(),
    uploadedBy: foreignId("uploaded_by")
      .references((): AnyPgColumn => users.id, { onDelete: "restrict" })
      .notNull(),
    storageKey: varchar("storage_key", { length: 500 }).notNull(),
    originalFileName: varchar("original_file_name", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    fileSize: integer("file_size").notNull(),
    note: varchar("note", { length: 1000 }),
    createdAt: createdAt(),
  },
  (table) => [
    index("corrective_action_evidence_action_created_index").on(
      table.actionId,
      table.createdAt,
    ),
    index("corrective_action_evidence_uploader_index").on(table.uploadedBy),
  ],
);

export const managementDecisionActions = pgTable(
  "management_decision_actions",
  {
    id: id(),
    decisionId: foreignId("decision_id")
      .references((): AnyPgColumn => managementDecisions.id, {
        onDelete: "cascade",
      })
      .notNull(),
    actionId: foreignId("action_id")
      .references((): AnyPgColumn => correctiveActions.id, {
        onDelete: "restrict",
      })
      .notNull(),
    createdBy: foreignId("created_by").references((): AnyPgColumn => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("management_decision_actions_pair_unique").on(
      table.decisionId,
      table.actionId,
    ),
    index("management_decision_actions_action_index").on(table.actionId),
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

export const aiConversations = pgTable(
  "ai_conversations",
  {
    id: id(),
    holdingId: foreignId("holding_id")
      .references((): AnyPgColumn => holdings.id, { onDelete: "restrict" })
      .notNull(),
    companyId: foreignId("company_id")
      .references((): AnyPgColumn => companies.id, { onDelete: "restrict" })
      .notNull(),
    ownerUserId: foreignId("owner_user_id")
      .references((): AnyPgColumn => users.id, { onDelete: "cascade" })
      .notNull(),
    title: varchar("title", { length: 240 }).notNull().default(""),
    model: varchar("model", { length: 120 }).notNull().default(""),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("ai_conversations_owner_updated_index").on(
      table.ownerUserId,
      table.updatedAt,
    ),
    index("ai_conversations_tenant_updated_index").on(
      table.holdingId,
      table.companyId,
      table.updatedAt,
    ),
  ],
);

export const aiMessages = pgTable(
  "ai_messages",
  {
    id: id(),
    conversationId: foreignId("conversation_id")
      .references((): AnyPgColumn => aiConversations.id, { onDelete: "cascade" })
      .notNull(),
    role: varchar("role", { length: 16 }).notNull(),
    content: text("content").notNull(),
    toolCalls: json("tool_calls").$type<JsonValue>().notNull().default([]),
    sourceReferences: json("source_references")
      .$type<JsonValue>()
      .notNull()
      .default([]),
    metadata: json("metadata").$type<JsonValue>().notNull().default({}),
    createdAt: createdAt(),
  },
  (table) => [
    index("ai_messages_conversation_created_index").on(
      table.conversationId,
      table.createdAt,
    ),
  ],
);

export const aiRecommendations = pgTable(
  "ai_recommendations",
  {
    id: id(),
    conversationId: foreignId("conversation_id")
      .references((): AnyPgColumn => aiConversations.id, { onDelete: "cascade" })
      .notNull(),
    messageId: foreignId("message_id")
      .references((): AnyPgColumn => aiMessages.id, { onDelete: "cascade" })
      .notNull(),
    recommendationKey: varchar("recommendation_key", { length: 80 }).notNull(),
    details: json("details").$type<JsonValue>().notNull(),
    status: varchar("status", { length: 16 }).notNull().default("pending"),
    reviewedBy: foreignId("reviewed_by").references(
      (): AnyPgColumn => users.id,
      { onDelete: "set null" },
    ),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "date" }),
    actionId: foreignId("action_id").references(
      (): AnyPgColumn => correctiveActions.id,
      { onDelete: "set null" },
    ),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("ai_recommendations_message_key_unique").on(
      table.messageId,
      table.recommendationKey,
    ),
    check(
      "ai_recommendations_status_check",
      sql`${table.status} in ('pending', 'processing', 'accepted', 'rejected')`,
    ),
    index("ai_recommendations_conversation_status_index").on(
      table.conversationId,
      table.status,
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
export type Holding = InferSelectModel<typeof holdings>;
export type NewHolding = InferInsertModel<typeof holdings>;
export type Company = InferSelectModel<typeof companies>;
export type NewCompany = InferInsertModel<typeof companies>;
export type Branch = InferSelectModel<typeof branches>;
export type NewBranch = InferInsertModel<typeof branches>;
export type BusinessUnit = InferSelectModel<typeof businessUnits>;
export type NewBusinessUnit = InferInsertModel<typeof businessUnits>;
export type RoleRecord = InferSelectModel<typeof roles>;
export type NewRoleRecord = InferInsertModel<typeof roles>;
export type PermissionRecord = InferSelectModel<typeof permissions>;
export type NewPermissionRecord = InferInsertModel<typeof permissions>;
export type Membership = InferSelectModel<typeof memberships>;
export type NewMembership = InferInsertModel<typeof memberships>;
export type MembershipRole = InferSelectModel<typeof membershipRoles>;
export type NewMembershipRole = InferInsertModel<typeof membershipRoles>;
export type Invitation = InferSelectModel<typeof invitations>;
export type NewInvitation = InferInsertModel<typeof invitations>;
export type AuthSession = InferSelectModel<typeof authSessions>;
export type NewAuthSession = InferInsertModel<typeof authSessions>;
export type RefreshToken = InferSelectModel<typeof refreshTokens>;
export type NewRefreshToken = InferInsertModel<typeof refreshTokens>;
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
export type KpiImportRun = InferSelectModel<typeof kpiImportRuns>;
export type NewKpiImportRun = InferInsertModel<typeof kpiImportRuns>;
export type KpiImportRecord = InferSelectModel<typeof kpiImportRecords>;
export type NewKpiImportRecord = InferInsertModel<typeof kpiImportRecords>;
export type KpiStudioOption = InferSelectModel<typeof kpiStudioOptions>;
export type NewKpiStudioOption = InferInsertModel<typeof kpiStudioOptions>;
export type CorrectiveAlert = InferSelectModel<typeof correctiveAlerts>;
export type NewCorrectiveAlert = InferInsertModel<typeof correctiveAlerts>;
export type ActionPriority = InferSelectModel<typeof actionPriorities>;
export type NewActionPriority = InferInsertModel<typeof actionPriorities>;
export type CorrectiveAction = InferSelectModel<typeof correctiveActions>;
export type NewCorrectiveAction = InferInsertModel<typeof correctiveActions>;
export type Dashboard = InferSelectModel<typeof dashboards>;
export type NewDashboard = InferInsertModel<typeof dashboards>;
export type DashboardWidget = InferSelectModel<typeof dashboardWidgets>;
export type DerivedKpi = InferSelectModel<typeof derivedKpis>;
export type ManagementReviewMeeting = InferSelectModel<
  typeof managementReviewMeetings
>;
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
