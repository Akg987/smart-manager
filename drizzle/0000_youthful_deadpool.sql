CREATE TABLE "access_level_permissions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"access_level_id" bigint NOT NULL,
	"permission" varchar(100) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "access_levels" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"department_id" bigint,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "action_priorities" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	CONSTRAINT "action_priorities_position_unsigned_check" CHECK ("action_priorities"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint,
	"actor_name" varchar(150) NOT NULL,
	"action" varchar(64) NOT NULL,
	"subject_type" varchar(191),
	"subject_id" bigint,
	"description" varchar(500) NOT NULL,
	"context" json,
	"ip_address" varchar(45),
	"user_agent" varchar(500),
	"created_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "cache" (
	"key" varchar(255) PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"expiration" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cache_locks" (
	"key" varchar(255) PRIMARY KEY NOT NULL,
	"owner" varchar(255) NOT NULL,
	"expiration" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "corrective_actions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"department_id" bigint NOT NULL,
	"alert_id" bigint,
	"title" varchar(240) NOT NULL,
	"description" varchar(2000) DEFAULT '' NOT NULL,
	"success_metric" varchar(240) DEFAULT '' NOT NULL,
	"owner_user_id" bigint NOT NULL,
	"created_by" bigint NOT NULL,
	"status" varchar(16) NOT NULL,
	"priority" varchar(80) NOT NULL,
	"due_at" timestamp with time zone,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "corrective_alerts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"department_id" bigint,
	"kpi_id" bigint,
	"period" varchar(10),
	"title" varchar(240) NOT NULL,
	"description" varchar(2000) DEFAULT '' NOT NULL,
	"severity" varchar(16) NOT NULL,
	"status" varchar(16) NOT NULL,
	"assigned_to" bigint,
	"acknowledged_at" timestamp with time zone,
	"acknowledged_by" bigint,
	"resolved_at" timestamp with time zone,
	"resolved_by" bigint,
	"resolution_note" varchar(1000) DEFAULT '' NOT NULL,
	"due_at" timestamp with time zone,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"code" varchar(32) NOT NULL,
	"manager_user_id" bigint,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "failed_jobs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"uuid" varchar(255) NOT NULL,
	"connection" text NOT NULL,
	"queue" text NOT NULL,
	"payload" text NOT NULL,
	"exception" text NOT NULL,
	"failed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inbox_notifications" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"type" varchar(20) NOT NULL,
	"title" varchar(160) NOT NULL,
	"body" varchar(500) DEFAULT '' NOT NULL,
	"href" varchar(255) DEFAULT '' NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "job_batches" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"total_jobs" integer NOT NULL,
	"pending_jobs" integer NOT NULL,
	"failed_jobs" integer NOT NULL,
	"failed_job_ids" text NOT NULL,
	"options" text,
	"cancelled_at" integer,
	"created_at" integer NOT NULL,
	"finished_at" integer
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"queue" varchar(255) NOT NULL,
	"payload" text NOT NULL,
	"attempts" smallint NOT NULL,
	"reserved_at" bigint,
	"available_at" bigint NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "jobs_attempts_unsigned_check" CHECK ("jobs"."attempts" >= 0 AND "jobs"."attempts" <= 255),
	CONSTRAINT "jobs_reserved_at_unsigned_check" CHECK ("jobs"."reserved_at" >= 0),
	CONSTRAINT "jobs_available_at_unsigned_check" CHECK ("jobs"."available_at" >= 0),
	CONSTRAINT "jobs_created_at_unsigned_check" CHECK ("jobs"."created_at" >= 0)
);
--> statement-breakpoint
CREATE TABLE "kpi_management_checkins" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"kpi_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	"period" varchar(10) NOT NULL,
	"status" varchar(16) NOT NULL,
	"data_json" json NOT NULL,
	"actual_value" numeric(14, 4),
	"note" varchar(500) DEFAULT '' NOT NULL,
	"blockers" varchar(500) DEFAULT '' NOT NULL,
	"submitted_at" timestamp with time zone,
	"revised_at" timestamp with time zone,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "kpi_management_kpis" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"department_id" bigint NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" varchar(3000) DEFAULT '' NOT NULL,
	"category" varchar(100) DEFAULT 'عملکرد' NOT NULL,
	"unit" varchar(80) DEFAULT 'عدد' NOT NULL,
	"direction" varchar(10) NOT NULL,
	"target_value" numeric(14, 4) NOT NULL,
	"warning_value" numeric(14, 4),
	"critical_value" numeric(14, 4),
	"owner_user_id" bigint,
	"frequency" varchar(50) DEFAULT 'هفتگی' NOT NULL,
	"input_mode" varchar(64) DEFAULT 'direct' NOT NULL,
	"reporter_user_id" bigint,
	"input_fields" json NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"weight" numeric(5, 2) DEFAULT '1.00' NOT NULL,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "kpi_management_values" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"kpi_id" bigint NOT NULL,
	"period" varchar(10) NOT NULL,
	"actual_value" numeric(14, 4),
	"target_value" numeric(14, 4) NOT NULL,
	"status" varchar(16) NOT NULL,
	"source" varchar(32) DEFAULT 'checkin' NOT NULL,
	"submitted_by" bigint,
	"note" varchar(500) DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "kpi_studio_options" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"group" varchar(32) NOT NULL,
	"name" varchar(80) NOT NULL,
	"slug" varchar(64) NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	CONSTRAINT "kpi_studio_options_position_unsigned_check" CHECK ("kpi_studio_options"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "migrations" (
	"id" integer PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY (sequence name "migrations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"migration" varchar(255) NOT NULL,
	"batch" integer NOT NULL,
	CONSTRAINT "migrations_id_unsigned_check" CHECK ("migrations"."id" >= 0)
);
--> statement-breakpoint
CREATE TABLE "modules" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"slug" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"version" varchar(20) NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"settings" json,
	"activated_at" timestamp with time zone,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "otp_challenges" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"purpose" varchar(40) NOT NULL,
	"identifier" varchar(64) NOT NULL,
	"code_hash" varchar(255) NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"sent_at" timestamp NOT NULL,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "otp_challenges_attempts_unsigned_check" CHECK ("otp_challenges"."attempts" >= 0 AND "otp_challenges"."attempts" <= 255)
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"mobile" varchar(11) PRIMARY KEY NOT NULL,
	"token" varchar(255) NOT NULL,
	"created_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"role" varchar(20) NOT NULL,
	"permission" varchar(100) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" bigint,
	"ip_address" varchar(45),
	"user_agent" text,
	"payload" text NOT NULL,
	"last_activity" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"company_name" varchar(120) DEFAULT '' NOT NULL,
	"logo_path" varchar(255),
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sms_ippanel_credit_alerts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"threshold" varchar(32) NOT NULL,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sms_ippanel_send_counters" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"sent_on" date NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	CONSTRAINT "sms_ippanel_send_counters_sent_count_unsigned_check" CHECK ("sms_ippanel_send_counters"."sent_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sms_ippanel_settings" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"apikey" text,
	"sender" varchar(32),
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"first_name" varchar(100),
	"last_name" varchar(100),
	"mobile" varchar(11) NOT NULL,
	"national_code" varchar(10),
	"birth_date" date,
	"address" text,
	"avatar_path" varchar(180),
	"password" varchar(255) NOT NULL,
	"role" varchar(20) DEFAULT 'user' NOT NULL,
	"access_level_id" bigint,
	"department_id" bigint,
	"job_title" varchar(120),
	"approved_at" timestamp with time zone,
	"approved_by" bigint,
	"remember_token" varchar(100),
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "access_level_permissions" ADD CONSTRAINT "access_level_permissions_access_level_id_access_levels_id_fk" FOREIGN KEY ("access_level_id") REFERENCES "public"."access_levels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_levels" ADD CONSTRAINT "access_levels_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corrective_actions" ADD CONSTRAINT "corrective_actions_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corrective_actions" ADD CONSTRAINT "corrective_actions_alert_id_corrective_alerts_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."corrective_alerts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corrective_actions" ADD CONSTRAINT "corrective_actions_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corrective_actions" ADD CONSTRAINT "corrective_actions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corrective_alerts" ADD CONSTRAINT "corrective_alerts_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corrective_alerts" ADD CONSTRAINT "corrective_alerts_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corrective_alerts" ADD CONSTRAINT "corrective_alerts_acknowledged_by_users_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corrective_alerts" ADD CONSTRAINT "corrective_alerts_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_manager_user_id_users_id_fk" FOREIGN KEY ("manager_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_notifications" ADD CONSTRAINT "inbox_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_management_checkins" ADD CONSTRAINT "kpi_management_checkins_kpi_id_kpi_management_kpis_id_fk" FOREIGN KEY ("kpi_id") REFERENCES "public"."kpi_management_kpis"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_management_checkins" ADD CONSTRAINT "kpi_management_checkins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_management_kpis" ADD CONSTRAINT "kpi_management_kpis_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_management_kpis" ADD CONSTRAINT "kpi_management_kpis_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_management_kpis" ADD CONSTRAINT "kpi_management_kpis_reporter_user_id_users_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_management_values" ADD CONSTRAINT "kpi_management_values_kpi_id_kpi_management_kpis_id_fk" FOREIGN KEY ("kpi_id") REFERENCES "public"."kpi_management_kpis"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_management_values" ADD CONSTRAINT "kpi_management_values_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_ippanel_credit_alerts" ADD CONSTRAINT "sms_ippanel_credit_alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_access_level_id_access_levels_id_fk" FOREIGN KEY ("access_level_id") REFERENCES "public"."access_levels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "access_level_permissions_access_level_id_permission_unique" ON "access_level_permissions" USING btree ("access_level_id","permission");--> statement-breakpoint
CREATE INDEX "access_level_permissions_permission_index" ON "access_level_permissions" USING btree ("permission");--> statement-breakpoint
CREATE UNIQUE INDEX "access_levels_name_unique" ON "access_levels" USING btree ("name");--> statement-breakpoint
CREATE INDEX "access_levels_department_id_index" ON "access_levels" USING btree ("department_id");--> statement-breakpoint
CREATE UNIQUE INDEX "action_priorities_name_unique" ON "action_priorities" USING btree ("name");--> statement-breakpoint
CREATE INDEX "audit_logs_user_id_index" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_index" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_index" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_subject_type_subject_id_index" ON "audit_logs" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "cache_expiration_index" ON "cache" USING btree ("expiration");--> statement-breakpoint
CREATE INDEX "cache_locks_expiration_index" ON "cache_locks" USING btree ("expiration");--> statement-breakpoint
CREATE INDEX "corrective_actions_alert_id_foreign" ON "corrective_actions" USING btree ("alert_id");--> statement-breakpoint
CREATE INDEX "corrective_actions_created_by_foreign" ON "corrective_actions" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "corrective_actions_department_id_status_index" ON "corrective_actions" USING btree ("department_id","status");--> statement-breakpoint
CREATE INDEX "corrective_actions_owner_user_id_status_index" ON "corrective_actions" USING btree ("owner_user_id","status");--> statement-breakpoint
CREATE INDEX "corrective_alerts_assigned_to_foreign" ON "corrective_alerts" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "corrective_alerts_acknowledged_by_foreign" ON "corrective_alerts" USING btree ("acknowledged_by");--> statement-breakpoint
CREATE INDEX "corrective_alerts_resolved_by_foreign" ON "corrective_alerts" USING btree ("resolved_by");--> statement-breakpoint
CREATE INDEX "corrective_alerts_department_id_status_index" ON "corrective_alerts" USING btree ("department_id","status");--> statement-breakpoint
CREATE INDEX "corrective_alerts_kpi_id_period_status_index" ON "corrective_alerts" USING btree ("kpi_id","period","status");--> statement-breakpoint
CREATE UNIQUE INDEX "departments_code_unique" ON "departments" USING btree ("code");--> statement-breakpoint
CREATE INDEX "departments_manager_user_id_foreign" ON "departments" USING btree ("manager_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "failed_jobs_uuid_unique" ON "failed_jobs" USING btree ("uuid");--> statement-breakpoint
CREATE INDEX "inbox_notifications_user_id_read_at_index" ON "inbox_notifications" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "inbox_notifications_user_id_created_at_index" ON "inbox_notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "jobs_queue_index" ON "jobs" USING btree ("queue");--> statement-breakpoint
CREATE INDEX "kpi_management_checkins_kpi_id_period_index" ON "kpi_management_checkins" USING btree ("kpi_id","period");--> statement-breakpoint
CREATE INDEX "kpi_management_checkins_user_id_period_index" ON "kpi_management_checkins" USING btree ("user_id","period");--> statement-breakpoint
CREATE UNIQUE INDEX "kpi_management_kpis_code_unique" ON "kpi_management_kpis" USING btree ("code");--> statement-breakpoint
CREATE INDEX "kpi_management_kpis_owner_user_id_foreign" ON "kpi_management_kpis" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "kpi_management_kpis_department_id_active_index" ON "kpi_management_kpis" USING btree ("department_id","active");--> statement-breakpoint
CREATE INDEX "kpi_management_kpis_reporter_user_id_foreign" ON "kpi_management_kpis" USING btree ("reporter_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "kpi_management_values_kpi_id_period_unique" ON "kpi_management_values" USING btree ("kpi_id","period");--> statement-breakpoint
CREATE INDEX "kpi_management_values_submitted_by_foreign" ON "kpi_management_values" USING btree ("submitted_by");--> statement-breakpoint
CREATE INDEX "kpi_management_values_period_index" ON "kpi_management_values" USING btree ("period");--> statement-breakpoint
CREATE UNIQUE INDEX "kpi_studio_options_group_name_unique" ON "kpi_studio_options" USING btree ("group","name");--> statement-breakpoint
CREATE UNIQUE INDEX "kpi_studio_options_group_slug_unique" ON "kpi_studio_options" USING btree ("group","slug");--> statement-breakpoint
CREATE INDEX "kpi_studio_options_group_position_index" ON "kpi_studio_options" USING btree ("group","position");--> statement-breakpoint
CREATE UNIQUE INDEX "modules_slug_unique" ON "modules" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "modules_is_active_index" ON "modules" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "otp_challenges_purpose_identifier_unique" ON "otp_challenges" USING btree ("purpose","identifier");--> statement-breakpoint
CREATE INDEX "otp_challenges_expires_at_index" ON "otp_challenges" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "role_permissions_role_permission_unique" ON "role_permissions" USING btree ("role","permission");--> statement-breakpoint
CREATE INDEX "role_permissions_role_index" ON "role_permissions" USING btree ("role");--> statement-breakpoint
CREATE INDEX "sessions_user_id_index" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_last_activity_index" ON "sessions" USING btree ("last_activity");--> statement-breakpoint
CREATE UNIQUE INDEX "sms_ippanel_credit_alerts_user_id_unique" ON "sms_ippanel_credit_alerts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sms_ippanel_send_counters_sent_on_unique" ON "sms_ippanel_send_counters" USING btree ("sent_on");--> statement-breakpoint
CREATE UNIQUE INDEX "users_mobile_unique" ON "users" USING btree ("mobile");--> statement-breakpoint
CREATE UNIQUE INDEX "users_national_code_unique" ON "users" USING btree ("national_code");--> statement-breakpoint
CREATE INDEX "users_role_index" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "users_approved_by_foreign" ON "users" USING btree ("approved_by");--> statement-breakpoint
CREATE INDEX "users_department_id_foreign" ON "users" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "users_access_level_id_foreign" ON "users" USING btree ("access_level_id");--> statement-breakpoint
INSERT INTO "action_priorities" ("name", "position", "created_at", "updated_at") VALUES
	('کم', 1, now(), now()),
	('متوسط', 2, now(), now()),
	('زیاد', 3, now(), now()),
	('فوری', 4, now(), now());--> statement-breakpoint
INSERT INTO "kpi_studio_options" ("group", "name", "slug", "position", "created_at", "updated_at") VALUES
	('input_mode', 'مقدار مستقیم', 'direct', 1, now(), now()),
	('input_mode', 'اجزای فرمول', 'components', 2, now(), now()),
	('input_mode', 'چک‌لیست', 'checklist', 3, now(), now()),
	('direction', 'بیشتر بهتر', 'higher', 1, now(), now()),
	('direction', 'کمتر بهتر', 'lower', 2, now(), now()),
	('direction', 'بازه مطلوب', 'range', 3, now(), now()),
	('frequency', 'هفتگی', 'weekly', 1, now(), now()),
	('frequency', 'روزانه', 'daily', 2, now(), now()),
	('frequency', 'ماهانه', 'monthly', 3, now(), now());
