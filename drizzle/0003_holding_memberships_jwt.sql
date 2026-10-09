CREATE TABLE "holdings" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"code" varchar(48) NOT NULL,
	"status" varchar(24) DEFAULT 'active' NOT NULL,
	"logo" varchar(255),
	"calendar" varchar(32) DEFAULT 'jalali' NOT NULL,
	"timezone" varchar(64) DEFAULT 'Asia/Tehran' NOT NULL,
	"currency" varchar(8) DEFAULT 'IRR' NOT NULL,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "holdings_code_unique" ON "holdings" USING btree ("code");
--> statement-breakpoint
CREATE INDEX "holdings_status_index" ON "holdings" USING btree ("status");
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"holding_id" bigint NOT NULL,
	"name" varchar(160) NOT NULL,
	"code" varchar(48) NOT NULL,
	"legal_name" varchar(200),
	"ceo_user_id" bigint,
	"pnl_owner_user_id" bigint,
	"data_owner_user_id" bigint,
	"pmo_reviewer_user_id" bigint,
	"status" varchar(24) DEFAULT 'active' NOT NULL,
	"calendar" varchar(32) DEFAULT 'jalali' NOT NULL,
	"currency" varchar(8) DEFAULT 'IRR' NOT NULL,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	CONSTRAINT "companies_holding_id_holdings_id_fk" FOREIGN KEY ("holding_id") REFERENCES "holdings"("id") ON DELETE restrict,
	CONSTRAINT "companies_ceo_user_id_users_id_fk" FOREIGN KEY ("ceo_user_id") REFERENCES "users"("id") ON DELETE set null,
	CONSTRAINT "companies_pnl_owner_user_id_users_id_fk" FOREIGN KEY ("pnl_owner_user_id") REFERENCES "users"("id") ON DELETE set null,
	CONSTRAINT "companies_data_owner_user_id_users_id_fk" FOREIGN KEY ("data_owner_user_id") REFERENCES "users"("id") ON DELETE set null,
	CONSTRAINT "companies_pmo_reviewer_user_id_users_id_fk" FOREIGN KEY ("pmo_reviewer_user_id") REFERENCES "users"("id") ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX "companies_holding_id_code_unique" ON "companies" USING btree ("holding_id", "code");
--> statement-breakpoint
CREATE INDEX "companies_holding_id_status_index" ON "companies" USING btree ("holding_id", "status");
--> statement-breakpoint
CREATE INDEX "companies_ceo_user_id_index" ON "companies" USING btree ("ceo_user_id");
--> statement-breakpoint
CREATE TABLE "branches" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"company_id" bigint NOT NULL,
	"name" varchar(160) NOT NULL,
	"code" varchar(48) NOT NULL,
	"manager_user_id" bigint,
	"status" varchar(24) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	CONSTRAINT "branches_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade,
	CONSTRAINT "branches_manager_user_id_users_id_fk" FOREIGN KEY ("manager_user_id") REFERENCES "users"("id") ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX "branches_company_id_code_unique" ON "branches" USING btree ("company_id", "code");
--> statement-breakpoint
CREATE INDEX "branches_company_id_status_index" ON "branches" USING btree ("company_id", "status");
--> statement-breakpoint
CREATE TABLE "business_units" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"company_id" bigint NOT NULL,
	"branch_id" bigint,
	"legacy_department_id" bigint,
	"name" varchar(160) NOT NULL,
	"code" varchar(48) NOT NULL,
	"manager_user_id" bigint,
	"domain" varchar(64) DEFAULT 'general' NOT NULL,
	"status" varchar(24) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	CONSTRAINT "business_units_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade,
	CONSTRAINT "business_units_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE set null,
	CONSTRAINT "business_units_legacy_department_id_departments_id_fk" FOREIGN KEY ("legacy_department_id") REFERENCES "departments"("id") ON DELETE set null,
	CONSTRAINT "business_units_manager_user_id_users_id_fk" FOREIGN KEY ("manager_user_id") REFERENCES "users"("id") ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX "business_units_company_id_code_unique" ON "business_units" USING btree ("company_id", "code");
--> statement-breakpoint
CREATE UNIQUE INDEX "business_units_legacy_department_id_unique" ON "business_units" USING btree ("legacy_department_id");
--> statement-breakpoint
CREATE INDEX "business_units_company_id_branch_id_index" ON "business_units" USING btree ("company_id", "branch_id");
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"holding_id" bigint,
	"key" varchar(64) NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" varchar(500),
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	CONSTRAINT "roles_holding_id_holdings_id_fk" FOREIGN KEY ("holding_id") REFERENCES "holdings"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX "roles_holding_id_key_unique" ON "roles" USING btree ("holding_id", "key");
--> statement-breakpoint
CREATE INDEX "roles_is_system_index" ON "roles" USING btree ("is_system");
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"key" varchar(120) NOT NULL,
	"resource" varchar(64) NOT NULL,
	"action" varchar(64) NOT NULL,
	"description" varchar(300),
	"is_system" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "permissions_key_unique" ON "permissions" USING btree ("key");
