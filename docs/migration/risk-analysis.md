# تحلیل ریسک حفظ رفتار در مهاجرت

## ریسک‌های اولویت‌دار

| ریسک | اولویت | شواهد در منبع و راه کاهش |
|---|---|---|
| ناسازگاری یا ناقص‌بودن snapshot | بحرانی | dump MariaDB با header تاریخ ۴ اکتبر ۲۰۲۶ دارای ۲۵ جدول و ۲۲ migration ثبت‌شده است؛ سورس ZIP تعریف migration و ۳ جدول SMS دارد که dump ندارد. قبل از cutover snapshot تازه، زمان توقف تغییر داده/جریان تغییرات و تطبیق تعداد rowها را با مالک محصول قطعی کنید. |
| مجوز ناکامل در API تازه | بحرانی | صلاحیت کاربر تابع approved status، admin shortcut، role grants، access-level permission pack و department scope است. Nest guard/service باید هرکدام را اعمال کند؛ بررسی نمایش دکمه در Next کافی نیست. برای همهٔ write/read سناریوهای cross-department ماتریس regression تهیه شود. |
| از دست رفتن login/session/security | بالا | login/session، remember، throttle، account lockout، OTP/2FA/reset و revocation در Laravel behavior موجود است. origin/cookie domain، Secure/HttpOnly/SameSite، CSRF، CORS، proxy trust، session TTL، OTP pending/cancel/resend و invalidate session را تعیین کنید. hashهای قبلی را با fixture واقعی و verify/rehash امن بررسی کنید؛ hash خام را در گزارش/لاگ نیاورید. |
| تفاوت نمایش و تعامل | بالا | Blade فارسی `lang=fa`, `dir=rtl`، Dashlite RTL، theme و فونت محلی، shared alerts/sidebar/header/modal دارد؛ Next حاضر تم انگلیسی Geist و صفحهٔ starter است. asset/metrics/icons/grid/spacing/breakpoints و همهٔ حالت‌های modal/form/table را با screenshot هم‌اندازه بررسی کنید. |
| مهاجرت افزونه‌ها | بالا | Laravel ModuleManager provider PHP را load، migrations و view/routes/hook/menu/widget contribution را اجرا می‌کند. فایل PHP مستقیماً قابل‌اجرا در Nest نیست. تعیین کنید plug-in interface جدید با trust boundary می‌خواهید یا ماژول‌ها داخل build API می‌شوند؛ نصب آرشیو executable از مدیر، سطح حمله را بالا می‌برد. |
| کلیدهای رمزگذاری‌شدهٔ IPPanel | بالا | Eloquent `encrypted` cast به APP_KEY لاراول متکی است. ciphertext را با key جدید Drizzle/Nest سازگار فرض نکنید؛ روش مجاز decrypt/re-encrypt، کلید برگشت و عدم exposure credential قبل از migration امن روشن شود. |
| تقویم، عدد و دورهٔ فارسی | بالا | `JalaliDate`, `JalaliPeriod`, `PersianDigits` و `morilog/jalali` تاریخ‌ها، بازهٔ هفته، Nowruz/leap-year، رقم‌های فارسی و XLSX را کنترل می‌کنند. ذخیرهٔ Gregorian/UTC و period `YYYY-Www` را از قالب نمایش جدا نگه دارید و boundary inclusive/روز پایان را با موارد لبه‌ای برابر کنید. |
| تفاوت تراکنش و همزمانی | بالا | setup اولین مدیر و KPI check-in از `lockForUpdate`/transaction استفاده می‌کنند؛ ارسال SMS quota با increment SQL اتمیک و alert deduplication دارد. PostgreSQL unique constraint, isolation, `ON CONFLICT`, lock contention و duplicate event semantics را طراحی و همزمانی را با integration scenarios بررسی کنید. |
| فایل‌ها و زمان‌بندی | متوسط-بالا | avatar/logo و asset responseها به storage/routes وابسته‌اند؛ cleanup audit/inbox و purge OTP زمان‌بندی می‌شود. مقصد storage پایدار و URL/ACL، media migration، cron/scheduler و worker/retry باید پیش از حذف legacy آماده باشد. |
| سیاست امنیت محتوا | متوسط-بالا | `SecurityHeaders` و CSP در مبدأ وجود دارد؛ CSP report-only به‌دلیل inline script یک overlay پیامک. محتوای description، URL داخلی اعلان، render متن و modalهای React را بررسی کنید؛ CSP و headerها پس از معادل‌سازی واقعی stage به enforcing بروند. |

