-- Match persisted AI permissions with the role catalog used by the application.
INSERT INTO "role_permissions" ("role_id", "permission_id", "scope_type", "domain")
SELECT r."id", p."id", grants."scope_type", NULL
FROM (VALUES
  ('GROUP_CEO', 'ai.chat', 'holding'),
  ('GROUP_CEO', 'ai.analytics', 'holding'),
  ('GROUP_CEO', 'ai.recommendations', 'holding'),
  ('GROUP_COO', 'ai.chat', 'holding'),
  ('GROUP_COO', 'ai.analytics', 'holding'),
  ('GROUP_COO', 'ai.recommendations', 'holding'),
  ('COMPANY_CEO', 'ai.chat', 'company'),
  ('COMPANY_CEO', 'ai.analytics', 'company'),
  ('COMPANY_CEO', 'ai.recommendations', 'company'),
  ('PNL_OWNER', 'ai.chat', 'company'),
  ('PNL_OWNER', 'ai.analytics', 'company'),
  ('SALES_MANAGER', 'ai.chat', 'company'),
  ('SALES_MANAGER', 'ai.analytics', 'company'),
  ('SALES_MANAGER', 'ai.recommendations', 'company'),
  ('FINANCE_MANAGER', 'ai.chat', 'company'),
  ('FINANCE_MANAGER', 'ai.analytics', 'company'),
  ('FINANCE_MANAGER', 'ai.recommendations', 'company'),
  ('HR_MANAGER', 'ai.chat', 'company'),
  ('HR_MANAGER', 'ai.analytics', 'company'),
  ('OPERATIONS_MANAGER', 'ai.chat', 'company'),
  ('OPERATIONS_MANAGER', 'ai.analytics', 'company'),
  ('OPERATIONS_MANAGER', 'ai.recommendations', 'company'),
  ('DATA_OWNER', 'ai.chat', 'company'),
  ('DATA_OWNER', 'ai.analytics', 'company')
) AS grants("role_key", "permission_key", "scope_type")
JOIN "roles" r ON r."key" = grants."role_key"
  AND r."holding_id" IS NULL
JOIN "permissions" p ON p."key" = grants."permission_key"
ON CONFLICT ("role_id", "permission_id") DO UPDATE
SET "scope_type" = EXCLUDED."scope_type", "domain" = NULL;
--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission_id", "scope_type", "domain")
SELECT r."id", p."id", 'company', NULL
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."key" = 'COMPANY_ADMIN'
  AND r."holding_id" IS NOT NULL
  AND p."key" IN ('ai.chat', 'ai.analytics', 'ai.recommendations')
ON CONFLICT ("role_id", "permission_id") DO UPDATE
SET "scope_type" = EXCLUDED."scope_type", "domain" = NULL;
