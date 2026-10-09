-- Minimal, separately scoped decision records provide the source for the Phase 3
-- decision_overdue Red Flag trigger. Decisions remain distinct from Actions.
CREATE TABLE "management_decisions" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "holding_id" bigint NOT NULL REFERENCES "holdings"("id") ON DELETE RESTRICT,
  "company_id" bigint NOT NULL REFERENCES "companies"("id") ON DELETE RESTRICT,
  "branch_id" bigint REFERENCES "branches"("id") ON DELETE SET NULL,
  "business_unit_id" bigint REFERENCES "business_units"("id") ON DELETE SET NULL,
  "period" varchar(10),
  "source_meeting" varchar(250),
  "decision_text" text NOT NULL,
  "owner_user_id" bigint REFERENCES "users"("id") ON DELETE SET NULL,
  "deadline" date NOT NULL,
  "status" varchar(24) DEFAULT 'pending_approval' NOT NULL,
  "related_kpi_ids" json DEFAULT '[]'::json NOT NULL,
  "action_ids" json DEFAULT '[]'::json NOT NULL,
  "created_by" bigint REFERENCES "users"("id") ON DELETE SET NULL,
  "approved_by" bigint REFERENCES "users"("id") ON DELETE SET NULL,
  "approved_at" timestamp with time zone,
  "outcome" text,
  "closure_evidence" varchar(2000),
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "closed_at" timestamp with time zone
);
CREATE INDEX "management_decisions_company_status_deadline_index"
  ON "management_decisions" ("company_id", "status", "deadline");
CREATE INDEX "management_decisions_business_unit_status_deadline_index"
  ON "management_decisions" ("business_unit_id", "status", "deadline");
CREATE INDEX "management_decisions_owner_deadline_index"
  ON "management_decisions" ("owner_user_id", "deadline");
--> statement-breakpoint
ALTER TABLE "red_flags"
  ADD COLUMN "decision_id" bigint REFERENCES "management_decisions"("id") ON DELETE SET NULL;
