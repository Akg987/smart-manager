CREATE TABLE "kpi_import_runs" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "holding_id" bigint NOT NULL REFERENCES "holdings"("id") ON DELETE RESTRICT,
  "company_id" bigint NOT NULL REFERENCES "companies"("id") ON DELETE RESTRICT,
  "actor_id" bigint REFERENCES "users"("id") ON DELETE SET NULL,
  "file_name" varchar(160) NOT NULL,
  "row_count" integer NOT NULL CHECK ("row_count" >= 0),
  "imported_count" integer NOT NULL DEFAULT 0 CHECK ("imported_count" >= 0),
  "duplicate_count" integer NOT NULL DEFAULT 0 CHECK ("duplicate_count" >= 0),
  "rejected_count" integer NOT NULL DEFAULT 0 CHECK ("rejected_count" >= 0),
  "status" varchar(16) NOT NULL CHECK ("status" IN ('completed', 'partial', 'failed')),
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "kpi_import_runs_company_created_index"
  ON "kpi_import_runs" ("company_id", "created_at");
--> statement-breakpoint
CREATE TABLE "kpi_import_records" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "run_id" bigint NOT NULL REFERENCES "kpi_import_runs"("id") ON DELETE RESTRICT,
  "holding_id" bigint NOT NULL REFERENCES "holdings"("id") ON DELETE RESTRICT,
  "company_id" bigint NOT NULL REFERENCES "companies"("id") ON DELETE RESTRICT,
  "branch_id" bigint REFERENCES "branches"("id") ON DELETE SET NULL,
  "business_unit_id" bigint REFERENCES "business_units"("id") ON DELETE SET NULL,
  "kpi_id" bigint NOT NULL REFERENCES "kpi_management_kpis"("id") ON DELETE RESTRICT,
  "checkin_id" bigint REFERENCES "kpi_management_checkins"("id") ON DELETE SET NULL,
  "external_id" varchar(128) NOT NULL,
  "source" varchar(64) NOT NULL,
  "period" varchar(10) NOT NULL,
  "value" numeric(14, 4) NOT NULL,
  "unit" varchar(32) NOT NULL,
  "payload_hash" varchar(64) NOT NULL,
  "kpi_version" integer NOT NULL,
  "imported_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "kpi_import_records_period_format_check"
    CHECK ("period" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);
--> statement-breakpoint
CREATE UNIQUE INDEX "kpi_import_records_company_source_external_unique"
  ON "kpi_import_records" ("company_id", "source", "external_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "kpi_import_records_company_kpi_period_unique"
  ON "kpi_import_records" ("company_id", "kpi_id", "period");
--> statement-breakpoint
CREATE INDEX "kpi_import_records_run_index" ON "kpi_import_records" ("run_id");
