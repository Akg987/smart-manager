ALTER TABLE "corrective_actions"
  ADD COLUMN "baseline" numeric(14,4),
  ADD COLUMN "target" numeric(14,4);
--> statement-breakpoint
CREATE TABLE "dashboards" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "holding_id" bigint NOT NULL REFERENCES "holdings"("id") ON DELETE RESTRICT,
  "company_id" bigint REFERENCES "companies"("id") ON DELETE CASCADE,
  "business_unit_id" bigint REFERENCES "business_units"("id") ON DELETE CASCADE,
  "owner_user_id" bigint NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "role_key" varchar(80),
  "name" varchar(160) NOT NULL,
  "type" varchar(24) NOT NULL,
  "visibility" varchar(16) DEFAULT 'private' NOT NULL,
  "layout" json DEFAULT '[]'::json NOT NULL,
  "filters" json DEFAULT '{}'::json NOT NULL,
  "status" varchar(16) DEFAULT 'draft' NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "published_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "dashboards_type_check" CHECK ("type" IN ('holding','company','business_unit','role','personal')),
  CONSTRAINT "dashboards_visibility_check" CHECK ("visibility" IN ('private','role','company','holding')),
  CONSTRAINT "dashboards_status_check" CHECK ("status" IN ('draft','published','archived')),
  CONSTRAINT "dashboards_scope_check" CHECK (
    ("type" = 'holding' AND "company_id" IS NULL AND "business_unit_id" IS NULL) OR
    ("type" = 'company' AND "company_id" IS NOT NULL AND "business_unit_id" IS NULL) OR
    ("type" = 'business_unit' AND "company_id" IS NOT NULL AND "business_unit_id" IS NOT NULL) OR
    ("type" IN ('role','personal') AND "company_id" IS NOT NULL)
  )
);
CREATE INDEX "dashboards_holding_status_index" ON "dashboards" ("holding_id", "status");
CREATE INDEX "dashboards_company_status_index" ON "dashboards" ("company_id", "status");
CREATE INDEX "dashboards_owner_updated_index" ON "dashboards" ("owner_user_id", "updated_at");
--> statement-breakpoint
CREATE TABLE "dashboard_widgets" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "dashboard_id" bigint NOT NULL REFERENCES "dashboards"("id") ON DELETE CASCADE,
  "type" varchar(32) NOT NULL,
  "title" varchar(160) DEFAULT '' NOT NULL,
  "config" json DEFAULT '{}'::json NOT NULL,
  "position_x" integer DEFAULT 0 NOT NULL,
  "position_y" integer DEFAULT 0 NOT NULL,
  "width" integer DEFAULT 6 NOT NULL,
  "height" integer DEFAULT 4 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "dashboard_widgets_type_check" CHECK ("type" IN ('kpi_card','trend_chart','line_chart','bar_chart','comparison','progress','table','red_flag_list','action_list','decision_list','data_quality','company_scorecard')),
  CONSTRAINT "dashboard_widgets_position_check" CHECK ("position_x" >= 0 AND "position_y" >= 0 AND "width" BETWEEN 1 AND 12 AND "height" BETWEEN 1 AND 12)
);
CREATE INDEX "dashboard_widgets_dashboard_position_index" ON "dashboard_widgets" ("dashboard_id", "position_y", "position_x");
--> statement-breakpoint
CREATE TABLE "dashboard_versions" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "dashboard_id" bigint NOT NULL REFERENCES "dashboards"("id") ON DELETE RESTRICT,
  "version" integer NOT NULL,
  "definition" json NOT NULL,
  "created_by" bigint REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "dashboard_versions_dashboard_version_unique" UNIQUE ("dashboard_id", "version")
);
--> statement-breakpoint
CREATE TABLE "derived_kpis" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "holding_id" bigint NOT NULL REFERENCES "holdings"("id") ON DELETE RESTRICT,
  "company_id" bigint NOT NULL REFERENCES "companies"("id") ON DELETE RESTRICT,
  "business_unit_id" bigint REFERENCES "business_units"("id") ON DELETE SET NULL,
  "code" varchar(64) NOT NULL,
  "name" varchar(200) NOT NULL,
  "description" varchar(2000) DEFAULT '' NOT NULL,
  "source_kpis" json DEFAULT '[]'::json NOT NULL,
  "formula_ast" json NOT NULL,
  "formula_source" varchar(2000) NOT NULL,
  "formula_version" integer DEFAULT 1 NOT NULL,
  "unit" varchar(80) NOT NULL,
  "period_type" varchar(32) NOT NULL,
  "owner_user_id" bigint REFERENCES "users"("id") ON DELETE SET NULL,
  "target_value" numeric(14,4),
  "status" varchar(16) DEFAULT 'draft' NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "created_by" bigint REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "derived_kpis_status_check" CHECK ("status" IN ('draft','published','archived')),
  CONSTRAINT "derived_kpis_version_check" CHECK ("version" > 0 AND "formula_version" > 0)
);
CREATE UNIQUE INDEX "derived_kpis_company_code_unique" ON "derived_kpis" ("company_id", "code");
CREATE INDEX "derived_kpis_company_status_index" ON "derived_kpis" ("company_id", "status");
--> statement-breakpoint
CREATE TABLE "derived_kpi_versions" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "derived_kpi_id" bigint NOT NULL REFERENCES "derived_kpis"("id") ON DELETE RESTRICT,
  "version" integer NOT NULL,
  "formula_version" integer NOT NULL,
  "definition" json NOT NULL,
  "created_by" bigint REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "derived_kpi_versions_entity_version_unique" UNIQUE ("derived_kpi_id", "version")
);
--> statement-breakpoint
CREATE TABLE "derived_kpi_values" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "derived_kpi_id" bigint NOT NULL REFERENCES "derived_kpis"("id") ON DELETE RESTRICT,
  "company_id" bigint NOT NULL REFERENCES "companies"("id") ON DELETE RESTRICT,
  "business_unit_id" bigint REFERENCES "business_units"("id") ON DELETE SET NULL,
  "period" varchar(10) NOT NULL,
  "formula_version" integer NOT NULL,
  "actual_value" numeric(14,4) NOT NULL,
  "source_snapshot" json NOT NULL,
  "calculated_by" bigint REFERENCES "users"("id") ON DELETE SET NULL,
  "calculated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "derived_kpi_values_period_formula_version_unique" UNIQUE ("derived_kpi_id", "period", "formula_version")
);
CREATE INDEX "derived_kpi_values_company_period_index" ON "derived_kpi_values" ("company_id", "period");
--> statement-breakpoint
CREATE TABLE "management_review_meetings" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "holding_id" bigint NOT NULL REFERENCES "holdings"("id") ON DELETE RESTRICT,
  "company_id" bigint NOT NULL REFERENCES "companies"("id") ON DELETE RESTRICT,
  "business_unit_id" bigint REFERENCES "business_units"("id") ON DELETE SET NULL,
  "type" varchar(8) NOT NULL,
  "period" varchar(10) NOT NULL,
  "title" varchar(200) NOT NULL,
  "status" varchar(16) DEFAULT 'draft' NOT NULL,
  "scheduled_at" timestamp with time zone,
  "owner_user_id" bigint REFERENCES "users"("id") ON DELETE SET NULL,
  "sections" json DEFAULT '{}'::json NOT NULL,
  "snapshot" json DEFAULT '{}'::json NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "created_by" bigint REFERENCES "users"("id") ON DELETE SET NULL,
  "published_at" timestamp with time zone,
  "closed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "management_review_type_check" CHECK ("type" IN ('wbr','mbr')),
  CONSTRAINT "management_review_status_check" CHECK ("status" IN ('draft','published','closed'))
);
CREATE UNIQUE INDEX "management_review_scope_period_unique" ON "management_review_meetings" ("company_id", coalesce("business_unit_id", 0), "type", "period");
CREATE INDEX "management_review_company_status_period_index" ON "management_review_meetings" ("company_id", "status", "period");
--> statement-breakpoint
CREATE TABLE "management_escalation_rules" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "holding_id" bigint NOT NULL REFERENCES "holdings"("id") ON DELETE CASCADE,
  "company_id" bigint REFERENCES "companies"("id") ON DELETE CASCADE,
  "trigger" varchar(32) NOT NULL,
  "configuration" json DEFAULT '{}'::json NOT NULL,
  "escalation_levels" json NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "created_by" bigint REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "management_escalation_trigger_check" CHECK ("trigger" IN ('severity','amount','duration','delay','missing_data','no_response'))
);
CREATE INDEX "management_escalation_rules_scope_enabled_index" ON "management_escalation_rules" ("holding_id", "company_id", "enabled");
--> statement-breakpoint
CREATE TABLE "management_escalation_events" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "rule_id" bigint NOT NULL REFERENCES "management_escalation_rules"("id") ON DELETE CASCADE,
  "holding_id" bigint NOT NULL REFERENCES "holdings"("id") ON DELETE RESTRICT,
  "company_id" bigint NOT NULL REFERENCES "companies"("id") ON DELETE RESTRICT,
  "target_type" varchar(24) NOT NULL,
  "target_id" bigint NOT NULL,
  "level" integer NOT NULL,
  "recipient_user_id" bigint REFERENCES "users"("id") ON DELETE SET NULL,
  "recipient_role" varchar(80),
  "detail" json DEFAULT '{}'::json NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "management_escalation_events_level_check" CHECK ("level" > 0),
  CONSTRAINT "management_escalation_target_level_unique" UNIQUE ("rule_id", "target_type", "target_id", "level")
);
CREATE INDEX "management_escalation_company_created_index" ON "management_escalation_events" ("company_id", "created_at");
--> statement-breakpoint
CREATE TABLE "management_reminder_policies" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "holding_id" bigint NOT NULL REFERENCES "holdings"("id") ON DELETE CASCADE,
  "company_id" bigint REFERENCES "companies"("id") ON DELETE CASCADE,
  "item_type" varchar(24) NOT NULL,
  "offsets_minutes" json DEFAULT '[-1440,0,1440]'::json NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "created_by" bigint REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "management_reminder_item_type_check" CHECK ("item_type" IN ('action','decision'))
);
CREATE UNIQUE INDEX "management_reminder_scope_item_unique" ON "management_reminder_policies" ("holding_id", "company_id", "item_type");
--> statement-breakpoint
CREATE TABLE "management_reminders" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "policy_id" bigint REFERENCES "management_reminder_policies"("id") ON DELETE SET NULL,
  "holding_id" bigint NOT NULL REFERENCES "holdings"("id") ON DELETE RESTRICT,
  "company_id" bigint NOT NULL REFERENCES "companies"("id") ON DELETE RESTRICT,
  "target_type" varchar(24) NOT NULL,
  "target_id" bigint NOT NULL,
  "recipient_user_id" bigint NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "phase" varchar(16) NOT NULL,
  "scheduled_for" timestamp with time zone NOT NULL,
  "sent_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "management_reminders_phase_check" CHECK ("phase" IN ('before','on','after')),
  CONSTRAINT "management_reminders_target_check" CHECK ("target_type" IN ('action','decision'))
);
CREATE UNIQUE INDEX "management_reminders_idempotent_unique" ON "management_reminders" ("target_type", "target_id", "recipient_user_id", "phase", "scheduled_for");
CREATE INDEX "management_reminders_due_index" ON "management_reminders" ("sent_at", "scheduled_for");
--> statement-breakpoint
CREATE TABLE "management_decision_actions" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "decision_id" bigint NOT NULL REFERENCES "management_decisions"("id") ON DELETE CASCADE,
  "action_id" bigint NOT NULL REFERENCES "corrective_actions"("id") ON DELETE RESTRICT,
  "created_by" bigint REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "management_decision_actions_pair_unique" UNIQUE ("decision_id", "action_id")
);
CREATE INDEX "management_decision_actions_action_index" ON "management_decision_actions" ("action_id");
--> statement-breakpoint
INSERT INTO "management_decision_actions" ("decision_id", "action_id")
SELECT d."id", (legacy_action)::bigint
FROM "management_decisions" d
CROSS JOIN LATERAL json_array_elements_text(d."action_ids") AS legacy_action
JOIN "corrective_actions" a ON a."id" = (legacy_action)::bigint
JOIN "business_units" bu ON bu."legacy_department_id" = a."department_id" AND bu."company_id" = d."company_id"
WHERE d."business_unit_id" IS NULL OR d."business_unit_id" = bu."id"
ON CONFLICT ("decision_id", "action_id") DO NOTHING;
