CREATE TABLE "ai_conversations" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "holding_id" bigint NOT NULL REFERENCES "holdings"("id") ON DELETE RESTRICT,
  "company_id" bigint NOT NULL REFERENCES "companies"("id") ON DELETE RESTRICT,
  "owner_user_id" bigint NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" varchar(240) DEFAULT '' NOT NULL,
  "model" varchar(120) DEFAULT '' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "ai_conversations_owner_updated_index" ON "ai_conversations" ("owner_user_id", "updated_at");
CREATE INDEX "ai_conversations_tenant_updated_index" ON "ai_conversations" ("holding_id", "company_id", "updated_at");
--> statement-breakpoint
CREATE TABLE "ai_messages" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "conversation_id" bigint NOT NULL REFERENCES "ai_conversations"("id") ON DELETE CASCADE,
  "role" varchar(16) NOT NULL CHECK ("role" IN ('user','assistant','tool')),
  "content" text NOT NULL,
  "tool_calls" json DEFAULT '[]'::json NOT NULL,
  "source_references" json DEFAULT '[]'::json NOT NULL,
  "metadata" json DEFAULT '{}'::json NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "ai_messages_conversation_created_index" ON "ai_messages" ("conversation_id", "created_at");
--> statement-breakpoint
CREATE TABLE "ai_recommendations" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "conversation_id" bigint NOT NULL REFERENCES "ai_conversations"("id") ON DELETE CASCADE,
  "message_id" bigint NOT NULL REFERENCES "ai_messages"("id") ON DELETE CASCADE,
  "recommendation_key" varchar(80) NOT NULL,
  "details" json NOT NULL,
  "status" varchar(16) DEFAULT 'pending' NOT NULL CHECK ("status" IN ('pending','processing','accepted','rejected')),
  "reviewed_by" bigint REFERENCES "users"("id") ON DELETE SET NULL,
  "reviewed_at" timestamp with time zone,
  "action_id" bigint REFERENCES "corrective_actions"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "ai_recommendations_message_key_unique" UNIQUE ("message_id", "recommendation_key")
);
CREATE INDEX "ai_recommendations_conversation_status_index" ON "ai_recommendations" ("conversation_id", "status");