## MariaDB/MySQL به PostgreSQL

مبدأ dump مشخصاً MariaDB 11.4.12 است. موارد زیر از schema و کد فعلی مشتق می‌شوند و هنگام ساخت Drizzle schema/migration باید صریح حل شوند:

1. **unsigned و identity:** dump شامل `BIGINT UNSIGNED`, `INT UNSIGNED`, `TINYINT UNSIGNED`, `AUTO_INCREMENT` است. PostgreSQL عدد unsigned ندارد و identity/sequence مسیر متفاوتی دارد. دامنهٔ مقادیر، نوع sequence و `nextval` بعد از import را بررسی کنید؛ صرفاً تبدیل type name نکنید.
2. **boolean و enumهای رشته‌ای:** `active`, `is_active` در MySQL به‌صورت `tinyint(1)`، و role/status/direction/health به‌صورت string ذخیره شده‌اند. تبدیل type به boolean/enum می‌تواند مقادیر موجود یا مقدار پیش‌فرض را رد کند. مقادیر واقعی و validator/enum source را پیش از اعمال CHECK یا enum بررسی کنید.
3. **JSON و longtext:** `audit_logs.context`, `modules.settings`, `kpi_management_checkins.data_json`, `kpi_management_kpis.input_fields` در dump متن JSON با `json_valid` check هستند. تصمیم `jsonb` یا `json`، حفظ null/object/array/numeric forms، validation و index باید صریح باشد. در Drizzle/API مراقب تبدیل `DECIMAL`های JSON به floating-point JS باشید.
4. **collation و unique:** مبدأ روی `utf8mb4_unicode_ci` است؛ uniqueness و sort رشته‌ای ممکن است در collation پیش‌فرض PostgreSQL متفاوت باشد. mobile/code/name، حروف کوچک/بزرگ، ی/ي، ک/ك، ارقام و فاصله‌های فارسی را normalize/collision scan کنید پیش از ساخت unique index.
5. **NULL ordering:** کد هسته `orderByRaw('approved_at is null desc')` و `read_at is null desc` دارد و ماژول‌ها با CASE status/severity ترتیب می‌دهند. NULL sort پیش‌فرض PostgreSQL همان رفتار implicit در هر موتور نیست. queryهای مرتب‌سازی nullable را با `CASE` و ترتیب null صریح تبدیل و در UI regression کنید.
6. **تاریخ و timezone:** dump timezone خود را هنگام dump به UTC تنظیم می‌کند؛ جداول date, datetime, timestamp و epoch seconds را مخلوط دارد. `birth_date`/`sent_on`/`period` با instant زمانی یکی نیستند؛ انتخاب PostgreSQL `date`, `timestamp`, `timestamptz` و UTC conversion را براساس معنی هر فیلد انجام دهید، نه نام type تنها.
7. **دقت عددی:** KPI `decimal(14,4)`، weight `decimal(5,2)` است. در PostgreSQL exact numeric قابل‌حفظ است، ولی عبور از JS number، rounding و JSON/XLSX می‌تواند اختلاف بسازد. مقدارهای ورودی/خروجی را به شکل decimal string/محاسبهٔ دقیق نگه دارید و مرزهای threshold را تطبیق دهید.
8. **SQL و migration خاص MySQL:** migration اولویت corrective action فقط در branch مخصوص MySQL از `ALTER TABLE ... MODIFY` استفاده می‌کند. syntax را برای PostgreSQL بازنویسی کنید. `orderByRaw CASE`, upsert, `lockForUpdate`, unique indexes و JSON constraints را روی target واقعی اجرا کنید؛ dump از MySQL مستقیماً migration PostgreSQL نیست.
9. **FK و delete rules:** هم‌معنای cascade/set-null/restrict را نگه دارید. قبل از ساخت FK، null/orphan references را بشمارید؛ sequence IDs را بعد از import هماهنگ کنید.
10. **upsert/همزمانی:** OTP روی ترکیب `(purpose, identifier)` upsert می‌شود، daily counter بر اساس روز unique و atomic increment است. PostgreSQL conflict target به unique constraint نیاز دارد. race میان issue/verify و اولین ایجاد counter/alert را به‌صورت transactional در API جدید تعریف کنید.

