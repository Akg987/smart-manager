ALTER TABLE "corrective_actions"
  ADD COLUMN "company_id" bigint,
  ADD COLUMN "business_unit_id" bigint,
  ADD COLUMN "source_kpi_id" bigint,
  ADD COLUMN "source_red_flag_id" bigint,
  ADD COLUMN "source_decision_id" bigint,
  ADD COLUMN "evaluation_due_at" date;
--> statement-breakpoint
UPDATE "corrective_actions" AS action
SET "business_unit_id" = unit."id",
    "company_id" = unit."company_id"
FROM "business_units" AS unit
WHERE unit."legacy_department_id" = action."department_id"
  AND action."business_unit_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "corrective_actions"
  ADD CONSTRAINT "corrective_actions_company_id_companies_id_fk"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT,
  ADD CONSTRAINT "corrective_actions_business_unit_id_business_units_id_fk"
    FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE RESTRICT,
  ADD CONSTRAINT "corrective_actions_source_kpi_id_kpi_management_kpis_id_fk"
    FOREIGN KEY ("source_kpi_id") REFERENCES "kpi_management_kpis"("id") ON DELETE SET NULL,
  ADD CONSTRAINT "corrective_actions_source_red_flag_id_red_flags_id_fk"
    FOREIGN KEY ("source_red_flag_id") REFERENCES "red_flags"("id") ON DELETE SET NULL,
  ADD CONSTRAINT "corrective_actions_source_decision_id_management_decisions_id_fk"
    FOREIGN KEY ("source_decision_id") REFERENCES "management_decisions"("id") ON DELETE SET NULL,
  ADD CONSTRAINT "corrective_actions_single_source_check"
    CHECK (num_nonnulls("source_kpi_id", "source_red_flag_id", "source_decision_id") <= 1);
--> statement-breakpoint
CREATE INDEX "corrective_actions_company_business_unit_index"
  ON "corrective_actions" ("company_id", "business_unit_id");
--> statement-breakpoint
CREATE INDEX "corrective_actions_source_red_flag_index"
  ON "corrective_actions" ("source_red_flag_id");
--> statement-breakpoint
CREATE INDEX "corrective_actions_source_decision_index"
  ON "corrective_actions" ("source_decision_id");
