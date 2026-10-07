# موجودی مخزن و سامانهٔ مبدأ

## محدوده و مبنا

مقصد کاری این مخزن در `smartmanager/` است. Laravel مبدأ از `E:\smarlux\well-known (1).zip` درجا خوانده شد (بدون استخراج)؛ ساختار داده از `E:\smarlux\dibaitco_smart_manager.sql` خوانده شد. dump header آن MariaDB 11.4.12 و تاریخ تولید ۴ اکتبر ۲۰۲۶ را ذکر می‌کند. در گزارش، فایل‌های `vendor/` و viewهای خود framework از inventory برنامه جدا هستند. محتوای secretها و سطرهای حاوی اطلاعات شخصی از این گزارش حذف شده است.

## وضعیت مقصد

- `smartmanager/` یک Next.js App Router تازه با React، TypeScript، Tailwind، Drizzle ORM و driver `postgres` است؛ NestJS هنوز در آن وجود ندارد.
- `src/app/page.tsx` صفحهٔ نمونهٔ Create Next App است. `src/app/layout.tsx` عنوان نمونه، زبان `en` و فونت Geist دارد؛ `src/app/globals.css` تم پایهٔ نمونه را تعریف می‌کند. این ظاهر معادل پنل فارسی RTL مبدأ نیست.
- وابستگی‌های runtime فعلی: `next` 16.4.0، `react`/`react-dom` 19.3.0، `drizzle-orm`، `postgres`، `dotenv`. ابزارها شامل `drizzle-kit`، TypeScript، Biome، Tailwind و `tsx` هستند.
- در checkout جاری `smartmanager/package.json` و `smartmanager/package-lock.json` از قبل modified بوده‌اند. این تغییرها را به کار Phase 0 نسبت ندهید؛ وضعیت Git آن‌ها باید در مراحل بعد حفظ شود.

## Routes

`routes/web.php`, `routes/auth.php`, `routes/admin.php` و routeهای سه ماژول زیر بررسی شدند. prefix `api` به‌طور قراردادی در loader ماژول پشتیبانی می‌شود، اما `routes/api.php` در ZIP موجود نیست و هیچ‌یک از ماژول‌ها `routes/api.php` ندارد. Nest باید JSON API تازه‌ای معرفی کند؛ مسیرهای جدول، رفتار قابل‌مشاهدهٔ فعلی هستند. `/up` نیز توسط bootstrap لاراول ثبت شده است. تمام مسیرهای داخل ماژول از middleware پیش‌فرض web/auth/approved به‌ارث می‌برند، مگر مسیر auth/setup استثنا باشد.