## Blade به Next و Laravel به Nest

- **Server-rendered form در برابر API + hydration:** Blade POST/PUT/DELETE و redirect/session flash دارد. Nest به‌صورت معمول نتیجهٔ JSON می‌دهد و Next وضعیت pending/validation/error را مدیریت می‌کند. mapping پایدار field errors و flash messageهای فارسی، حفظ old input، query string و redirect/back لازم است.
- **Authentication در چند process/origin:** Laravel web guard اکنون session را در یک برنامه کنترل می‌کند. اگر web و API origin/process جدا باشند، cookie، CORS، CSRF، proxy، logout و revoke sessions تغییر می‌کنند. قبل ساخت UI مدل BFF/same-origin reverse proxy یا originهای cookie را انتخاب کنید.
- **Authorization در هر لایه:** Blade navigation conditionals مسیرها را جایگزین Gate نمی‌کنند؛ مبدأ هم middleware و هم service domain check دارد. React rendering permission صرفاً UX است؛ Nest برای هر endpoint/منبع باید همان policy و tenant/department scope را دوباره enforce کند.
- **Validation و redirect:** FormRequestها input rules و پیام‌های فارسی دارند و controller اغلب redirect-with-status/error می‌دهد. در API جدید status code، error object، translation key و ترتیب validation را تثبیت کنید؛ Nest default exception text را بی‌واسطه به کاربر نشان ندهید.
- **Model binding و URL:** implicit Eloquent binding و named routes، file avatar/logo و internal hrefها مسیر مبدأ را می‌سازند. target باید URL mapping، 404/403، resource not-found، safe-internal href، caching/file access، search/filter/pagination queryها و لینک notification را مشخص کند.
- **Bootstrap imperative JS به React:** event delegation برای data attributes، submit/change، modal backdrop/keyboard، CSRF meta و nonce script دارد. React state/event lifecycle و focus/escape/backdrop رفتار مشابه خودکار ایجاد نمی‌کنند؛ XSS boundaries، `href` sanitizer، focus management و CSP دوباره بررسی شود.
- **دارایی و فونت:** CSS/JS bundle Dashlite، theme، icon packs، تصاویر، Persian font files و Jalali date picker حفظ/انتقال license و مسیر می‌خواهد. Tailwind starter مقصد معیار بصری مبدأ نیست؛ همهٔ breakpoints و فونت‌ها در browser screenshot مقایسه شوند.
- **Export:** `WeeklyReportController` فایل `.xlsx` تولید می‌کند؛ response headers، Persian characters، اعداد و تاریخ‌ها، query scope و نام فایل را parity-check کنید.
- **UI-only rendering states:** loading، concurrent submit، stale response، empty list، denied/expired OTP و browser-back در Next stateهایی هستند که Blade redirect lifecycle آن‌ها را به همین شکل نداشت؛ طراحی و test جدا می‌خواهند.
- **Queue/mail assumptions:** Laravel schema دارای queue/session/cache/password reset tables است؛ reset password واقعی که بررسی شد از OTP موبایل استفاده می‌کند. وجود support table به‌تنهایی استفادهٔ فعال از mail/queue را ثابت نمی‌کند؛ driver production از static ZIP نتیجه نمی‌شود.

