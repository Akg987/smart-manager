# Phase 2 and Phase 3 Implementation Review - Smart Manager

**Review date:** 2026-10-09
**Status:** Phase 2 and Phase 3 are implemented and verified. Phase 3 PostgreSQL acceptance passed against the configured `DATABASE_URL` after the user approved migration `0008`.

## Product rules carried into the implementation

- Holding Group contains the default Company Smarlux. Business Units are first-class tenant scopes. KPI authoring works at company or authorized Business Unit scope and does not require a legacy Department row.
- `COMPANY_ADMIN` is an operational company role. `TECHNICAL_ADMIN` and root/system roles cannot be delegated. Role delegation enforces permission subsets, tenant scope containment, and audit history.
- Action executors can report progress, attach evidence, and request completion approval. Authorized approvers close Actions. Progress at 100% does not close an Action. Sensitive changes require an authorized reason and audit history.
- KPI check-in submitters cannot approve or lock their own data. New submissions use `data_submitted` (legacy `submitted` remains readable); authorized reviewers approve, reject, and lock approved check-ins. Approved values are versioned and immutable. Red Flags have their own audited lifecycle.
- Range KPIs treat the target as the center of the desired range. Warning and critical values are maximum absolute deviations; values at either threshold remain in the lower-severity band.
- Formula input behavior is deterministic: `ratio` calculates numerator/denominator, `percentage` multiplies that ratio by 100, `checklist` calculates completed/total as a percentage, and `formula`/`components` sum validated numeric components. A zero denominator or incomplete/invalid component set is rejected. Other supported numeric input modes record the supplied value.
- Dashboard health reflects the current reporting period. A KPI with older approved data and no current-period value is counted as stale; a KPI with no approved value is counted as missing.

## Phase 2: tenant and authorization

- Holding, Company, Branch, Business Unit, Membership, role assignment, JWT/session tenant context, and active company switching are implemented.
- Organization and membership APIs are scoped to the actor's active tenant permissions. Membership revocation invalidates access and refresh sessions.
- Delegation blocks system/root/`TECHNICAL_ADMIN` roles, enforces that delegated permissions are a subset of the actor's effective grants and that delegated scope stays within the actor's scope, and audits grant/revocation details.
- Invitations support creation, listing, revocation, registration acceptance, and acceptance by an existing account. Tokens are random, stored as hashes, expire after seven days, and are consumed once. Acceptance rechecks tenant, role, and permission bounds.
- `/auth/me` returns effective permissions from active membership roles. The sidebar and persona dashboard hide routes/cards the current member cannot access; API authorization remains authoritative.
- The tenant administration and membership screens use the same active company context, and company switching clears tenant-bound query data.

## Phase 3: KPI and workflow frontend/API

- KPI definition versioning, review, publication, check-in submission, independent approval/rejection, observation history, and Red Flag lifecycle are implemented.
- KPI creation and editing use active Company/Business Unit membership scopes, including the zero-Department database case. Check-in entry renders the configured numeric/formula input mode.
- The dashboard separates current-period submission state from historical approved values and exposes stale and missing counts. KPI boards display Business Unit or Company names for new tenant-scoped KPIs.
- Critical approved values create Red Flags transactionally. Red Flag visibility and lifecycle transitions enforce tenant scope, closure evidence/exception rules, and audit logging.
- KPI definitions and their versions retain the input mode, formula type, and input field definition used by that version.
- Central KPI calculation supports numeric, percentage, currency, count, ratio, text, textarea, select, multi-select, formula, and descriptive inputs. Missing, null, zero, rejected, late, and stale are represented as separate data states; KPI health remains separate from Red Flag severity.
- KPI actuals preserve company, branch, business unit, reporter, reviewer, approval time, source, unit, and definition version. Only one current approved value is allowed for each KPI and period; older approved values remain versioned.
- Management observations are stored independently from KPI actuals. Configurable Red Flag rules evaluate KPI thresholds, multiple-period degradation, missing/stale data, overdue actions, and approved overdue decisions. A separate minimal Decision record API supports authoring, approval, outcome closure, KPI/Action links, tenant scope, and audit; `decision_overdue` Red Flags link to their source Decision, while Actions remain independent.

## Database state

- Tenant schema and the approved account/role setup are present in the PostgreSQL database configured through `DATABASE_URL`. The two former `admin` accounts have active default-company `COMPANY_ADMIN` memberships; no `TECHNICAL_ADMIN` membership was assigned.
- Drizzle migrations through `0008_phase3_decision_overdue_source.sql` are applied and verified against the configured PostgreSQL database; the stored migration hash matches the local migration file. The previously applied `0005` backfill was not rerun.
- Phase 3 database acceptance exercises the real definition creation/review/publication workflow, incomplete-definition rejection, check-in submission/review/locking, data provenance, scoped Red Flag generation and closure, management observations, and overdue-decision linkage. Temporary fixtures are deleted in a `finally` block and post-run fixture counts are zero.

## Verification

- API TypeScript check: passed.
- API unit/security/workflow tests: 61 passed, 0 failed. Tests cover calculation modes and edge cases, missing/zero/stale/late states, units, Red Flag rules and closure, authorization scopes, and action/decision workflows.
- Phase 2 PostgreSQL tenant-scope acceptance: passed; temporary fixtures were rolled back.
- Phase 3 PostgreSQL acceptance: passed; verified create → review → publish, incomplete KPI rejection, submitter/reviewer separation, canonical `data_submitted`, approved-value versioning and immutability, authorized locking, company isolation, automatic critical Red Flag creation, stale-rule evaluation, overdue-decision Red Flag linkage, observation/actual separation, Red Flag lifecycle, and Red Flag isolation. All acceptance fixtures were cleaned.
- Next.js production build, including TypeScript: passed.
- `git diff --check`: passed; Git emitted only line-ending conversion warnings.
- Chrome visual inspection: unavailable because the installed/active extension has no registered native-host manifest; reinstalling the Browser plugin is required to restore browser control.

## Acceptance outcome

Phase 2 and Phase 3 acceptance criteria pass. The approved migration `0008` is applied, its hash is verified, the Phase 3 database workflow passes, and temporary fixtures are absent after cleanup. No later phase was started.
