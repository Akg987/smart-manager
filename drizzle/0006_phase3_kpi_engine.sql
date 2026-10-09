-- Additive Phase 3 storage. Existing KPI values are intentionally left untouched.
ALTER TABLE "kpi_management_kpis"
  ADD COLUMN "domain" varchar(80),
  ADD COLUMN "input_options" json DEFAULT '[]'::json NOT NULL,
  ADD COLUMN "formula_config" json,
  ADD COLUMN "range_config" json;
--> statement-breakpoint
ALTER TABLE "kpi_management_values"
  ADD COLUMN "company_id" bigint REFERENCES "companies"("id") ON DELETE RESTRICT,
  ADD COLUMN "branch_id" bigint REFERENCES "branches"("id") ON DELETE SET NULL,
  ADD COLUMN "business_unit_id" bigint REFERENCES "business_units"("id") ON DELETE SET NULL,
  ADD COLUMN "raw_value" json,
  ADD COLUMN "unit" varchar(80) DEFAULT '' NOT NULL,
  ADD COLUMN "approved_at" timestamp with time zone,
  ADD COLUMN "is_current" boolean DEFAULT false NOT NULL;
CREATE UNIQUE INDEX "kpi_management_values_one_current_period_unique"
  ON "kpi_management_values" ("kpi_id", "period") WHERE "is_current" = true;
--> statement-breakpoint
CREATE TABLE "red_flag_rules" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "holding_id" bigint NOT NULL REFERENCES "holdings"("id") ON DELETE CASCADE,
  "company_id" bigint REFERENCES "companies"("id") ON DELETE CASCADE,
  "business_unit_id" bigint REFERENCES "business_units"("id") ON DELETE CASCADE,
  "kpi_id" bigint REFERENCES "kpi_management_kpis"("id") ON DELETE CASCADE,
  "trigger" varchar(40) NOT NULL,
  "configuration" json DEFAULT '{}'::json NOT NULL,
  "severity" varchar(16) DEFAULT 'high' NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "created_by" bigint REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);
CREATE INDEX "red_flag_rules_scope_enabled_index"
  ON "red_flag_rules" ("holding_id", "company_id", "enabled");
--> statement-breakpoint
INSERT INTO "permissions" ("key", "resource", "action", "description", "is_system") VALUES
 ('redflag.view','redflag','view','View red flags',true),
 ('redflag.create','redflag','create','Create red flags',true),
 ('redflag.update','redflag','update','Update red flags',true),
 ('redflag.resolve','redflag','resolve','Resolve or close red flags',true)
ON CONFLICT ("key") DO NOTHING;