| Verb | Path | منبع | قابلیت/قید مهم |
|---|---|---|---|
| GET | `/` | routes/web.php | هدایت به dashboard یا login |
| GET | `/dashboard`, `/settings` | routes/web.php | auth + approved |
| PUT | `/settings/general` | routes/web.php | manage-settings، ۲۰ در دقیقه |
| GET | `/branding/logo` | routes/web.php | ۶۰ در دقیقه |
| GET, PUT | `/profile` | routes/web.php | profile، ۳۰ در دقیقه |
| GET | `/profile/photo`, `/profile/security` | routes/web.php | profile |
| POST, DELETE | `/profile/avatar` | routes/web.php | upload: ۱۰ در دقیقه؛ delete |
| PUT | `/profile/password` | routes/web.php | تغییر رمز |
| GET | `/avatars/{user}` | routes/web.php | ۶۰ در دقیقه |
| POST | `/inbox/read`, `/inbox/read-all` | routes/web.php | اعلان جاری کاربر، ۶۰ در دقیقه |
| GET, POST | `/setup` | routes/auth.php | guest + setup.pending؛ POST: ۱۰ در دقیقه |
| GET, POST | `/login` | routes/auth.php | guest + setup.completed؛ POST: ۲۰ در دقیقه |
| GET, POST | `/register` | routes/auth.php | guest + setup.completed + registration.open؛ POST: ۱۰ در دقیقه |
| GET, POST | `/forgot-password` | routes/auth.php | OTP؛ POST: ۵ در دقیقه |
| GET, POST | `/reset-password` | routes/auth.php | OTP؛ POST: ۱۰ در دقیقه |
| GET, POST | `/two-factor` | routes/auth.php | challenge؛ POST: ۱۰ در دقیقه |
| POST | `/two-factor/resend`, `/two-factor/cancel` | routes/auth.php | resend: ۵ در دقیقه |
| GET | `/approval-pending` | routes/auth.php | auth، قابل دسترسی برای کاربر تأییدنشده |
| POST | `/logout` | routes/auth.php | auth |
| GET, POST | `/admin/modules`, `/admin/modules/install` | routes/admin.php | manage-modules |
| POST, DELETE | `/admin/modules/{module}/activate`, `/deactivate`, `/upgrade`, `/{module}` | routes/admin.php | manage-modules |
| GET, POST | `/admin/users` | routes/admin.php | manage-users؛ POST محدودشده |
| POST | `/admin/users/{user}/approve`, `/suspend` | routes/admin.php | manage-users |
| PUT | `/admin/users/{user}/role`, `/access-level`, `/organization` | routes/admin.php | manage-users |
| GET, POST | `/admin/departments` | routes/admin.php | manage-departments |
| PUT, DELETE | `/admin/departments/{department}` | routes/admin.php | manage-departments |
| GET | `/admin/roles` | routes/admin.php | manage-roles |
| GET, POST | `/admin/access-levels/create`, `/admin/access-levels` | routes/admin.php | manage-roles |
| GET, PUT, DELETE | `/admin/access-levels/{accessLevel}/edit`, `/admin/access-levels/{accessLevel}` | routes/admin.php | manage-roles |
| GET | `/admin/audit-log` | routes/admin.php | view-audit-log |
| GET | `/alerts` | CorrectiveActions | alerts.view |
| POST | `/alerts/{alert}/ack`, `/alerts/{alert}/resolve` | CorrectiveActions | alerts.acknowledge / alerts.resolve |
| GET, POST | `/actions` | CorrectiveActions | actions.view / actions.manage |
| PUT | `/actions/{actionItem}/status` | CorrectiveActions | authorization در ActionBoard service |
| POST, PUT, DELETE | `/settings/action-priorities[/{actionPriority}]` | CorrectiveActions | manage-settings |
| GET | `/checkins` | KpiManagement | ورود تأییدشده، ۶۰ در دقیقه |
| GET | `/kpi-reports/weekly`, `/kpi-reports/weekly.xlsx` | KpiManagement | kpi.manage؛ دانلود محدود به ۲۰ در دقیقه |
| GET | `/kpis`, `/kpis/create`, `/kpis/{kpi}`, `/kpis/{kpi}/edit` | KpiManagement | kpi.view / kpi.manage |
| POST | `/kpis`, `/kpis/{kpi}/checkins` | KpiManagement | kpi.manage / kpi.view؛ check-in محدودشده |
| PUT | `/kpis/{kpi}` | KpiManagement | kpi.manage |
| POST, PUT, DELETE | `/settings/kpi-options[/{kpiStudioOption}]` | KpiManagement | manage-settings |
| GET, PUT | `/sms-ippanel-hub`, `/sms-ippanel-hub/settings` | SmsIppanelHub | manage-modules |
| POST | `/sms-ippanel-hub/test`, `/sms-ippanel-hub/credit/refresh` | SmsIppanelHub | manage-modules؛ rate limit |

`routes/admin.php` حاوی middleware مجوز per-capability است. ثبت‌های فوق declarationهای کاربر هستند، نه یک API فعلی. مسیر model-binding، redirectها، query filters و پاسخ‌های Blade نیز بخشی از قرارداد مهاجرت‌اند.

## Controllers، requests و models

### کنترلرها (۲۶)

- `app/Http/Controllers/`: Controller, DashboardController, ProfileController, SettingsController.
- `app/Http/Controllers/Admin/`: AccessLevelController, AuditLogController, DepartmentController, GeneralSettingsController, ModuleController, RoleController, UserController.
- `app/Http/Controllers/Auth/`: AdminSetupController, ApprovalPendingController, AuthenticatedSessionController, PasswordResetController, RegisteredUserController, TwoFactorChallengeController.
- `app/Http/Controllers/Inbox/`: NotificationController.
- `modules/CorrectiveActions/src/Http/Controllers/`: ActionController, ActionPriorityController, AlertController.
- `modules/KpiManagement/src/Http/Controllers/`: CheckinInboxController, KpiController, KpiStudioOptionController, WeeklyReportController.
- `modules/SmsIppanelHub/src/Http/Controllers/`: SmsIppanelHubController.

