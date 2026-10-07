# طرح ماژول‌بندی و Monorepo

## اصل انتقال

مرجع رفتار، routeها و viewهای Laravel موجود در [inventory.md](./inventory.md) هستند؛ مقصد Next.js فعلی در `smartmanager/` قرار دارد، Drizzle و PostgreSQL driver دارد، اما NestJS هنوز اضافه نشده است. هدف، حفظ قرارداد ورودی/خروجی، مجوزها و ظاهر RTL است. برای هر قابلیت باید route، FormRequest rules، Gate/capability، scope واحد، حالت‌های صفحه و اثر جانبی فعلی مشخص و پیش از تغییر API ثبت شود.

هر feature به Nest controller، DTO/validation، application/domain service، authorization policy/guard و persistence access تقسیم شود. Controller فقط HTTP orchestration کند. UI تمام متن‌ها، labelها، flash/status/error، فرم و modal، pagination، فیلتر query، confirmation، download و مسیر برگشت فعلی را پوشش دهد. عنوان ماژول‌ها مالک داده و قراردادهای بین‌ماژولی را مشخص می‌کند.

## مرزبندی ماژول‌ها

| ماژول | مسئولیت و قابلیت‌های موجود | دادهٔ اصلی | وابستگی‌ها |
|---|---|---|---|
| Auth & Setup | اولین مدیر؛ ورود/خروج؛ reset رمز با OTP؛ 2FA؛ ثبت‌نام approval/open/closed؛ pending approval؛ sessions، throttling، account lockout | `users`, `otp_challenges`, `password_reset_tokens`, `sessions` | Users، SMS transport، Security |
| Users & Profile | مدیریت کاربران؛ approve/suspend؛ پروفایل؛ رمز؛ avatar؛ نقش، واحد و access-level assignment | `users`, avatar files | Auth، Authorization، Organizations |
| Authorization | permission registry؛ role→permission grants؛ named access level→permission pack؛ admin shortcut و capability checks | `role_permissions`, `access_levels`, `access_level_permissions` | Auth، Organizations |
| Organizations | واحدها، مدیر واحد، title کاربر، department scoped reads/writes و منع دسترسی کاربر بدون واحد | `departments`, `users.department_id` | Users، Authorization |
| Settings & Branding | نام سازمان و logo، تنظیمات عمومی، مدیریت نقش‌ها و presentation تنظیمات | `site_settings`, logo file | Authorization |
| Dashboard | ترکیب KPI/actions/alerts و widgetهای هر ماژول | read models | KPI، Actions، قرارداد module contributions |
| Inbox & Audit | اعلان شخصی؛ خوانده/نخوانده، read-all؛ رخداد login/failure/lockout/logout/module و cleanup دوره‌ای | `inbox_notifications`, `audit_logs` | Auth، event contracts |
| Module Platform | manifests، فهرست فعال‌ها، lifecycle، archive install، version/dependency، migration، hooks، navigation، dashboard widget، settings tab، overlays | `modules` و schema اختصاصی | Authorization، Security، Audit، فایل‌ها |
| KPI Management | تعریف/ویرایش شاخص، catalog و Studio option، owner/reporter، ورودی دوره‌ای، سلامت، check-in، inbox، dashboard، گزارش هفتگی و XLSX | `kpi_management_kpis`, `kpi_management_values`, `kpi_management_checkins`, `kpi_studio_options` | Organizations، Inbox، Audit، رویدادها |
| Corrective Actions | دریافت KPI red event؛ alert، acknowledge/resolve، تخصیص owner/department، اقدام و status board، priorities، dashboard/weekly aggregation | `corrective_alerts`, `corrective_actions`, `action_priorities` | KPI event، Organizations، Inbox، Audit |
| SMS IPPanel Hub | نگهداری encrypted API key و sender، ارسال pattern، اعتبار/account identity، daily quota برای test، adapter کد OTP | `sms_ippanel_settings`, `sms_ippanel_credit_alerts`, `sms_ippanel_send_counters` | outbound HTTP، Auth/OTP، Security |
| Shared UI & localization | shell اصلی، side/header/footer، table/modal/form/alerts، fonts/icon assets، fa/RTL، ارقام فارسی و تقویم جلالی | — | همهٔ صفحات Next |

## ترتیب اجرایی پیشنهادی پس از تأیید

