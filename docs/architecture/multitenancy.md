# چندشرکتی و مرز Tenant — Phase 1

## وضعیت فعلی

schema فعال در src/db/schema.ts شرکت/holding/branch/business unit یا membership چندشرکتی ندارد. users دارای role، departmentId و accessLevelId است. Department یک محدوده‌ی سازمانی داخلی است؛ به‌تنهایی مرز شرکت محسوب نمی‌شود.

KPI به department متصل است. Check-in از KPI scope می‌گیرد. Alert و Action نیز عموماً departmentId دارند. بعضی queryها در repository با department محدود می‌شوند و مجوز access-all-departments می‌تواند دامنه‌ی وسیع‌تری بدهد. TenantContext یا tenant guard مرکزی در API فعال وجود ندارد.

## مدل مقصد

- Holding: نام، کد، وضعیت، نشان، تقویم، timezone و ارز.
- Company: holdingId، نام/کد، اطلاعات حقوقی، مدیرعامل، ownerهای P&L و داده، reviewer گروه، وضعیت، تقویم و ارز.
- Branch: companyId، نام/کد، manager و وضعیت.
- Business Unit: companyId و در صورت نیاز branchId، نام/کد، manager و وضعیت.
- Membership: userId، holdingId، companyId، branchId، businessUnitId، roleId، scopeType، status و isDefault.
- Identity در users می‌ماند؛ role و سازمان از membership خوانده می‌شوند. عضویت‌های متعدد برای یک user مجازند.

## AuthContext هدف

interface AuthContext {
  userId: string;
  holdingId: string;
  membershipId: string;
  companyId: string | null;
  branchId: string | null;
  businessUnitId: string | null;
  roleIds: string[];
  scopeType: string;
}

این context از JWT معتبر و membership فعال در سمت سرور ساخته می‌شود. Body، route یا query string به‌تنهایی منبع قابل اعتماد برای companyId نیستند.

## مالکیت داده و query scoping

برای هر دامنه باید مالکیت مشخص باشد:

| دامنه | مالکیت پیشنهادی |
|---|---|
| Company profile | company |
| KPI و check-in | company یا business unit؛ طبق تعریف KPI |
| Action و alert | همان company و واحد مربوط به منبع |
| Decision و meeting | company یا holding، با owner مشخص |
| User | هویت سراسری؛ اطلاعات عضویت فقط در scope مجاز |
| Dashboard/report | holding یا company طبق permission |
| Audit/evidence/notification | scope رکورد مبدأ و مجوز actor |
| Integration/cache/job | tenant context و company مربوط |

هر repository باید scope را دریافت کند و query را با company/holding و در صورت نیاز branch/unit محدود کند. lookup بر اساس ID تنها کافی نیست. Scope دامنه‌ای مثل sales یا finance و scope مالکیت مثل own/assigned نیز علاوه بر مرز شرکت اعمال می‌شود.

## قواعد جداسازی

1. درخواست تغییر شرکت، عضویت فعال را از DB validate می‌کند؛ شرکت‌های غیرعضو در selector و API در دسترس نیستند.
2. دسترسی مدیر گروه فقط در holding عضویت خود و با permission گروهی برقرار است.
3. مدیر شرکت A به داده شرکت B دسترسی ندارد، حتی با تغییر URL، ID، body یا فیلتر.
4. Sales Manager فقط داده‌ی دامنه‌ی فروش را می‌بیند؛ finance و HR با domain scope جدا می‌شوند.
5. PMO می‌تواند review/request correction/escalate کند؛ تغییر owner/deadline یا close به approval مدیر اجرایی نیاز دارد.
6. missing، stale و مقدار صفر وضعیت‌های جدا هستند؛ KPIهای غیرقابل مقایسه با هم جمع نمی‌شوند.
7. search، داشبورد، export، فایل، inbox، cache و job باید همان scope API را اعمال کنند.
8. بدون tenant context معتبر، عملیات tenant-bound باید رد شود.

## معیارهای پذیرش سیستم

- کاربر چند membership دارد و می‌تواند بین شرکت‌های عضو خود جابه‌جا شود.
- Holding role فقط شرکت‌های همان holding را می‌بیند.
- Company role به شرکت‌های دیگر دسترسی ندارد.
- Branch/unit/domain/own/assigned scope در query enforce می‌شود.
- API، dashboard، search، export، file و background work با درخواست‌های دستکاری‌شده مرز شرکت را حفظ می‌کنند.
- pilot ابتدا روی یک واحد Smarlux و سپس فروشگاه Hakim Banoo با 5–8 KPI و حداقل دو هفته داده‌ی پایدار انجام می‌شود.
- معیارهای PRD: تطبیق عددهای کسب‌وکار ≥99%، تکمیل داده ≥95%، به‌موقع ≥90% و استفاده هفتگی ≥80%.
- هر نشت بین شرکت‌ها، محاسبه‌ی نادرست KPI، تغییر بدون audit یا شکست recovery معیار توقف است.