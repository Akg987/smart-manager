import "../apps/api/node_modules/reflect-metadata/Reflect.js";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";
import postgres from "postgres";
import { and, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../apps/api/dist/src/db/schema.js";
import { AuthContextStore } from "../apps/api/dist/apps/api/src/common/auth-context.store.js";
import { AuthorizationRepository } from "../apps/api/dist/apps/api/src/module/authorization/authorization.repository.js";
import { AuthorizationService } from "../apps/api/dist/apps/api/src/module/authorization/authorization.service.js";
import { KpiManagementRepository } from "../apps/api/dist/apps/api/src/module/kpi-management/kpi-management.repository.js";
import { DecisionsRepository } from "../apps/api/dist/apps/api/src/module/decisions/decisions.repository.js";

dotenv.config({ path: [".env.local", ".env"] });
if (!process.env.DATABASE_URL)
  throw new Error("DATABASE_URL is required for Phase 3 acceptance.");

const client = postgres(process.env.DATABASE_URL, {
  max: 8,
  connect_timeout: 10,
});
const db = drizzle(client, { schema });
const contexts = new AuthContextStore();
const authorization = new AuthorizationService(
  new AuthorizationRepository(db),
  contexts,
);
const kpis = new KpiManagementRepository(db, authorization);
const decisions = new DecisionsRepository(db, authorization);
const marker = randomUUID().replaceAll("-", "").slice(0, 16);
const cleanupKpiIds = [];
const cleanupFlagIds = [];
const cleanupRuleIds = [];
const cleanupObservationIds = [];
const cleanupDecisionIds = [];
const auditSubjectIds = [];
let foreignCompanyId = null;

try {
  const phase3Schema = await client`
    select to_regclass('public.red_flag_rules') is not null as has_red_flag_rules,
      exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'kpi_management_kpis' and column_name = 'range_config') as has_range_config,
      exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'kpi_management_values' and column_name = 'is_current') as has_current_values,
      exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'kpi_management_values' and column_name = 'raw_value') as has_raw_provenance,
      to_regclass('public.management_decisions') is not null as has_decisions,
      exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'red_flags' and column_name = 'decision_id') as has_decision_link
  `;
  assert.equal(
    phase3Schema[0].has_red_flag_rules,
    true,
    "Phase 3 red_flag_rules migration must be applied before acceptance.",
  );
  assert.equal(
    phase3Schema[0].has_range_config,
    true,
    "Phase 3 KPI definition migration must be applied before acceptance.",
  );
  assert.equal(
    phase3Schema[0].has_current_values,
    true,
    "Phase 3 KPI value provenance migration must be applied before acceptance.",
  );
  assert.equal(
    phase3Schema[0].has_raw_provenance,
    true,
    "Phase 3 raw value provenance migration must be applied before acceptance.",
  );
  assert.equal(
    phase3Schema[0].has_decisions,
    true,
    "Phase 3 Decision Tracker source must be applied before acceptance.",
  );
  assert.equal(
    phase3Schema[0].has_decision_link,
    true,
    "Red Flags must link to overdue decisions.",
  );

  const rows = await client`
    select u.id::text as user_id, m.id::text as membership_id,
      m.holding_id::text as holding_id, m.company_id::text as company_id,
      m.branch_id::text as branch_id, m.business_unit_id::text as business_unit_id,
      m.scope_type, array_agg(distinct r.id::text) as role_ids
    from users u
    join memberships m on m.user_id = u.id and m.status = 'active'
    join holdings h on h.id = m.holding_id and h.status = 'active'
    join companies c on c.id = m.company_id and c.code = 'smarlux'
      and c.status = 'active' and c.archived_at is null
    join membership_roles mr on mr.membership_id = m.id
    join roles r on r.id = mr.role_id
    join role_permissions rp on rp.role_id = r.id
    join permissions p on p.id = rp.permission_id
    where u.approved_at is not null
    group by u.id, m.id
    having bool_or(p.key = 'kpi.submit')
      and bool_or(p.key = 'kpi.approve')
      and bool_or(p.key = 'kpi.update')
      and bool_or(p.key = 'kpi.create')
      and bool_or(p.key = 'kpi.review')
      and bool_or(p.key = 'redflag.view')
      and bool_or(p.key = 'redflag.create')
      and bool_or(p.key = 'redflag.update')
      and bool_or(p.key = 'redflag.resolve')
      and bool_or(p.key = 'decision.view')
      and bool_or(p.key = 'decision.create')
      and bool_or(p.key = 'decision.approve')
    order by u.id
    limit 2
  `;
  assert.ok(
    rows.length >= 2,
    "Two active Smarlux members with KPI submit, approve, and update grants are required.",
  );

  const actor = (row) => ({
    userId: BigInt(row.user_id),
    context: {
      userId: row.user_id,
      holdingId: row.holding_id,
      membershipId: row.membership_id,
      companyId: row.company_id,
      branchId: row.branch_id,
      businessUnitId: row.business_unit_id,
      roleIds: row.role_ids,
      scopeType: row.scope_type,
    },
  });
  const submitter = actor(rows[0]);
  const reviewer = actor(rows[1]);
  assert.notEqual(
    submitter.userId,
    reviewer.userId,
    "Submitter and reviewer must be different people.",
  );

  const [foreignCompany] = await db
    .insert(schema.companies)
    .values({
      holdingId: BigInt(submitter.context.holdingId),
      name: `Phase 3 isolation ${marker}`,
      code: `p3-${marker}`,
      status: "active",
    })
    .returning({ id: schema.companies.id });
  foreignCompanyId = foreignCompany.id;

  const makePublishedKpi = async (companyId, code, name) => {
    const [row] = await db
      .insert(schema.kpiManagementKpis)
      .values({
        departmentId: null,
        holdingId: BigInt(submitter.context.holdingId),
        companyId,
        branchId: null,
        businessUnitId: null,
        code,
        name,
        direction: "higher",
        targetValue: "100",
        warningValue: "80",
        criticalValue: "50",
        ownerUserId: submitter.userId,
        reporterUserId: submitter.userId,
        inputFields: [{ key: "actual", type: "number", required: true }],
        status: "published",
        active: true,
      })
      .returning();
    cleanupKpiIds.push(row.id);
    return row;
  };

  const kpi = await contexts.run(submitter.context, () =>
    kpis.createDefinition({
      actorId: submitter.userId,
      code: `p3-${marker}-main`,
      name: `Phase 3 acceptance ${marker}`,
      description: "Acceptance test KPI definition.",
      direction: "higher",
      targetValue: 100,
      warningValue: 80,
      criticalValue: 50,
      unit: "count",
      source: "acceptance",
      frequency: "weekly",
      reportingPeriod: "weekly",
      inputMode: "count",
      ownerUserId: submitter.userId,
      dataOwnerUserId: submitter.userId,
      reporterUserId: submitter.userId,
      reviewerUserId: reviewer.userId,
    }),
  );
  cleanupKpiIds.push(kpi.id);
  auditSubjectIds.push(kpi.id);
  await contexts.run(submitter.context, () =>
    kpis.submitDefinitionForReview(kpi.id, submitter.userId),
  );
  await contexts.run(reviewer.context, () =>
    kpis.publishDefinition(kpi.id, reviewer.userId),
  );

  const incompleteKpi = await contexts.run(submitter.context, () =>
    kpis.createDefinition({
      actorId: submitter.userId,
      code: `p3-${marker}-incomplete`,
      name: `Incomplete KPI ${marker}`,
      direction: "higher",
      targetValue: 100,
      ownerUserId: submitter.userId,
      dataOwnerUserId: submitter.userId,
      reporterUserId: submitter.userId,
      reviewerUserId: reviewer.userId,
    }),
  );
  cleanupKpiIds.push(incompleteKpi.id);
  auditSubjectIds.push(incompleteKpi.id);
  await db
    .update(schema.kpiManagementKpis)
    .set({ source: "" })
    .where(eq(schema.kpiManagementKpis.id, incompleteKpi.id));
  await assert.rejects(
    contexts.run(submitter.context, () =>
      kpis.submitDefinitionForReview(incompleteKpi.id, submitter.userId),
    ),
    /Complete the KPI definition/,
  );
  await assert.rejects(
    contexts.run(reviewer.context, () =>
      kpis.publishDefinition(incompleteKpi.id, reviewer.userId),
    ),
    /Only reviewed KPI definitions can be published/,
  );

  const foreignKpi = await makePublishedKpi(
    foreignCompanyId,
    `p3-${marker}-foreign`,
    `Foreign acceptance ${marker}`,
  );
  const submitted = await contexts.run(submitter.context, () =>
    kpis.submitCheckin({
      kpiId: kpi.id,
      userId: submitter.userId,
      period: "1405-W31",
      actualValue: 10,
      note: `acceptance-${marker}`,
    }),
  );
  const checkinId = submitted.checkin.id;
  auditSubjectIds.push(checkinId, kpi.id, foreignKpi.id);
  assert.equal(
    submitted.checkin.status,
    "data_submitted",
    "Newly submitted KPI data must use the canonical data_submitted state.",
  );
  const reviewQueue = await contexts.run(reviewer.context, () =>
    kpis.reviewQueue(reviewer.userId),
  );
  assert.ok(
    reviewQueue.some((item) => item.id === checkinId.toString()),
    "The reviewer queue must include data_submitted check-ins.",
  );

  await assert.rejects(
    contexts.run(submitter.context, () =>
      kpis.reviewCheckin({
        checkinId,
        actorId: submitter.userId,
        decision: "approved",
      }),
    ),
    /Submitters cannot approve their own KPI data\./,
  );
  await contexts.run(reviewer.context, () =>
    kpis.reviewCheckin({
      checkinId,
      actorId: reviewer.userId,
      decision: "approved",
      note: "Phase 3 database acceptance",
    }),
  );
  await contexts.run(reviewer.context, () =>
    kpis.lockCheckin(checkinId, reviewer.userId),
  );
  const [lockedCheckin] = await db
    .select()
    .from(schema.kpiManagementCheckins)
    .where(eq(schema.kpiManagementCheckins.id, checkinId));
  assert.equal(
    lockedCheckin.status,
    "locked",
    "Approved KPI data can be locked by a separate approver.",
  );

  const approvedValues = await db
    .select()
    .from(schema.kpiManagementValues)
    .where(eq(schema.kpiManagementValues.kpiId, kpi.id));
  assert.equal(
    approvedValues.length,
    1,
    "Approval must append one versioned KPI value.",
  );
  assert.equal(approvedValues[0].version, 1);
  assert.equal(approvedValues[0].definitionVersion, kpi.version);
  assert.equal(approvedValues[0].actualValue, "10.0000");
  assert.equal(
    approvedValues[0].companyId,
    BigInt(submitter.context.companyId),
  );
  assert.equal(approvedValues[0].businessUnitId, null);
  assert.equal(approvedValues[0].submittedBy, submitter.userId);
  assert.equal(approvedValues[0].reviewedBy, reviewer.userId);
  assert.equal(approvedValues[0].approvedBy, reviewer.userId);
  assert.ok(approvedValues[0].approvedAt);
  assert.equal(approvedValues[0].isCurrent, true);

  await assert.rejects(
    contexts.run(submitter.context, () =>
      kpis.submitCheckin({
        kpiId: kpi.id,
        userId: submitter.userId,
        period: "1405-W31",
        actualValue: 11,
      }),
    ),
    /An approved check-in cannot be changed\./,
  );
  assert.equal(
    (
      await db
        .select()
        .from(schema.kpiManagementValues)
        .where(eq(schema.kpiManagementValues.kpiId, kpi.id))
    ).length,
    1,
    "Approved KPI values must remain immutable when resubmission is attempted.",
  );

  assert.equal(
    await contexts.run(submitter.context, () =>
      authorization.canAccessKpi(submitter.userId, foreignKpi.id, "kpi.view"),
    ),
    false,
    "Company-scoped membership must not read another company's KPI.",
  );

  const [automaticFlag] = await db
    .select()
    .from(schema.redFlags)
    .where(
      and(
        eq(schema.redFlags.kpiId, kpi.id),
        eq(schema.redFlags.period, "1405-W31"),
      ),
    );
  assert.ok(
    automaticFlag,
    "Approving a critical result must create a separate Red Flag.",
  );
  assert.equal(automaticFlag.source, "kpi_rule");
  cleanupFlagIds.push(automaticFlag.id);
  auditSubjectIds.push(automaticFlag.id);

  const staleRule = await contexts.run(submitter.context, () =>
    kpis.createRedFlagRule({
      actorId: submitter.userId,
      trigger: "data_stale",
      severity: "high",
      configuration: {},
      kpiId: kpi.id,
    }),
  );
  cleanupRuleIds.push(staleRule.id);
  auditSubjectIds.push(staleRule.id);
  const evaluation = await contexts.run(submitter.context, () =>
    kpis.evaluateRedFlagRules(submitter.userId, "1405-W32"),
  );
  assert.ok(
    evaluation.createdRedFlags >= 1,
    "A configured stale-data rule must create a scoped Red Flag.",
  );
  const staleFlags = await db
    .select()
    .from(schema.redFlags)
    .where(
      and(
        eq(schema.redFlags.kpiId, kpi.id),
        eq(schema.redFlags.period, "1405-W32"),
      ),
    );
  assert.ok(staleFlags.some((flag) => flag.description.includes("data_stale")));
  cleanupFlagIds.push(...staleFlags.map((flag) => flag.id));
  auditSubjectIds.push(...staleFlags.map((flag) => flag.id));

  const decisionRule = await contexts.run(submitter.context, () =>
    kpis.createRedFlagRule({
      actorId: submitter.userId,
      trigger: "decision_overdue",
      severity: "critical",
      configuration: {},
      kpiId: kpi.id,
    }),
  );
  cleanupRuleIds.push(decisionRule.id);
  auditSubjectIds.push(decisionRule.id);
  const decision = await contexts.run(submitter.context, () =>
    decisions.create(submitter.userId, {
      period: "1405-W31",
      sourceMeeting: `Phase 3 acceptance ${marker}`,
      decisionText: `Acceptance decision ${marker}`,
      ownerUserId: submitter.userId,
      deadline: "2020-01-01",
      relatedKpiIds: [kpi.id],
    }),
  );
  cleanupDecisionIds.push(decision.id);
  auditSubjectIds.push(decision.id);
  await contexts.run(reviewer.context, () =>
    decisions.approve(reviewer.userId, decision.id),
  );
  const decisionEvaluation = await contexts.run(submitter.context, () =>
    kpis.evaluateRedFlagRules(submitter.userId, "1405-W32"),
  );
  assert.ok(
    decisionEvaluation.evaluatedDecisions >= 1,
    "Overdue approved decisions must be evaluated in scope.",
  );
  const [decisionFlag] = await db
    .select()
    .from(schema.redFlags)
    .where(eq(schema.redFlags.decisionId, decision.id))
    .limit(1);
  assert.ok(
    decisionFlag,
    "The decision_overdue rule must create a linked Red Flag.",
  );
  cleanupFlagIds.push(decisionFlag.id);
  auditSubjectIds.push(decisionFlag.id);

  const observation = await contexts.run(submitter.context, () =>
    kpis.createObservation({
      actorId: submitter.userId,
      period: "1405-W31",
      text: `Acceptance observation ${marker}`,
      relatedKpiIds: [kpi.id],
    }),
  );
  cleanupObservationIds.push(observation.id);
  auditSubjectIds.push(observation.id);
  assert.equal(
    (
      await db
        .select()
        .from(schema.kpiManagementValues)
        .where(eq(schema.kpiManagementValues.kpiId, kpi.id))
    ).length,
    1,
    "Management observations must not change KPI Actual records.",
  );

  const [foreignFlag] = await db
    .insert(schema.redFlags)
    .values({
      holdingId: BigInt(submitter.context.holdingId),
      companyId: foreignCompanyId,
      description: `Foreign red flag ${marker}`,
      severity: "high",
      status: "new",
      source: "manual",
    })
    .returning();
  cleanupFlagIds.push(foreignFlag.id);
  const board = await contexts.run(submitter.context, () =>
    kpis.redFlagBoard(submitter.userId),
  );
  assert.equal(
    board.some((flag) => flag.id === foreignFlag.id),
    false,
    "Red Flag board must not leak a neighboring company record.",
  );

  await assert.rejects(
    contexts.run(reviewer.context, () =>
      kpis.updateRedFlag({
        id: automaticFlag.id,
        actorId: reviewer.userId,
        status: "closed",
      }),
    ),
    /Resolve the red flag before closing it\./,
  );
  await contexts.run(reviewer.context, () =>
    kpis.updateRedFlag({
      id: automaticFlag.id,
      actorId: reviewer.userId,
      status: "investigating",
      suspectedCause: "Cause under review",
    }),
  );
  await contexts.run(reviewer.context, () =>
    kpis.updateRedFlag({
      id: automaticFlag.id,
      actorId: reviewer.userId,
      status: "resolved",
      closureEvidence: "Resolution evidence recorded",
    }),
  );
  const closedFlag = await contexts.run(reviewer.context, () =>
    kpis.updateRedFlag({
      id: automaticFlag.id,
      actorId: reviewer.userId,
      status: "closed",
      closureEvidence: "Resolution evidence recorded",
    }),
  );
  assert.equal(closedFlag.status, "closed");

  process.stdout.write(
    JSON.stringify({
      passed: true,
      phase3SchemaVerified: true,
      checkinApproval: "submitter/reviewer separation enforced",
      definitionWorkflow:
        "create -> review -> publish; incomplete definition rejected",
      checkinSubmissionState: "data_submitted",
      approvedCheckinLock: true,
      approvedValueVersion: approvedValues[0].version,
      approvedValueImmutable: true,
      companyIsolation: true,
      automaticRedFlag: true,
      staleRuleEvaluation: true,
      decisionOverdueRedFlag: true,
      observationDoesNotChangeActual: true,
      redFlagLifecycle: "new -> investigating -> resolved -> closed",
      redFlagIsolation: true,
      fixturesWillBeCleaned: true,
    }) + "\n",
  );
} finally {
  if (auditSubjectIds.length) {
    await db
      .delete(schema.auditLogs)
      .where(
        and(
          inArray(schema.auditLogs.subjectId, auditSubjectIds),
          inArray(schema.auditLogs.subjectType, [
            "KpiCheckin",
            "KpiDefinition",
            "RedFlag",
            "RedFlagRule",
            "ManagementObservation",
            "ManagementDecision",
          ]),
        ),
      );
  }
  if (cleanupObservationIds.length)
    await db
      .delete(schema.managementObservations)
      .where(inArray(schema.managementObservations.id, cleanupObservationIds));
  if (cleanupDecisionIds.length)
    await db
      .delete(schema.managementDecisions)
      .where(inArray(schema.managementDecisions.id, cleanupDecisionIds));
  if (cleanupRuleIds.length)
    await db
      .delete(schema.redFlagRules)
      .where(inArray(schema.redFlagRules.id, cleanupRuleIds));
  if (cleanupFlagIds.length)
    await db
      .delete(schema.redFlags)
      .where(inArray(schema.redFlags.id, cleanupFlagIds));
  if (cleanupKpiIds.length) {
    await db
      .delete(schema.kpiManagementValues)
      .where(inArray(schema.kpiManagementValues.kpiId, cleanupKpiIds));
    await db
      .delete(schema.kpiManagementCheckins)
      .where(inArray(schema.kpiManagementCheckins.kpiId, cleanupKpiIds));
    await db
      .delete(schema.kpiManagementKpiVersions)
      .where(inArray(schema.kpiManagementKpiVersions.kpiId, cleanupKpiIds));
    await db
      .delete(schema.kpiManagementKpis)
      .where(inArray(schema.kpiManagementKpis.id, cleanupKpiIds));
  }
  if (foreignCompanyId)
    await db
      .delete(schema.companies)
      .where(eq(schema.companies.id, foreignCompanyId));
  await client.end();
}