## منطق تجاری که باید حفظ شود

- setup اولین مدیر از race محافظت می‌کند. registration حالت‌های approval/open/closed دارد. حساب pending اجازهٔ dashboard ندارد. تنظیم 2FA بر حسب role/transport و `fail_open` است.
- کاربر تأییدنشده مجوز ندارد؛ Admin Gate را short-circuit می‌کند؛ سایر کاربران از role grants و access level permission بهره می‌برند. user با `department_id = null` عمداً deny-by-default است؛ دسترسی cross-department نیازمند مجوز صریح `access-all-departments` است.
- Password reset پاسخ یکسان برای موبایل موجود/ناموجود می‌دهد تا وجود حساب افشا نشود. OTP hash، expire، attempt budget، cooldown و single-use دارد. reset رمز موجود ممکن است تمام DB sessions آن کاربر را revoke کند.
- هر KPI period یک Jalali `YYYY-Www` از ابتدای Farvardin می‌سازد. health آستانه‌ها برای جهت higher/lower متفاوت است؛ فقط check-inهای write-value، `kpi_management_values` را update/create و رویداد تولید می‌کنند.
- CorrectiveActions با رویداد KPI red برای هر KPI/period فقط یک alert حل‌نشده می‌سازد؛ acknowledge/resolve اطلاعات actor/time می‌نویسد و owner inbox پیام می‌گیرد. آدرس action status به‌طور عمده در service مجوز owner/manage را کنترل می‌کند.
- `action_priorities` محلی و فارسی است. تاریخ‌های action و report شمسی‌اند. weekly report و XLSX باید همچنان scoped به واحد کاربر بماند.
- quota روزانه فقط فرم تست SMS را محدود می‌کند؛ ارسال برنامه‌ای از quota تست مستثناست. IPPanel برای params خالی JSON object `{}` می‌خواهد؛ پیاده‌سازی adapter باید قرارداد body/error/HTTP را حفظ کند.
- audit برای ورود موفق/ناموفق، lockout، خروج و lifecycle ماژول رخداد ثبت می‌کند؛ inbox user-specific و read/read-all است. deletion retention/pruning زمان‌بندی‌شده دارد.
- ماژول upload/uninstall می‌تواند migration اجرا یا schema ماژول را حذف کند. authorization، confirm، backup و data-retention behavior را از دست ندهید.

## اعتبارسنجی داده و cutover

1. dump فعلی را snapshot تاریخی تلقی کنید تا زمان و مالک snapshot نهایی مشخص شود. source/target row count برای هر جدول، وجود جدول‌های SMS، PK min/max و sequence بعد از import را تطبیق دهید.
2. unique collision تحت collation PostgreSQL، nullable unique field، طول حداکثر/encoding رشته، orphan FK و delete policy را قبل از constraint بسنجید.
3. JSON round trip، exact decimal، Gregorian UTC/Jalali boundary، دوره‌های انتهای سال کبیسه، template labels و XLSX را نمونه‌برداری کنید.
4. admin, approval state, module activation/version, custom access grants, site branding, priorities/studio options و audit history را با مالک داده تأیید کنید؛ demo seeder را روی production replay نکنید.
5. staging باید ماتریس route/role/access-level/department، login/lockout/reset/2FA/rate limit، modal/file/download، inbox/audit و KPI→alert→action trigger را پوشش دهد.
6. SMS را با credential امن و quota کم/محیط غیرواقعی billable بررسی کنید؛ retry نباید ارسال تکراری بسازد.
7. تغییر دادهٔ همزمان، write freeze/final sync، DNS/proxy switch و زمان بازگشت به legacy read-only را پیشاپیش طراحی کنید.

این تحلیل static بر ZIP و dump داده‌شده متکی است؛ وضعیت production env، snapshot جدیدتر، فایل‌های storage واقعی، cache/runtime flags و proxy/CDN در این مرحله قابل‌اثبات نیست.
