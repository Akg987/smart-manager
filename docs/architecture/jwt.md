# Authentication، JWT و Company Context — Phase 1

## احراز هویت فعلی

API فعال JWT bearer مصرف نمی‌کند. SessionService یک شناسه‌ی تصادفی 32 بایتی با نام cookie برابر smart_manager_session می‌سازد و session را در جدول sessions نگه می‌دارد. SessionGuard در هر request session را پیدا می‌کند، کاربر تأییدشده را در currentUser می‌گذارد و lastActivity را تازه می‌کند.

- cookie: httpOnly، در production secure، sameSite=lax و path=/.
- عمر معمول: 12 ساعت؛ remember: 30 روز.
- challenge دو مرحله‌ای pending: 10 دقیقه؛ پس از تکمیل 2FA شناسه‌ی جدید صادر می‌شود.
- login، register، setup، password reset و 2FA در AuthController هستند؛ GET /auth/me با SessionGuard محافظت می‌شود.
- این context فقط User فعال را می‌دهد؛ tenant، membership و roleIds ندارد.

## کد JWT موجود در /modules

apps/api/src/module/auth شامل AuthJwtService، Passport JwtStrategy، JwtAuthGuard، RolesGuard و PermissionsGuard است. توکن‌های موجود access/refresh تولید می‌کنند و payload فعلی user_id و phone دارد. Strategy session سمت سرور، فعال بودن user و access token را نیز بررسی می‌کند. این ماژول در AppModule فعال نیست و قرارداد آن با users/mobile، مدل‌های role و repositoryهای فعال یکسان نیست.

## JWT هدف Smart Manager

Access JWT کوتاه‌عمر و کوچک باشد و context جاری را مشخص کند:

- sub: شناسه‌ی user
- sessionId: نشست قابل ابطال
- holdingId و membershipId: محدوده و عضویت معتبر
- activeCompanyId و roleIds: شرکت فعال و نقش‌ها
- scopeType، tokenVersion، iat و exp

اطلاعات کامل permission داخل token قرار نمی‌گیرد؛ permission هر request از authorization layer resolve می‌شود. activeCompanyId تنها پس از اعتبارسنجی عضویت انتخاب می‌شود. issuer، audience، expiration، الگوریتم مجاز و چرخش key validate می‌شوند.

## Refresh token و نشست

- access token عمر کوتاه دارد.
- refresh token چرخشی، یک‌بارمصرف، revokeable و به‌صورت hash در دیتابیس نگهداری می‌شود.
- مصرف مجدد refresh token قبلی باید family/session مربوط را باطل کند.
- logout، تغییر رمز، revoke membership و تغییر دسترسی باید سیاست مشخصی برای ابطال نشست داشته باشند.
- مرورگر token را در localStorage/sessionStorage نگه نمی‌دارد. cookie و CSRF policy برای درخواست‌های تغییردهنده‌ی داده مستند می‌شود.
- secure/httpOnly/sameSite و domain/path cookie در همه‌ی محیط‌ها صریح است.

## Company switch

POST /api/auth/switch-company شرکت انتخاب‌شده را از membershipهای فعال همان user بررسی می‌کند. companyId ورودی client یک درخواست انتخاب است، نه مجوز. در صورت پذیرش، active membership/context تازه به token متصل و رویداد switch audit می‌شود. شرکت‌هایی که membership معتبر ندارند نباید در پاسخ switcher یا API ظاهر شوند.

## AuthContext هدف

پس از اعتبارسنجی token و membership، context سروری شامل userId، holdingId، membershipId، companyId، branchId، businessUnitId، roleIds و scopeType است. همه‌ی عملیات حساس این context را مصرف می‌کنند؛ queryهای داده tenant را از body یا claim نامعتبر client نمی‌سازند.

## ریسک‌های بررسی لازم

- CSRF در cookie auth، XSS و محل نگهداری token.
- brute force login/OTP و نرخ‌بندی تلاش‌ها.
- 2FA pending flow، replay و ابطال session پس از revoke.
- rotate/reuse detection برای refresh token.
- claimهای stale پس از switch company یا تغییر membership.
- JWT ناقص/بدامضا/expired، issuer/audience اشتباه و tokenVersion نامعتبر.