--> statement-breakpoint
CREATE UNIQUE INDEX "permissions_resource_action_unique" ON "permissions" USING btree ("resource", "action");
--> statement-breakpoint
ALTER TABLE "role_permissions" ALTER COLUMN "role" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "role_permissions" ALTER COLUMN "permission" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "role_permissions" ADD COLUMN "role_id" bigint;
--> statement-breakpoint
ALTER TABLE "role_permissions" ADD COLUMN "permission_id" bigint;
--> statement-breakpoint
ALTER TABLE "role_permissions" ADD COLUMN "scope_type" varchar(24);
--> statement-breakpoint
ALTER TABLE "role_permissions" ADD COLUMN "domain" varchar(64);
--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_unique" ON "role_permissions" USING btree ("role_id", "permission_id");
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"holding_id" bigint NOT NULL,
	"company_id" bigint,
	"branch_id" bigint,
	"business_unit_id" bigint,
	"role_id" bigint,
	"scope_type" varchar(24) DEFAULT 'company' NOT NULL,
	"status" varchar(24) DEFAULT 'active' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade,
	CONSTRAINT "memberships_holding_id_holdings_id_fk" FOREIGN KEY ("holding_id") REFERENCES "holdings"("id") ON DELETE cascade,
	CONSTRAINT "memberships_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade,
	CONSTRAINT "memberships_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE cascade,
	CONSTRAINT "memberships_business_unit_id_business_units_id_fk" FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE cascade,
	CONSTRAINT "memberships_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX "memberships_user_id_status_index" ON "memberships" USING btree ("user_id", "status");
--> statement-breakpoint
CREATE INDEX "memberships_holding_id_company_id_index" ON "memberships" USING btree ("holding_id", "company_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_user_org_scope_unique" ON "memberships" USING btree ("user_id", "holding_id", "company_id", "branch_id", "business_unit_id", "role_id");
--> statement-breakpoint
CREATE TABLE "membership_roles" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"membership_id" bigint NOT NULL,
	"role_id" bigint NOT NULL,
	"created_at" timestamp with time zone,
	CONSTRAINT "membership_roles_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE cascade,
	CONSTRAINT "membership_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX "membership_roles_membership_id_role_id_unique" ON "membership_roles" USING btree ("membership_id", "role_id");
--> statement-breakpoint
CREATE INDEX "membership_roles_role_id_index" ON "membership_roles" USING btree ("role_id");
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"holding_id" bigint NOT NULL,
	"company_id" bigint,
	"mobile" varchar(11) NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"role_id" bigint,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_by" bigint,
	"created_at" timestamp with time zone,
	CONSTRAINT "invitations_holding_id_holdings_id_fk" FOREIGN KEY ("holding_id") REFERENCES "holdings"("id") ON DELETE cascade,
	CONSTRAINT "invitations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade,
	CONSTRAINT "invitations_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE set null,
	CONSTRAINT "invitations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_token_hash_unique" ON "invitations" USING btree ("token_hash");
--> statement-breakpoint
CREATE INDEX "invitations_holding_id_mobile_index" ON "invitations" USING btree ("holding_id", "mobile");
--> statement-breakpoint
CREATE INDEX "invitations_expires_at_index" ON "invitations" USING btree ("expires_at");
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"membership_id" bigint NOT NULL,
	"active_company_id" bigint,
	"token_version" integer DEFAULT 1 NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_activity_at" timestamp with time zone,
	"created_at" timestamp with time zone,
	CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade,
	CONSTRAINT "auth_sessions_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE cascade,
	CONSTRAINT "auth_sessions_active_company_id_companies_id_fk" FOREIGN KEY ("active_company_id") REFERENCES "companies"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX "auth_sessions_user_id_revoked_at_index" ON "auth_sessions" USING btree ("user_id", "revoked_at");
--> statement-breakpoint
CREATE INDEX "auth_sessions_membership_id_index" ON "auth_sessions" USING btree ("membership_id");
--> statement-breakpoint
CREATE INDEX "auth_sessions_expires_at_index" ON "auth_sessions" USING btree ("expires_at");
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"session_id" varchar(36) NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"replaced_by_id" varchar(36),
	"created_at" timestamp with time zone,
	CONSTRAINT "refresh_tokens_session_id_auth_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "auth_sessions"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX "refresh_tokens_token_hash_unique" ON "refresh_tokens" USING btree ("token_hash");
--> statement-breakpoint
CREATE INDEX "refresh_tokens_session_id_revoked_at_index" ON "refresh_tokens" USING btree ("session_id", "revoked_at");
--> statement-breakpoint
CREATE INDEX "refresh_tokens_expires_at_index" ON "refresh_tokens" USING btree ("expires_at");
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "holding_id" bigint;
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "company_id" bigint;
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "membership_id" bigint;
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_holding_id_holdings_id_fk" FOREIGN KEY ("holding_id") REFERENCES "holdings"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE set null;
--> statement-breakpoint
CREATE INDEX "audit_logs_company_id_created_at_index" ON "audit_logs" USING btree ("company_id", "created_at");