### Form requests و validation (۳۳)

- `app/Http/Requests/Admin/`: AssignUserOrganizationRequest, InstallModuleRequest, StoreAccessLevelRequest, StoreAdminUserRequest, StoreDepartmentRequest, UpdateAccessLevelRequest, UpdateDepartmentRequest, UpdateGeneralSettingsRequest, UpdateRolePermissionsRequest, UpdateUserAccessLevelRequest, UpdateUserRoleRequest.
- `app/Http/Requests/Auth/`: AdminSetupRequest, LoginRequest, RegisterRequest, RequestPasswordResetRequest, ResetPasswordRequest, TwoFactorChallengeRequest.
- `app/Http/Requests/Concerns/NormalizesPersianInput.php`؛ `app/Http/Requests/Inbox/MarkNotificationReadRequest.php`.
- `app/Http/Requests/Profile/`: UpdateAvatarRequest, UpdatePasswordRequest, UpdateProfileRequest.
- `modules/CorrectiveActions/src/Http/Requests/`: StoreActionPriorityRequest, StoreActionRequest, UpdateActionPriorityRequest, UpdateActionStatusRequest.
- `modules/KpiManagement/src/Http/Requests/`: StoreKpiRequest, StoreKpiStudioOptionRequest, SubmitCheckinRequest, UpdateKpiRequest, UpdateKpiStudioOptionRequest.
- `modules/SmsIppanelHub/src/Http/Requests/`: SendTestSmsRequest, UpdateSettingsRequest.

اعتبارسنجی مهم شامل mobile و password، کد ملی، تاریخ شمسی، مجوزهای قابل‌انتخاب، تصویر avatar/logo، CSV/archive نصب ماژول، KPI numeric thresholds و دوره، و pattern/params/شمارهٔ گیرندهٔ SMS است. ruleهای کامل در source هر request قرار دارد.

### مدل‌های Eloquent (۱۸)

- `app/Models/`: AccessLevel, AccessLevelPermission, AuditLog, Department, InboxNotification, InstalledModule, SiteSetting, User.
- `modules/CorrectiveActions/src/Models/`: ActionItem, ActionPriorityOption, Alert.
- `modules/KpiManagement/src/Models/`: KpiCheckin, KpiDefinition, KpiStudioOption, KpiValue.
- `modules/SmsIppanelHub/src/Models/`: CreditAlertState, SendCounter, Setting.

### منطق دامنه و services (۱۷ فایل services به‌علاوهٔ دامنه)

- setup/auth: `app/Actions/Auth/{ProvisionFirstAdmin,RegisterUser}.php`, `app/Auth/TwoFactorPolicy.php`, `app/Auth/TwoFactorSession.php`, `app/Auth/Otp/OtpService.php`, `app/Services/SetupService.php`.
- authorization: `app/Authorization/{AccessLevelCatalog,CorePermissions,Permission,PermissionRegistry,RoleGrants}.php`.
- organization/profile: `app/Organization/{DepartmentAccess,DepartmentCode,DepartmentDirectory}.php`, `app/Profile/AvatarKeeper.php`.
- audit/inbox: `app/Audit/AuditRecorder.php`, `app/Inbox/{InboxSnapshot,NotificationInbox,NotificationType,SafeInternalHref}.php`.
- module platform: `app/Modules/` شامل registry/manifest/loader/installer/manager/migrator/state، hooks، navigation، widget/overlay/settings-tab collectors، lifecycle events و exceptions.
- CorrectiveActions: ActionBoard, ActionPriorityCatalog, AlertOpener, CorrectiveDashboardSnapshot.
- KpiManagement: CheckinBoard, CheckinWriter, EloquentKpiCatalog, KpiDashboardSnapshot, KpiStudioCatalog, KpiWriter, WeeklyBrief؛ health/code/period/XLSX helpers در `Support/`.
- SmsIppanelHub: CreditService, IppanelClient, PatternSmsService, SmsOtpTransport, TestSendQuota؛ PhoneNormalizer و exception/contractهای ماژول.

