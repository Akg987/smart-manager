# نقشه‌ی تکامل Smart Manager — Phase 1

این نقشه ترتیب طراحی و توسعه‌ی قابلیت‌های خود Smart Manager را مشخص می‌کند. Phase 1 فقط ممیزی و تعریف foundation است؛ هیچ‌کدام از قابلیت‌های زیر در این تحویل پیاده‌سازی نشده‌اند.

## گام 1 — تصمیم‌های سازمانی و دسترسی

- تثبیت Holding → Company → Branch → Business Unit و مالکیت هر نوع داده.
- نهایی‌کردن نقش‌های گروه، PMO، مدیر شرکت، مالک KPI و مدیر دامنه.
- تصویب permission catalog، scopeهای holding/company/branch/unit/own/assigned/domain و سیاست default-deny.
- تعیین قواعد مقایسه KPI، تقویم، ارز، دوره و data ownership.

## گام 2 — هویت و context

- هویت سراسری user از membership سازمانی مستقل شود.
- membership چندشرکتی، invitation و انتخاب شرکت فعال تعریف شوند.
- JWT کوتاه‌عمر فقط context لازم را حمل کند؛ permissionها در API resolve شوند.
- refresh token چرخشی، ابطال‌پذیر و قابل audit باشد.
- AuthContext واحد به request و عملیات حساس برسد.

## گام 3 — نقش و مجوز

- /modules به منبع واحد طراحی Auth/Role/Permission تبدیل و با runtime NestJS/Drizzle هماهنگ شود.
- roleهای اولیه مطابق PRD seed شوند؛ role سفارشی نیز پشتیبانی شود.
- authorization.can(context, permission, resourceContext) مجوز عمل و scope رکورد را با هم ارزیابی کند.
- همه‌ی mutationهای membership، role و permission audit شوند.

## گام 4 — مالکیت و جداسازی دامنه

- Company/Branch/Business Unit مالکیت صریح داده‌ها داشته باشند.
- repositoryهای KPI، check-in، action، alert، dashboard، data، audit و notification scope دریافت کنند.
- مسیرهای جست‌وجو، فایل و export تنها از read serviceهای مجاز داده بگیرند.
- درخواست بدون scope معتبر fail-closed شود.

## گام 5 — workflow عملکرد

- KPI با تعریف، منبع، نسخه، target/formula، submit/review/reject/approve و period lock؛ در پایلوت ثبت‌کننده approver نیست.
- Red Flag به‌صورت entity و lifecycle مستقل از KPI health، همراه با علت یا ثبت صریح علت نامشخص.
- Decision و Action جدا باشند؛ هر تصمیم بتواند چند اقدام داشته باشد.
- PMO review، اصلاح و escalation کند؛ اختیار اجرایی با owner و approver مربوط بماند.
- WBR/MBR تأییدشده versioned و قابل بازبینی باشد.

## گام 6 — تجربه‌ی مدیر و pilot

- مسیرهای Holding و Company، مدیریت کاربران و نقش‌ها: /holding، /holding/companies، /holding/companies/create، /holding/users، /holding/roles؛ /companies، /companies/[id]، /companies/[id]/branches، /companies/[id]/units، /companies/[id]/users و /companies/[id]/roles.
- company switcher در header بر اساس membershipهای مجاز.
- dashboard گروه و شرکت با وضعیت missing/stale، trend، owner، deadline و drill-down.
- pilot Smarlux و Hakim Banoo با معیارهای پذیرش PRD و آزمون recovery.

## گام 7 — اتصال و تحلیل هوشمند

- اتصال Accounteroo ابتدا read-only، با mapping و fallback فایل.
- AI فقط پس از اجرای permission پیش از retrieval؛ پاسخ دارای منبع/تاریخ و audit.
- AI مالک، approver یا تغییر‌دهنده‌ی خودکار KPI/action نیست.

## وابستگی‌های معماری فعلی

- runtime در apps/api/src فعال است؛ /modules هنوز به runtime متصل نشده و وابستگی‌های persistence آن با زیرساخت فعلی هم‌خوان نیست.
- schema فعلی فقط department scope دارد.
- role و permission فعلی در API فعال با مدل /modules هم‌زمان نیست.
- frontend routeها بخش زیادی از workspace را از مسیر پویای [...segments] نمایش می‌دهد.
- Tailwind و shadcn در بخشی از shared shell فعال‌اند و توسعه‌ی viewها در tasks.md به‌صورت مرحله‌ای فهرست شده است.