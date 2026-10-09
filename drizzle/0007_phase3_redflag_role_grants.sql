-- Grant the Phase 3 Red Flag capabilities to the standard roles that own them.
-- Keep grants aligned with SMART_MANAGER_ROLE_GRANTS and company admin policy.
INSERT INTO "role_permissions" ("role_id", "permission_id", "scope_type", "domain")
SELECT r."id", p."id", grants."scope_type", NULL
FROM (VALUES
  ('GROUP_CEO', 'redflag.view', 'holding'),
  ('GROUP_CEO', 'redflag.create', 'holding'),
  ('GROUP_CEO', 'redflag.update', 'holding'),
  ('GROUP_CEO', 'redflag.resolve', 'holding'),
  ('GROUP_COO', 'redflag.view', 'holding'),
  ('GROUP_COO', 'redflag.create', 'holding'),
  ('GROUP_COO', 'redflag.update', 'holding'),
  ('GROUP_COO', 'redflag.resolve', 'holding'),
  ('PMO', 'redflag.view', 'holding'),
  ('PMO', 'redflag.create', 'holding'),
  ('PMO', 'redflag.update', 'holding'),
  ('PMO_REVIEWER', 'redflag.view', 'holding'),
  ('COMPANY_CEO', 'redflag.view', 'company'),
  ('COMPANY_CEO', 'redflag.create', 'company'),
  ('COMPANY_CEO', 'redflag.update', 'company'),
  ('COMPANY_CEO', 'redflag.resolve', 'company'),
  ('OPERATIONS_MANAGER', 'redflag.view', 'company'),
  ('OPERATIONS_MANAGER', 'redflag.create', 'company'),
  ('OPERATIONS_MANAGER', 'redflag.update', 'company'),
  ('OPERATIONS_MANAGER', 'redflag.resolve', 'company'),
  ('DATA_OWNER', 'redflag.view', 'company'),
  ('KPI_REVIEWER', 'redflag.view', 'company'),
  ('KPI_REVIEWER', 'redflag.update', 'company'),
  ('KPI_REVIEWER', 'redflag.resolve', 'company')
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
  AND p."key" IN ('redflag.view', 'redflag.create', 'redflag.update', 'redflag.resolve')
ON CONFLICT ("role_id", "permission_id") DO UPDATE
SET "scope_type" = EXCLUDED."scope_type", "domain" = NULL;