### Blade views (۶۷ view برنامه)

- `resources/views/admin/`: access-levels/form; audit/index; departments/index; modules/index + partials/install-modal; users/index + modal.
- `resources/views/auth/`: approval-pending, forgot-password, login, register, reset-password, setup, two-factor.
- `resources/views/components/`: alert/{error,errors,status}; form/{input,jalali-date,password,textarea}; modules/action; navigation/menu-item; user/avatar.
- هسته: dashboard/index; layouts/{app,auth}; pagination/sm; partials/{footer,head,header,inbox-bell,overlays,pager,scripts,sidebar}; profile/{edit,photo,security,partials/aside}; settings/{about,general,index,roles}.
- CorrectiveActions: actions/{index,modal}; alerts/index; settings/priorities; widgets/{priorities,stat,team-actions}.
- KpiManagement: checkins/{index,modal}; kpis/{create,edit,index,modal,show,partials/form}; reports/weekly; settings/studio; widgets/{health,my-checkins,stat}.
- SmsIppanelHub: settings; partials/credit-alert; widgets/credit.

منابع ظاهر در ZIP شامل Dashlite RTL/theme، Bootstrap-based JS bundle، Quill/Jalali datepicker، icon/font bundles، چند خانواده فونت فارسی (YekanBakh، Dana، Peyda، IRANYekanX، Doran)، لوگوها و تصاویر محصول/داشبورد است. shell اصلی در `layouts/app.blade.php` و `layouts/auth.blade.php` است؛ header، sidebar، footer، bell، overlays، modal، alert، pagination و تاریخ شمسی در partial/componentها قرار دارند.

## جداول، migrations و روابط

مجموع ۲۵ جدول در dump دیده می‌شود:

| حوزه | جدول‌ها |
|---|---|
| هویت و سازمان | `users` (first/last/mobile/national_code/birth_date/address/avatar/password/role/access_level_id/department_id/job_title/approval)، `departments`، `access_levels`، `access_level_permissions`، `role_permissions` |
| ماژول‌ها و تنظیمات | `modules`، `site_settings`، `audit_logs`، `inbox_notifications`، `otp_challenges` |
| KPI | `kpi_management_kpis`، `kpi_management_values`، `kpi_management_checkins`، `kpi_studio_options` |
| اقدام اصلاحی | `corrective_alerts`، `corrective_actions`، `action_priorities` |
| زیرساخت Laravel | `password_reset_tokens`، `sessions`، `cache`، `cache_locks`، `jobs`، `job_batches`، `failed_jobs`، `migrations` |
| SMS | در dump حاضر نیست؛ در source migrations جدول‌های `sms_ippanel_settings`, `sms_ippanel_credit_alerts`, `sms_ippanel_send_counters` تعریف شده‌اند |

### فهرست ستون‌های dump

این column inventory از هر `CREATE TABLE` استخراج شده و snapshot فعلی SQL را توصیف می‌کند؛ جزئیات type، nullability، default، index و FK در SQL و migration مبدأ تعیین می‌شود.

