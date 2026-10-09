# Authorization — Phase 1

## وضعیت فعال API

- apps/api/src/module/authorization/authorization.service.ts فهرست ثابت knownPermissions و aliasها را تعریف می‌کند.
- مجوزهای نقش در role_permissions با role رشته‌ای ذخیره می‌شوند؛ Access Levelهای دارای scope بخش و مجوزهایشان در access_levels و access_level_permissions هستند.
- نقش‌های runtime فقط admin/user هستند. AuthorizationRepository برای admin اجازه‌ی عمومی می‌دهد، بدون آن‌که هر permission جداگانه resolve شود.
- AuthorizationService.canAccessDepartment user تأییدشده را در department خودش محدود می‌کند؛ admin یا کاربری با access-all-departments دامنه‌ی وسیع می‌گیرد.
- کنترل دسترسی غالباً ترکیبی از SessionGuard روی controller و بررسی صریح permission در controller/service/repository است؛ decorator/guard مشترک برای همه‌ی عملیات به شکل یکپارچه به کار نرفته است.
- برخی نام‌ها با alias به مجوزهای canonical تبدیل می‌شوند؛ تغییر نام permission نیازمند بررسی همه‌ی aliasها است.

## رابطه‌ی مدل فعلی

| مدل | ارتباط فعلی |
|---|---|
| User | role admin/user، accessLevelId، departmentId و approvedAt دارد |
| Role | مقدار رشته‌ای روی users و کلید role_permissions است |
| Access Level | به‌صورت اختیاری به Department وصل می‌شود و چند مجوز رشته‌ای دارد |
| Permission | در فهرست کد و رشته‌های grant است؛ جدول catalog با FK ندارد |
| Department | مرز اصلی برخی queryهای KPI، alert، action، dashboard و فهرست کاربران است |

این مدل امکان membership چندشرکتی و چند role برای یک user را در scopeهای متفاوت نشان نمی‌دهد.

## پوشش endpointهای مشاهده‌شده

- User و organization: SessionGuard؛ عملیات مدیریتی permission check جداگانه دارد.
- KPI/check-in: SessionGuard و بررسی‌های permission/owner/department در controller یا repository.
- Action/Alert: SessionGuard و کنترل‌های manage/update-own/view/acknowledge/resolve؛ جزئیات هر status و scope باید مستقل بررسی شود.
- Dashboard: SessionGuard و scope department/global؛ permission اختصاصی dashboard در تمام routeها مشاهده نشد.
- Data collection: whitelist و permission map؛ scope repository بین collectionها متفاوت است. Priorityها داده‌ی سراسری‌اند.
- Inbox: notification به userId محدود است.
- Settings، Module Platform و SMS: SessionGuard و بخشی از mutationها permission دارند.
- route مستقل report/export در controller inventory مشاهده نشد؛ avatar و logo مسیرهای binary دارند.

## وضعیت /modules

Top-level /modules دارای role و permission domain، services، decorators و JWT/permission/role guards است. با این حال:

- Permission catalog به ماژول‌های فروشگاهی‌ای ارجاع دارد که در این repository موجود نیستند.
- relational repositories به core/database وصل می‌شوند؛ این مسیر در repository فعلی وجود ندارد.
- Auth در آنجا از phone/isActive و UserRepository متفاوت استفاده می‌کند، درحالی‌که runtime از mobile/approvedAt و Drizzle فعال بهره می‌برد.
- AppModule و tsconfig فعال این modules را بارگذاری/کامپایل نمی‌کنند.

بنابراین /modules هنوز runtime منبع دسترسی نیست. طبق نیازمندی محصول، طراحی Auth/Role/Permission باید در همان ساختار refactor و سپس به runtime متصل شود؛ ساخت authorization موازی دیگری هدف معماری نیست.

## Authorization هدف

API هدف:

authorization.can(authContext, permission, resourceContext)

تصمیم باید هم عمل و هم رکورد را ارزیابی کند:

- permission به‌صورت resource.action و از catalog واحد و پایدار بیاید.
- roleهای پویا به membership و scope سازمانی متصل باشند.
- scopeهای holding/company/branch/businessUnit/own/assigned/domain مستقل و قابل ترکیب باشند.
- queryهای resource بر اساس AuthContext و مالکیت رکورد محدود شوند؛ permission به‌تنهایی کافی نیست.
- نبود context، permission ناشناخته یا scope نامعتبر به deny منجر شود.
- دسترسی اجرایی technical admin از authority تجاری شرکت جدا بماند.
- PMO review/request correction/escalation دارد؛ تغییر owner/deadline و close نیازمند اختیار اجرایی و approval مربوط است.
- API، dashboard، search، files، reports، exports و AI retrieval همگی server-side authorization را اجرا کنند.

## تست‌های لازم برای سیستم هدف

- role × permission × scope برای مجاز/غیرمجاز.
- resource ID متعلق به شرکت دیگر و تغییر company در URL/body/query.
- own/assigned/domain در برابر company/holding scope.
- PMO در برابر KPI owner، manager و Company CEO برای review/approve/close.
- permissions ناشناخته، عضویت غیرفعال و role حذف‌شده.
- consistency در REST، data collection، dashboard، search، export و file.
- اثر تغییر role یا revoke membership بر access token فعال.