DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "kpi_management_kpis")
     AND NOT EXISTS (SELECT 1 FROM "companies" WHERE "code" = 'smarlux') THEN
    RAISE EXCEPTION 'Cannot backfill KPI tenant scope: default Smarlux company is missing';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "kpi_management_kpis"
  DROP CONSTRAINT IF EXISTS "kpi_management_kpis_department_id_not_null";
ALTER TABLE "kpi_management_kpis"
  ALTER COLUMN "department_id" DROP NOT NULL,
  ADD COLUMN "holding_id" bigint,
  ADD COLUMN "company_id" bigint,
  ADD COLUMN "branch_id" bigint,
  ADD COLUMN "business_unit_id" bigint,
  ADD COLUMN "data_owner_user_id" bigint,
  ADD COLUMN "reviewer_user_id" bigint,
  ADD COLUMN "source" varchar(160) DEFAULT 'manual' NOT NULL,
  ADD COLUMN "formula_type" varchar(48) DEFAULT 'direct' NOT NULL,
  ADD COLUMN "reporting_period" varchar(32) DEFAULT 'monthly' NOT NULL,
  ADD COLUMN "submission_deadline" date,
  ADD COLUMN "version" integer DEFAULT 1 NOT NULL,
  ADD COLUMN "effective_from" date DEFAULT CURRENT_DATE NOT NULL,
  ADD COLUMN "status" varchar(16) DEFAULT 'published' NOT NULL;
--> statement-breakpoint
UPDATE "kpi_management_kpis" AS k
SET "company_id" = company.id,
    "holding_id" = company.holding_id
FROM (SELECT id, holding_id FROM "companies" WHERE code = 'smarlux' ORDER BY id LIMIT 1) AS company
WHERE k.company_id IS NULL;
--> statement-breakpoint
ALTER TABLE "kpi_management_kpis"
  ADD CONSTRAINT "kpi_management_kpis_holding_id_holdings_id_fk"
    FOREIGN KEY ("holding_id") REFERENCES "holdings"("id") ON DELETE RESTRICT,
  ADD CONSTRAINT "kpi_management_kpis_company_id_companies_id_fk"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT,
  ADD CONSTRAINT "kpi_management_kpis_branch_id_branches_id_fk"
    FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL,
  ADD CONSTRAINT "kpi_management_kpis_business_unit_id_business_units_id_fk"
    FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE SET NULL,
  ADD CONSTRAINT "kpi_management_kpis_data_owner_user_id_users_id_fk"
    FOREIGN KEY ("data_owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL,
  ADD CONSTRAINT "kpi_management_kpis_reviewer_user_id_users_id_fk"
    FOREIGN KEY ("reviewer_user_id") REFERENCES "users"("id") ON DELETE SET NULL,
  ADD CONSTRAINT "kpi_management_kpis_scope_consistency_check"
    CHECK (("branch_id" IS NULL OR "company_id" IS NOT NULL) AND ("business_unit_id" IS NULL OR "company_id" IS NOT NULL));
--> statement-breakpoint
ALTER TABLE "kpi_management_kpis" ALTER COLUMN "holding_id" SET NOT NULL;
ALTER TABLE "kpi_management_kpis" ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "kpi_management_kpis" ALTER COLUMN "status" SET DEFAULT 'draft';
--> statement-breakpoint
DROP INDEX IF EXISTS "kpi_management_kpis_code_unique";
CREATE UNIQUE INDEX "kpi_management_kpis_company_code_unique"
  ON "kpi_management_kpis" USING btree ("company_id", "code");
CREATE INDEX "kpi_management_kpis_company_status_index"
  ON "kpi_management_kpis" USING btree ("company_id", "status");
CREATE INDEX "kpi_management_kpis_business_unit_index"
  ON "kpi_management_kpis" USING btree ("business_unit_id");
--> statement-breakpoint
CREATE TABLE "kpi_management_kpi_versions" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "kpi_id" bigint NOT NULL REFERENCES "kpi_management_kpis"("id") ON DELETE RESTRICT,
  "version" integer NOT NULL,
  "definition" json NOT NULL,
  "effective_from" date NOT NULL,
  "created_by" bigint REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now()
);
CREATE UNIQUE INDEX "kpi_management_kpi_versions_kpi_version_unique"
  ON "kpi_management_kpi_versions" USING btree ("kpi_id", "version");
CREATE INDEX "kpi_management_kpi_versions_effective_index"
  ON "kpi_management_kpi_versions" USING btree ("kpi_id", "effective_from");