| جدول | ستون‌ها |
|---|---|
| `access_levels` | `id`, `name`, `department_id`, `created_at`, `updated_at` |
| `access_level_permissions` | `id`, `access_level_id`, `permission` |
| `action_priorities` | `id`, `name`, `position`, `created_at`, `updated_at` |
| `audit_logs` | `id`, `user_id`, `actor_name`, `action`, `subject_type`, `subject_id`, `description`, `context`, `ip_address`, `user_agent`, `created_at` |
| `cache` | `key`, `value`, `expiration` |
| `cache_locks` | `key`, `owner`, `expiration` |
| `corrective_actions` | `id`, `department_id`, `alert_id`, `title`, `description`, `success_metric`, `owner_user_id`, `created_by`, `status`, `priority`, `due_at`, `created_at`, `updated_at` |
| `corrective_alerts` | `id`, `department_id`, `kpi_id`, `period`, `title`, `description`, `severity`, `status`, `assigned_to`, `acknowledged_at`, `acknowledged_by`, `resolved_at`, `resolved_by`, `resolution_note`, `due_at`, `created_at`, `updated_at` |
| `departments` | `id`, `name`, `code`, `manager_user_id`, `created_at`, `updated_at` |
| `failed_jobs` | `id`, `uuid`, `connection`, `queue`, `payload`, `exception`, `failed_at` |
| `inbox_notifications` | `id`, `user_id`, `type`, `title`, `body`, `href`, `read_at`, `created_at`, `updated_at` |
| `jobs` | `id`, `queue`, `payload`, `attempts`, `reserved_at`, `available_at`, `created_at` |
| `job_batches` | `id`, `name`, `total_jobs`, `pending_jobs`, `failed_jobs`, `failed_job_ids`, `options`, `cancelled_at`, `created_at`, `finished_at` |
| `kpi_management_checkins` | `id`, `kpi_id`, `user_id`, `period`, `status`, `data_json`, `actual_value`, `note`, `blockers`, `submitted_at`, `revised_at`, `created_at`, `updated_at` |
| `kpi_management_kpis` | `id`, `department_id`, `code`, `name`, `description`, `category`, `unit`, `direction`, `target_value`, `warning_value`, `critical_value`, `owner_user_id`, `reporter_user_id`, `frequency`, `input_mode`, `input_fields`, `active`, `weight`, `created_at`, `updated_at` |
| `kpi_management_values` | `id`, `kpi_id`, `period`, `actual_value`, `target_value`, `status`, `source`, `submitted_by`, `note`, `created_at`, `updated_at` |
| `kpi_studio_options` | `id`, `group`, `name`, `slug`, `position`, `created_at`, `updated_at` |
| `migrations` | `id`, `migration`, `batch` |
| `modules` | `id`, `slug`, `name`, `version`, `is_active`, `settings`, `activated_at`, `created_at`, `updated_at` |
| `otp_challenges` | `id`, `purpose`, `identifier`, `code_hash`, `attempts`, `sent_at`, `expires_at` |
| `password_reset_tokens` | `mobile`, `token`, `created_at` |
| `role_permissions` | `id`, `role`, `permission` |
| `sessions` | `id`, `user_id`, `ip_address`, `user_agent`, `payload`, `last_activity` |
| `site_settings` | `id`, `company_name`, `logo_path`, `created_at`, `updated_at` |
| `users` | `id`, `first_name`, `last_name`, `mobile`, `national_code`, `birth_date`, `address`, `avatar_path`, `password`, `role`, `access_level_id`, `department_id`, `job_title`, `approved_at`, `approved_by`, `remember_token`, `created_at`, `updated_at` |

Source migrationهای SMS دو جدول اول ماژول (settings شامل `id/apikey/sender/timestamps`; credit alerts شامل `id/user_id/threshold/timestamps`) و counter (`id/sent_on/sent_count/timestamps`) را تعریف می‌کنند؛ در dump حاضر هیچ‌یک نیست.

Foreign keyهای اصلی: users→department/access-level/approver؛ department→manager؛ access-level→department و permissions؛ audit→user؛ inbox→user؛ KPIها→department/owner/reporter، checkin/value→KPI/user؛ actions→department/alert/owner/creator؛ alerts→department/assigned/ack/resolved users؛ SMS credit alert→user. on-delete شامل cascade، set-null و default restrict است؛ جزئیات هر FK را در migration و dump مبدأ حفظ کنید.

### Migration files

هسته (۱۴):

- `database/migrations/0001_01_01_000000_create_users_table.php`
- `database/migrations/0001_01_01_000001_create_cache_table.php`
- `database/migrations/0001_01_01_000002_create_jobs_table.php`
- `database/migrations/2026_08_04_000100_create_modules_table.php`
- `database/migrations/2026_08_20_100000_add_approval_columns_to_users_table.php`
- `database/migrations/2026_08_20_100100_create_role_permissions_table.php`
- `database/migrations/2026_08_20_100200_create_otp_challenges_table.php`
- `database/migrations/2026_08_20_110000_create_audit_logs_table.php`
- `database/migrations/2026_08_21_100000_create_departments_table.php`
- `database/migrations/2026_08_21_100100_add_organization_columns_to_users_table.php`
- `database/migrations/2026_08_21_100200_create_inbox_notifications_table.php`
- `database/migrations/2026_08_21_140000_add_avatar_path_to_users_table.php`
- `database/migrations/2026_08_23_220000_create_access_levels_tables.php`
- `database/migrations/2026_08_24_003000_create_site_settings_table.php`

