# گزارش Phase 1 — ممیزی Smart Manager

**تاریخ:** 2026-10-08
**دامنه:** بررسی repository و مستندسازی معماری سیستم فعلی و مقصد
**وضعیت کار:** فقط اسناد؛ runtime، schema و dependency تغییر نکرده‌اند.

## Current Architecture

Web در Next.js App Router و src/app است. route گروه‌های auth و workspace وجود دارند؛ بخش زیادی از workspace از مسیر catch-all و route-catalog استفاده می‌کند. API client در src/lib/api.ts envelope پاسخ Nest را باز می‌کند.

API در apps/api/src با NestJS و Fastify است. main.ts cookie، helmet و multipart را ثبت می‌کند، prefix /api و Swagger /api/docs دارد. AppModule ماژول‌های Auth، Authorization، Users، Organizations، KPI Management، Corrective Actions، Dashboard، Data، Inbox/Audit، Settings، Module Platform و SMS را فعال می‌کند. CoreModule validation، exception filter، response interceptor و ترجمه‌ی پاسخ را ثبت می‌کند.

داده در PostgreSQL از Drizzle استفاده می‌کند. convention پروژه Controller/Service/Repository است؛ queryها در Repository هستند، هرچند بعضی repositoryهای KPI و Corrective Actions اکنون بخشی از workflow و authorization را هم اجرا می‌کنند.

## Target Architecture

Holding → Company → Branch → Business Unit. User هویت سراسری دارد و Membership نقش و scope سازمانی را نگه می‌دارد. AuthContext معتبر در API، authorization.can(context, permission, resource) و queryهای scoped، مرز داده را از request تا Repository اعمال می‌کنند. تفصیل در target-architecture.md و multitenancy.md است.

## Current Auth

Session cookie فعلی در apps/api/src/common/session.service.ts ساخته و در جدول sessions نگهداری می‌شود. SessionGuard user تأییدشده را به request اضافه می‌کند. جزئیات، عمر session، 2FA و JWT هدف در jwt.md مستند شده است.

## Current Authorization

runtime در apps/api/src/module/authorization است: admin/user، knownPermissions/aliases، role_permissions رشته‌ای، access_levels و access_level_permissions. Department scope در مجوز و queryهای دامنه استفاده می‌شود. کنترل‌ها بین controller، service و repository پخش شده‌اند.

## Current Tenant Boundary

schema و API فعال company/holding/membership ندارند. Department فقط محدوده‌ی فعلی است و در چندشرکتی جایگزین Company نیست. هیچ TenantContext مرکزی مشاهده نشد.

## Current KPI Architecture

KPI definitions به department متصل‌اند. KPI Management repository تعریف‌ها، check-in، period و dashboard query را اجرا می‌کند. Check-ins با KPI رابطه دارند. Permission و ownership checks در controller/repository توزیع شده‌اند.

## Current Dashboard Architecture

DashboardController سه route snapshot دارد: عمومی، KPI و Actions. DashboardService و DashboardRepository شمارش KPI، red KPI، alert، action و inbox را از جدول‌های فعال محاسبه می‌کنند. Scope عمومی عمدتاً Department/global است؛ Company scope وجود ندارد.

## Current module location

All active API feature modules and the retained Auth/Role/Permission boilerplate live under `apps/api/src/module`. Runtime modules are registered from `apps/api/src/app.module.ts`; legacy template files remain available as examples but are excluded from runtime compilation. The repository-root `/modules` directory has been removed.

## Files inspected

- Frontend: src/app routes، workspace shell/pages، route-catalog، src/lib/api.ts، layout و tasks.md.
- API bootstrap: apps/api/src/main.ts، app.module.ts، core module، database module/token، common/session service/guard/repository.
- Active domains: controllers، services، repositories، DTOها و moduleهای auth، authorization، users، organizations، KPI management، corrective actions، dashboard، data، inbox/audit، settings، module platform و SMS.
- Database: src/db/schema.ts و Drizzle configuration.
- Auth/RBAC source: فایل‌های top-level modules/auth، modules/roles و modules/permissions، به‌همراه domainها، guards، decorators، repositories و tests.
- Project setup: package manifests، Nest/TypeScript config، Dockerfile، compose.yaml و scripts.
- Tests: API test inventory و specs موجود در /modules.

## Files requiring refactor

1. apps/api/src/module/auth، apps/api/src/module/roles، apps/api/src/module/permissions: هم‌ترازکردن با Smart Manager user model و Drizzle persistence و اتصال به API runtime.
2. API Auth/Authorization: تعریف AuthContext، dynamic roles، permissions و company switch از منبع واحد.
3. Organization schema/API: Holding/Company/Branch/Business Unit/Membership و routeهای مربوط.
4. KPI/Actions/Alerts/Dashboard/Data repositories: tenant/domain scope در تمام queryها.
5. Search/export/files/inbox/audit: پوشش scope مشترک پیش از ارائه‌ی endpointهای جدید.
6. Frontend: company switcher و مسیرهای Holding/Company با routeهای فعلی سازگار شوند.

## Security risks

- عدم وجود tenant isolation؛ departmentId جایگزین مرز شرکت شده است.
- Admin bypass و دو مدل هم‌زمان Auth/RBAC.
- query scope نابرابر بین collectionها؛ priorityها سراسری هستند.
- dashboard routeها در همه‌ی عملیات permission مستقل و tenant-aware ندارند.
- report/export API مجزا در inventory فعلی پیدا نشد؛ هر قابلیت جدید نیازمند authorization یکسان است.
- عملیات حساس همه به شکل یکنواخت audit نمی‌شوند؛ actorName ثابت در برخی writeها دیده شده است.

## Backward compatibility risks

- API و frontend به cookie session فعلی وابسته‌اند؛ تغییر auth contract باید با clientهای موجود هماهنگ باشد.
- users.role، departmentId و accessLevelId در frontend/API فعلی استفاده می‌شوند.
- تغییر permission key روی aliasها و داده‌ی role_permissions اثر دارد.
- department-based KPI/action queryها باید با ساختار Company/Unit سازگار شوند.
- routeهای workspace از catch-all استفاده می‌کنند؛ مسیرهای Holding و Company باید بدون شکستن navigation فعلی اضافه شوند.

## Files created or refreshed

- docs/architecture/target-architecture.md
- docs/architecture/multitenancy.md
- docs/architecture/authorization.md
- docs/architecture/jwt.md
- docs/architecture/implementation-roadmap.md
- docs/architecture/phase1-audit.md
- README.md (راهنمای فعلی پروژه)
- docs/testing/security-matrix.md

## Files modified in this Phase 1 review

اسناد معماری و README به‌روزرسانی شدند. در این بازبینی کد، schema، package manifests و runtime تغییر نکردند.

## Tests and Build

- Tests executed: none؛ این تحویل فقط audit و documentation است.
- Build: اجرا نشد.

## PHASE STATUS: PASS

این وضعیت به معنی تکمیل ممیزی و اسناد Phase 1 است. هیچ قابلیت Phase 2 در این مرحله پیاده‌سازی نشده است.