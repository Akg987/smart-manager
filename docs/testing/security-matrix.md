# ماتریس امنیتی API — Phase 1

این ماتریس بر اساس controllerها و سرویس‌های فعال تهیه شده است. ردیف‌های «هدف» معیار طراحی تست برای قابلیت‌های Holding-centric هستند؛ در این بازبینی test suite اجرا نشده است.

| route یا حوزه | کنترل فعلی مشاهده‌شده | مرز داده‌ی فعلی | آزمون یا gap |
|---|---|---|---|
| POST /api/auth/login، register، setup، password-reset/*، two-factor/* | مسیرهای عمومی؛ GET /auth/me با SessionGuard | User و session | rate limit، OTP replay، reset expiry، CSRF و session revocation |
| /api/users/me، password، avatar | SessionGuard | User جاری | تغییر رمز، session rotation، نوع/حجم فایل و دسترسی به avatar |
| /api/users/:id/organization، approve، revoke، role | SessionGuard و permission check در handlerها | User/Department | self escalation، permission matrix، اثر فوری revoke و audit |
| /api/authorization/* | SessionGuard و permission check | role_permissions و access levels | admin bypass، permission ناشناخته، تغییر role با session فعال |
| /api/departments | SessionGuard و organization permission | Department | دسترسی بین واحدها و نبود archive/lifecycle برای حذف |
| /api/kpis، /api/checkins | SessionGuard؛ permission، ownership و department checks در کد دامنه | KPI و check-in بر اساس Department/KPI | IDOR، reporter/owner، submit/review/approve و تغییر target |
| /api/actions، board، weekly، priorities | SessionGuard؛ manage/update-own و scope در برخی عملیات | owner/department؛ priorities سراسری | priority authorization، تغییر owner/deadline، close approval و IDOR |
| /api/alerts | SessionGuard و permissionهای alert | Alert/Department | resolve evidence، domain scope، idempotency و audit |
| /api/dashboard/* | SessionGuard؛ snapshot با department/global scope | aggregate KPI/action/alert | company isolation، missing/stale، privilege و قابل‌مقایسه بودن KPIها |
| GET /api/data/:collection | SessionGuard، collection whitelist و permission map | هر collection scope متفاوت دارد | مجوز هر collection؛ priorities و scopeهای audit/modules؛ tenant isolation |
| /api/notifications/* | SessionGuard و filter با notification.userId | inbox همان user | تغییر ID، read-all و company context |
| /api/settings/branding* | SessionGuard؛ update permission بررسی می‌شود | تنظیمات عمومی سایت | scope شرکت، مجوز logo upload و URL/file validation |
| /api/modules/* | SessionGuard؛ permission در mutationها | registry ماژول | scope، permission و audit |
| /api/sms/settings | SessionGuard و settings permission | تنظیمات سراسری SMS | masking secret، admin policy و audit |
| report/export/search | route مستقل report/export در controller inventory مشاهده نشد | Dashboard read model وجود دارد | هر endpoint تازه باید permission و tenant scope را قبل از query اعمال کند |
| avatar/logo binary routes | SessionGuard روی مسیرهای user/settings و SkipResponseWrap | فایل مرتبط با user یا سایت | authorization پیش از stream و عدم افشای path |

## آزمون‌های هدف برای Company و Domain Isolation

| actor/request | انتظار |
|---|---|
| GROUP_CEO در Company A و B متعلق به holding خودش | مجاز با holding permission |
| COMPANY_A_CEO در Company A | مجاز |
| COMPANY_A_CEO در Company B | 403 یا عدم افشای وجود resource |
| SALES_MANAGER در sales domain شرکت خودش | مجاز با sales permission |
| SALES_MANAGER در finance یا HR domain | رد |
| هر actor با company B در URL، ID، body یا query | membership معتبر لازم است |
| DATA_ENTRY روی KPI assigned | submit مجاز؛ approve رد |
| PMO روی action | review/request correction/escalate مجاز؛ تغییر owner/deadline/close بدون approval رد |
| export، search، dashboard یا فایل بین شرکت‌ها | رد و بدون metadata نشت‌یافته |
| token منقضی/revoked یا membership غیرفعال | رد |
| unknown permission یا scope خالی | deny-by-default |
| sensitive mutation | audit شامل actor، زمان، tenant، old/new و reason |

## تست‌های موجود در repository

- apps/api/src/module/auth/runtime/auth.integration.spec.ts
- apps/api/src/module/authorization/authorization.spec.ts
- apps/api/src/module/kpi-management/kpi-management.service.spec.ts
- apps/api/src/module/shared-business-rules.spec.ts
- top-level /modules نیز برای Auth/Role/Permission guard و domain تست دارد، اما مسیر آن در build فعال API وارد نشده است.

در زمان ممیزی Phase 1 هیچ تستی اجرا نشده بود؛ نتیجه‌ی بررسی‌های Phase 2 در بخش پذیرش PostgreSQL پایین‌تر ثبت شده است.
## Phase 2 PostgreSQL tenant-isolation acceptance

Invitation lifecycle checks additionally cover hashed bearer tokens, matching registered mobile, one-time consumption, expiration/revocation guards, and rejection when a role's current grants exceed the invitation-time audit snapshot. Invitation role assignment is constrained to non-system roles within the company and the delegator's current permission/scope. Acceptance records recipient, time, tenant scope, role, and granted permissions in the audit log.

- Automated check: `npm run phase2:db-check`.
- The check verifies active Company listing is restricted to the requested Company; Holding listings exclude Companies from other Holdings; Branch and Business Unit lookup rejects resources owned by another Company; Membership listing respects Holding and Company boundaries.
- Fixtures are created inside a single PostgreSQL transaction and rolled back, leaving no test data behind.
- Current run: passed on 2026-10-09. Scope/delegation unit tests also confirm a branch or Business Unit manager cannot act across sibling scopes or expand to a broader Company scope.