ماژول‌ها (۱۰):

- CorrectiveActions: `2026_08_21_130000_create_corrective_alerts_table.php`, `2026_08_21_130100_create_corrective_actions_table.php`, `2026_08_21_153000_add_success_metric_to_corrective_actions_table.php`, `2026_08_21_160000_create_action_priorities_table.php` در `modules/CorrectiveActions/database/migrations/`.
- KpiManagement: `2026_08_21_120000_create_kpi_management_kpis_table.php`, `2026_08_21_120100_create_kpi_management_values_table.php`, `2026_08_21_120200_create_kpi_management_checkins_table.php`, `2026_08_21_161000_create_kpi_studio_options_table.php` در `modules/KpiManagement/database/migrations/`.
- SmsIppanelHub: `2026_08_04_100000_create_sms_ippanel_settings_table.php`, `2026_08_20_100000_create_sms_ippanel_send_counters_table.php` در `modules/SmsIppanelHub/database/migrations/`.

**اختلاف dump/code:** جدول `migrations` در dump ۲۲ migration را در سه batch نشان می‌دهد: ۱۴ هسته، ۴ KPI و ۴ corrective actions. دو migration SMS (و ۳ جدولش) در این snapshot اعمال نشده‌اند. ZIP نشان می‌دهد KPI و CorrectiveActions در cache ماژول فعالند؛ فعال‌بودن SMS یا کامل‌بودن snapshot از این دو فایل به‌تنهایی نتیجه نمی‌شود. دادهٔ همین dump را آخرین دیتای online فرض نکنید.

## وابستگی‌های Composer

- مستقیم production (`composer.json`): `php ^8.2`, `laravel/framework ^12.0`, `laravel/tinker ^2.10.1`, `morilog/jalali ^3.5`.
- development: `fakerphp/faker ^1.23`, `laravel/pail ^1.2.2`, `laravel/pint ^1.24`, `laravel/sail ^1.41`, `mockery/mockery ^1.6`, `nunomaduro/collision ^8.6`, `phpunit/phpunit ^11.5.50`.
- lockfile versions مؤثر: Laravel framework 12.64.0، Jalali 3.5.0، Guzzle 7.15.2 (transitive)، Carbon 3.13.1؛ Composer lock مجموعاً ۷۸ runtime و ۳۵ development packages دارد.
- درگاه بانکی یا SDK پرداختی در direct composer requirements پیدا نشد. SMS IPPanel پیاده‌سازی ماژولی است و dependency مستقل نیست؛ HTTP requests از Laravel HTTP client/Guzzle می‌گذرند. Password/OTP hashing از Laravel Hash facade/cast می‌آید؛ hashing package مستقیم مجزا نیست. Queue infrastructure tables/config در لاراول هست، ولی package صف مستقل یا domain jobهای سفارشی در فهرست منبع مشاهده‌شده نیست.

## آزمون‌ها و محدودیت پوشش

ZIP دارای تست‌های module-local `modules/CorrectiveActions/tests/CorrectiveActionsTest.php`, `modules/KpiManagement/tests/KpiHealthCalculatorTest.php`, `modules/KpiManagement/tests/KpiManagementTest.php`, `modules/SmsIppanelHub/tests/PhoneNormalizerTest.php`, `modules/SmsIppanelHub/tests/SmsIppanelHubTest.php` است. `phpunit.xml` پوشه‌های `tests/Unit`, `tests/Feature`, `modules/*/tests` را تعریف می‌کند؛ در فهرست archive، suite مستقل core دیده نشد.

این بررسی static فقط بر اساس ZIP و SQL معرفی‌شده است. `.env` عملیاتی، uploads واقعی، filesystem، proxy/CDN، runtime queue/cache/session drivers و تغییرات دیتابیس بعد از dump را اثبات نمی‌کند. SQL ممکن است اطلاعات حساس داشته باشد؛ گزارش فقط schema و اختلاف پوشش را نگه می‌دارد.