INSERT INTO "kpi_management_kpi_versions" ("kpi_id", "version", "definition", "effective_from")
SELECT id, version, json_build_object(
  'code', code, 'name', name, 'description', description, 'category', category,
  'unit', unit, 'direction', direction, 'targetValue', target_value,
  'warningValue', warning_value, 'criticalValue', critical_value,
  'inputMode', input_mode, 'formulaType', formula_type, 'frequency', frequency,
  'source', source, 'ownerUserId', owner_user_id, 'dataOwnerUserId', data_owner_user_id,
  'reporterUserId', reporter_user_id, 'reviewerUserId', reviewer_user_id,
  'companyId', company_id, 'branchId', branch_id, 'businessUnitId', business_unit_id
), effective_from
FROM "kpi_management_kpis";
--> statement-breakpoint
ALTER TABLE "kpi_management_values"
  ADD COLUMN "version" integer DEFAULT 1 NOT NULL,
  ADD COLUMN "definition_version" integer DEFAULT 1 NOT NULL,
  ADD COLUMN "data_state" varchar(16) DEFAULT 'valid' NOT NULL,
  ADD COLUMN "reviewed_by" bigint REFERENCES "users"("id") ON DELETE SET NULL,
  ADD COLUMN "approved_by" bigint REFERENCES "users"("id") ON DELETE SET NULL;
UPDATE "kpi_management_values" SET "data_state" = 'missing' WHERE "actual_value" IS NULL;
DROP INDEX IF EXISTS "kpi_management_values_kpi_id_period_unique";
CREATE UNIQUE INDEX "kpi_management_values_kpi_period_version_unique"
  ON "kpi_management_values" USING btree ("kpi_id", "period", "version");
--> statement-breakpoint
ALTER TABLE "kpi_management_checkins"
  ADD COLUMN "reviewed_by" bigint REFERENCES "users"("id") ON DELETE SET NULL,
  ADD COLUMN "approved_by" bigint REFERENCES "users"("id") ON DELETE SET NULL,
  ADD COLUMN "review_note" varchar(1000) DEFAULT '' NOT NULL;
--> statement-breakpoint
CREATE TABLE "management_observations" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "holding_id" bigint NOT NULL REFERENCES "holdings"("id") ON DELETE RESTRICT,
  "company_id" bigint NOT NULL REFERENCES "companies"("id") ON DELETE RESTRICT,
  "branch_id" bigint REFERENCES "branches"("id") ON DELETE SET NULL,
  "business_unit_id" bigint REFERENCES "business_units"("id") ON DELETE SET NULL,
  "user_id" bigint NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "period" varchar(10) NOT NULL,
  "text" text NOT NULL,
  "tags" json DEFAULT '[]'::json NOT NULL,
  "related_kpi_ids" json DEFAULT '[]'::json NOT NULL,
  "status" varchar(16) DEFAULT 'submitted' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);
CREATE INDEX "management_observations_company_period_index"
  ON "management_observations" USING btree ("company_id", "period");
CREATE INDEX "management_observations_business_unit_period_index"
  ON "management_observations" USING btree ("business_unit_id", "period");
CREATE INDEX "management_observations_user_created_index"
  ON "management_observations" USING btree ("user_id", "created_at");
--> statement-breakpoint
CREATE TABLE "red_flags" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "holding_id" bigint NOT NULL REFERENCES "holdings"("id") ON DELETE RESTRICT,
  "company_id" bigint NOT NULL REFERENCES "companies"("id") ON DELETE RESTRICT,
  "branch_id" bigint REFERENCES "branches"("id") ON DELETE SET NULL,
  "business_unit_id" bigint REFERENCES "business_units"("id") ON DELETE SET NULL,
  "kpi_id" bigint REFERENCES "kpi_management_kpis"("id") ON DELETE RESTRICT,
  "period" varchar(10),
  "trigger_value" numeric(14,4),
  "threshold" numeric(14,4),
  "description" varchar(2000) NOT NULL,
  "suspected_cause" varchar(2000),
  "severity" varchar(16) NOT NULL,
  "owner_user_id" bigint REFERENCES "users"("id") ON DELETE SET NULL,
  "deadline" date,
  "status" varchar(24) DEFAULT 'new' NOT NULL,
  "source" varchar(24) DEFAULT 'manual' NOT NULL,
  "action_id" bigint,
  "closure_evidence" varchar(2000),
  "exception_reason" varchar(1000),
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "resolved_at" timestamp with time zone
);
CREATE INDEX "red_flags_holding_company_status_index"
  ON "red_flags" USING btree ("holding_id", "company_id", "status");
CREATE INDEX "red_flags_kpi_period_index"
  ON "red_flags" USING btree ("kpi_id", "period");
CREATE INDEX "red_flags_owner_deadline_index"
  ON "red_flags" USING btree ("owner_user_id", "deadline");
--> statement-breakpoint
INSERT INTO "kpi_studio_options" ("group", "name", "slug", "position") VALUES
  ('input_mode', 'عددی', 'numeric', 3),
  ('input_mode', 'درصدی', 'percentage', 4),
  ('input_mode', 'ارزی', 'currency', 5),
  ('input_mode', 'تعداد', 'count', 6),
  ('input_mode', 'نسبت', 'ratio', 7),
  ('input_mode', 'متن', 'text', 8),
  ('input_mode', 'متن چندخطی', 'textarea', 9),
  ('input_mode', 'انتخابی', 'select', 10),
  ('input_mode', 'چندانتخابی', 'multi-select', 11),
  ('input_mode', 'فرمول', 'formula', 12),
  ('input_mode', 'توصیفی', 'descriptive', 13)
ON CONFLICT ("group", "slug") DO NOTHING;
