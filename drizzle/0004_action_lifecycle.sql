ALTER TABLE "corrective_actions"
  ALTER COLUMN "status" TYPE varchar(40),
  ADD COLUMN "approver_user_id" bigint,
  ADD COLUMN "progress" integer DEFAULT 0 NOT NULL,
  ADD COLUMN "blocker_reason" text,
  ADD COLUMN "delay_reason" text;
--> statement-breakpoint
ALTER TABLE "corrective_actions"
  ADD CONSTRAINT "corrective_actions_approver_user_id_users_id_fk"
  FOREIGN KEY ("approver_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "corrective_actions"
  ADD CONSTRAINT "corrective_actions_progress_range_check"
  CHECK ("progress" >= 0 AND "progress" <= 100);
--> statement-breakpoint
CREATE TABLE "corrective_action_evidence" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "action_id" bigint NOT NULL,
  "uploaded_by" bigint NOT NULL,
  "storage_key" varchar(500) NOT NULL,
  "original_file_name" varchar(255) NOT NULL,
  "mime_type" varchar(100) NOT NULL,
  "file_size" integer NOT NULL,
  "note" varchar(1000),
  "created_at" timestamp with time zone,
  CONSTRAINT "corrective_action_evidence_action_id_corrective_actions_id_fk"
    FOREIGN KEY ("action_id") REFERENCES "corrective_actions"("id") ON DELETE RESTRICT,
  CONSTRAINT "corrective_action_evidence_uploaded_by_users_id_fk"
    FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX "corrective_action_evidence_action_created_index"
  ON "corrective_action_evidence" USING btree ("action_id", "created_at");
--> statement-breakpoint
CREATE INDEX "corrective_action_evidence_uploader_index"
  ON "corrective_action_evidence" USING btree ("uploaded_by");
