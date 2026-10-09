import assert from "node:assert/strict";
import dotenv from "dotenv";
import postgres from "postgres";

dotenv.config({ path: [".env.local", ".env"] });
if (!process.env.DATABASE_URL)
  throw new Error("DATABASE_URL is required for Phase 4 database acceptance.");

const client = postgres(process.env.DATABASE_URL, {
  max: 1,
  connect_timeout: 10,
});
try {
  const [schema] = await client`
    select to_regclass('public.dashboards') is not null as dashboards,
      to_regclass('public.dashboard_widgets') is not null as dashboard_widgets,
      to_regclass('public.dashboard_versions') is not null as dashboard_versions,
      to_regclass('public.derived_kpis') is not null as derived_kpis,
      to_regclass('public.derived_kpi_versions') is not null as derived_kpi_versions,
      to_regclass('public.derived_kpi_values') is not null as derived_kpi_values,
      to_regclass('public.management_review_meetings') is not null as management_review_meetings,
      to_regclass('public.management_escalation_rules') is not null as management_escalation_rules,
      to_regclass('public.management_escalation_events') is not null as management_escalation_events,
      to_regclass('public.management_reminder_policies') is not null as management_reminder_policies,
      to_regclass('public.management_reminders') is not null as management_reminders,
      to_regclass('public.management_decision_actions') is not null as management_decision_actions,
      exists(select 1 from information_schema.columns where table_schema='public' and table_name='corrective_actions' and column_name='baseline') as action_baseline,
      exists(select 1 from information_schema.columns where table_schema='public' and table_name='corrective_actions' and column_name='target') as action_target
  `;
  for (const [key, value] of Object.entries(schema))
    assert.equal(value, true, `Phase 4 schema item is missing: ${key}`);

  const [migration] =
    await client`select max(created_at)::text as latest from drizzle.__drizzle_migrations`;
  assert.equal(
    migration.latest,
    "1791673200000",
    "Migration 0009 must be the latest applied migration.",
  );
  process.stdout.write(
    JSON.stringify({
      passed: true,
      phase4SchemaVerified: true,
      latestMigration: "0009_phase4_dashboard_formula_reviews",
      tablesAndColumnsVerified: Object.keys(schema).length,
    }) + "\n",
  );
} finally {
  await client.end();
}
