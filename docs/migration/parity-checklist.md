# Phase 5 — parity verification

**Checked:** 2026-10-07  
**Decision:** migration is not approved for Laravel removal. The old source has not been deleted.

| Check | Result | Evidence / remaining work |
|---|---|---|
| Public SEO URLs | **PASS WITH SCOPE NOTE** | The Laravel root redirects to `/login` or `/dashboard`; the Next proxy now protects `/` and sends unauthenticated requests through login. The source route set contains no public article, product, or other indexable content. Login, register, setup, reset, pending-approval, dashboard, and workspace URL patterns exist in Next. This confirms route shape, not search-engine indexing or metadata equivalence. |
| Protected URL coverage | **PARTIAL** | The Proxy now includes root, profile, and IPPanel paths. `/profile/avatars/:id` is rewritten to the Nest avatar endpoint. Static comparison still finds source endpoints without full destination parity, including `/branding/logo`, `/kpi-reports/weekly.xlsx`, module ZIP install/upgrade/uninstall, and parts of user/department administration. |
| Financial, payment, and discount calculations | **NOT APPLICABLE TO DISCOVERED DOMAIN** | The Laravel archive and the supplied SQL dump contain no payment, invoice, price, or discount entities/routes. This is not proof about data sources outside the files examined. KPI health thresholds are the closest calculation domain. |
| KPI calculation parity | **PARTIAL** | Unit tests cover higher/lower thresholds, defaults, boundary values, invalid threshold order, and input normalization. The tests use representative fixed cases; a row-by-row comparison against a restored Laravel database has not run. |
| Data submission parity | **NOT VERIFIED END TO END** | The existing HTTP integration test covers login-cookie to dashboard with test providers. It does not submit a check-in/action against PostgreSQL or compare that result with Laravel. |
| Login with sample users | **NOT RUN** | The supplied dump has a `users` insert, but no plaintext test password was supplied. The workstation has no MySQL or PostgreSQL CLI and neither Next nor Nest is listening on ports 3000/4000. Existing tests verify Laravel `$2y$` bcrypt compatibility, not a particular sample account. No attempt was made to recover or display password data. |
| Source/target table inventory | **PARTIAL** | The dump defines 25 MySQL tables; Drizzle defines 28 PostgreSQL tables. All 25 source names have same-name targets. The target-only tables are `sms_ippanel_settings`, `sms_ippanel_credit_alerts`, and `sms_ippanel_send_counters`; they are not in this dump and need a source-of-truth decision before cutover. Column-level and row-level verification requires a restored staging database. |
| MySQL → PostgreSQL transfer | **SCRIPT PREPARED; NOT EXECUTED** | `scripts/migration/migrate_mysql_to_postgres.py` defaults to read-only preflight, refuses source-only tables and non-empty targets, requires an explicit apply confirmation, preserves password hashes, checks shared columns, and runs the copy plus foreign-key recreation in one PostgreSQL transaction. It has not been run because no staging connection details or database services are available here. |
| Deployment | **GUIDE PREPARED; NOT DEPLOYED** | Docker, Compose, and Nginx examples are in `deployment.md`. The project has no Dockerfile, compose file, or Nginx site config, and the examples have not been started. |
| Phase 5 local validation | **BLOCKED BY RUNNER RESOURCES** | The MySQL→PostgreSQL script passes Python syntax parsing and `git diff --check` passes. On 2026-10-07, `npm run build` and `tsc --noEmit` terminated with Node heap/zone allocation failures; API typecheck and tests also could not complete in the constrained runner. Therefore Phase 5 does not re-confirm the earlier Phase 4 test results. |
| Runtime availability | **NOT READY IN THIS WORKSPACE** | PostgreSQL port 5432 is listening, but ports 3000 (Next), 4000 (Nest), and 3306 (MySQL) are not. No database connection or migration preflight was attempted. |
| Dead-code cleanup | **LIMITED, NO SOURCE DELETIONS** | The generic starter README is replaced with project instructions and the temporary config placeholder comment is removed. A source search found no explicit TODO/FIXME markers; files named `DemoForm` and form placeholder attributes are still used by the live UI. No Laravel files or application files of uncertain use were removed. Build output under `.next` is generated/ignored, not source cleanup. Further deletion is deferred until the failed and unrun checks above pass. |

## Required evidence before retirement

1. Restore the supplied dump into an isolated MySQL staging database and run the migration script in default preflight mode against a fresh PostgreSQL database with the Drizzle migrations already applied.
2. Resolve the three target-only SMS tables and verify every shared column, source/target row count, foreign key, sequence, JSON value, and date/time conversion.
3. Run login using an approved staging account and known test password, then compare a check-in and an action operation against Laravel results.
4. Complete the missing URL and operation mappings listed above, then run browser checks for redirects, metadata, assets, and forms.
5. Deploy the documented services in staging, exercise backup/restore and rollback, and only then consider retiring the Laravel source.