1. **خط مبنای محصول:** تثبیت آخرین dump و موارد خارج از آن؛ فهرست route→permission→scope→request rules؛ seed، فعال‌بودن ماژول‌ها، modal/form state، response/redirect و تصاویر صفحات مرجع. سطح دسترسی هر route را با دادهٔ نماینده ثبت کنید.
2. **Monorepo و schema:** workspace tooling، package DB، PostgreSQL schema Drizzle/migrations و staging؛ import آزمایشی، بررسی unique/FK/encoding/countها و رفتار decimal/date/JSON پیش از انتقال واقعی.
3. **Auth، permissions و سازمان:** ابتدا session/cookie/CSRF/rate-limit، setup-first-admin، OTP/2FA/reset، approval، role/access-level capability و department guard؛ تست دسترسی باید شامل user بلاوحده و cross-department باشد.
4. **Next design shell:** نگه‌داشتن RTL، فونت و asset اصلی؛ بازسازی layout در React، تبدیل forms/alerts/modal/pagination، مقایسهٔ screenshotهای viewport و حالت‌های خطا/خالی/بارگذاری با Blade.
5. **Users, profile, settings, admin:** مدیریت کاربران، فایل avatar/logo، گزارش audit، مدیریت department, access level, role permission و چرخهٔ ماژول‌ها.
6. **Inbox و module contracts:** notification ownership/read semantics، pruning، audit events؛ به‌جای اجرای کد PHP افزونه در runtime جدید، extension contract و lifecycle جاوااسکریپت محدود/نسخه‌بندی‌شده تعریف شود.
7. **KPI → corrective actions:** تقویم Jalali و شاخص/health/check-in/report؛ سپس رویداد red به alert یکتا برای KPI/period، notification و action board. transaction، race، idempotency و triggerهای هفتگی بررسی شوند.
8. **SMS adapter:** نگاشت API IPPanel، پاک‌سازی شماره/پارامتر، quota تست و OTP؛ migration امن credentialها و امکان rollback کلید encryption پیش از cutover روشن شود.
9. **Cutover:** مقایسهٔ read-only/dual-run در staging، data reconciliation، asset/storage delivery، regression کامل route/permission و screenshot؛ freeze/sync/cutover/rollback و دورهٔ نگهداشت legacy را با مالک محصول تعیین کنید.

## پیشنهاد ساختار Monorepo زیر `smartmanager/`

```text
smartmanager/
  apps/
    web/                       # Next.js App Router؛ UI منتقل‌شده از src/app فعلی
    api/                       # NestJS REST API
  packages/
    db/                        # Drizzle schema، postgres connection، migrations، seeds
    contracts/                 # DTO/OpenAPI contract، schema validation، permission keys
    ui/                        # primitives مشترک React، در صورت نیاز واقعی
    config/                    # تنظیمات مشترک TypeScript/format در صورت نیاز
  docs/
    migration/                 # موجودی، طرح ماژول‌ها و ریسک‌ها
  package.json                # workspace root
  lockfile                    # lock واحد برای package manager منتخب
  tsconfig.base.json
```

این شکل مقصد پیشنهادی است، نه تغییرات انجام‌شده. چون `smartmanager/` از قبل package و app ریشهٔ Next دارد، دو مسیر تصمیمی وجود دارد: app را فعلاً در ریشه نگه دارید و API/packages را اضافه کنید؛ یا بعد از انتخاب workspace، Next را به `apps/web` منتقل کنید. گزینهٔ نخست کم‌تغییرترین شروع است. انتخاب pnpm/npm workspaces و orchestration مثل Turborepo/Nx را بر اساس CI، deployment و تجربهٔ تیم انجام دهید.

`packages/db` مالک schema و migrations باشد و connection فقط در Nest/server process ساخته شود؛ هیچ مرورگری مستقیم به PostgreSQL دسترسی نداشته باشد. Nest مالک تمام writeها و policyهای authorization باشد. `packages/contracts` به پیاده‌سازی database یا React وابسته نشود. `packages/ui` تنها برای اجزای React مشترک است؛ domain serviceها با UI مشترک نشوند. Next از API با قرارداد پایدار استفاده کند؛ در صورت same-origin reverse proxy، cookie و CSRF flow در مرز proxy مستند شود.

## داده و مالکیت migration

- Core business: users, departments, access levels + permissions, modules, site settings, audit, inbox, OTP. KPI و corrective action هر یک schema/domain جدا ولی event-mediated رابطه دارند. SMS data در dump الحالي نیست و باید شمول آن قبل migration تعیین شود.
- جداول `cache`, `cache_locks`, `jobs`, `job_batches`, `failed_jobs`, `sessions`, `password_reset_tokens`, `migrations` جزئی از زیرساخت Laravel هستند؛ جایگزین‌های runtime مقصد را انتخاب کنید، نه اینکه بی‌بررسی payload/TTL آن‌ها را دادهٔ دامنه محسوب کنید.
- نگاشت جدول/ستون و FK از migrations + dump مرجع بگیرد. پیکربندی unique/null/delete actions، JSON fields و Jalali period عمداً در schema Drizzle تعریف شوند.
- migration history Laravel را مستقیم در ledger Drizzle وارد نکنید. منبع migration و batchها را به‌عنوان audit/mapping ثبت کنید؛ ledger مقصد schema تازه را مدیریت کند. پاک‌کردن جداول قدیمی فقط پس از تایید کارکرد queue/session/cache/reset در production.
- seed/بيانات اولیهٔ modules, access grants, action priority, KPI studio option, administrator, site settings و approval status را با مالک داده مقایسه کنید؛ دمو/seed نباید production rowها را ناخواسته overwrite کند.

## قابلیت‌هایی که نیازمند تصمیم محصول‌اند

سیستم فعلی می‌تواند archive ماژول upload و migration PHP را اجرا کند. Nest نمی‌تواند provider/view PHP را در همان runtime اجرا کند. پیش از حذف یا بازطراحی، تصمیم بگیرید قابلیت نصب/فعال‌سازی ماژول توسط مدیر باید با plug-in قرارداد Node جدید ادامه یابد، به build-time extension تبدیل شود، یا از scope خارج شود. فهرست ماژول‌های موجود: `CorrectiveActions`, `KpiManagement`, `SmsIppanelHub`؛ دو مورد نخست در cache ZIP فعال نشان داده شده‌اند، وضع سومی از snapshot dump معلوم نیست.
