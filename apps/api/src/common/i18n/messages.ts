export type AppLocale = "fa" | "en";

export const translations: Record<string, { fa: string; en: string }> = {
  SUCCESS: {
    fa: "درخواست با موفقیت انجام شد.",
    en: "Request completed successfully.",
  },
  VALIDATION_FAILED: { fa: "اعتبارسنجی ناموفق بود.", en: "Validation failed." },
  "Validation failed.": {
    fa: "اعتبارسنجی ناموفق بود.",
    en: "Validation failed.",
  },
  REQUEST_FAILED: { fa: "درخواست انجام نشد.", en: "Request failed." },
  INTERNAL_ERROR: { fa: "خطای داخلی سرور.", en: "Internal server error." },
  "Authentication required.": {
    fa: "برای ادامه باید وارد شوید.",
    en: "Authentication required.",
  },
  "Invalid credentials.": {
    fa: "موبایل یا رمز عبور نادرست است.",
    en: "Invalid credentials.",
  },
  "Account approval is pending.": {
    fa: "حساب در انتظار تأیید است.",
    en: "Account approval is pending.",
  },
  "A two-factor challenge is not pending.": {
    fa: "چالش تأیید دو مرحله‌ای فعال نیست.",
    en: "A two-factor challenge is not pending.",
  },
  "Permission denied.": { fa: "دسترسی مجاز نیست.", en: "Permission denied." },
  "Unknown role.": { fa: "نقش ناشناخته است.", en: "Unknown role." },
  "User not found.": { fa: "کاربر پیدا نشد.", en: "User not found." },
  "Avatar not found.": {
    fa: "تصویر پروفایل پیدا نشد.",
    en: "Avatar not found.",
  },
  "Department not found.": {
    fa: "واحد پیدا نشد.",
    en: "Department not found.",
  },
  "Invalid department code.": {
    fa: "کد واحد نامعتبر است.",
    en: "Invalid department code.",
  },
  "Access level not found.": {
    fa: "سطح دسترسی پیدا نشد.",
    en: "Access level not found.",
  },
  "Access level is assigned to users.": {
    fa: "این سطح دسترسی به کاربران اختصاص داده شده است.",
    en: "Access level is assigned to users.",
  },
  "Module not found.": { fa: "ماژول پیدا نشد.", en: "Module not found." },
  "Invalid Jalali birth date.": {
    fa: "تاریخ تولد شمسی نامعتبر است.",
    en: "Invalid Jalali birth date.",
  },
  "Initial setup has already been completed.": {
    fa: "راه‌اندازی اولیه قبلاً انجام شده است.",
    en: "Initial setup has already been completed.",
  },
  "Invalid or expired reset token.": {
    fa: "توکن بازیابی نامعتبر یا منقضی است.",
    en: "Invalid or expired reset token.",
  },
  "Account not found.": { fa: "حساب پیدا نشد.", en: "Account not found." },
  "Invalid or expired verification code.": {
    fa: "کد تأیید نامعتبر یا منقضی است.",
    en: "Invalid or expired verification code.",
  },
  "Invalid IPPanel sender number.": {
    fa: "شماره فرستنده IPPanel نامعتبر است.",
    en: "Invalid IPPanel sender number.",
  },
  "Invalid mobile number.": {
    fa: "شماره موبایل نامعتبر است.",
    en: "Invalid mobile number.",
  },
  "OTP code must contain six digits.": {
    fa: "کد یک‌بارمصرف باید شش رقم باشد.",
    en: "OTP code must contain six digits.",
  },
  "Priority name is required.": {
    fa: "نام اولویت الزامی است.",
    en: "Priority name is required.",
  },
  "Priority not found.": { fa: "اولویت پیدا نشد.", en: "Priority not found." },
  "You cannot create actions.": {
    fa: "مجوز ایجاد اقدام را ندارید.",
    en: "You cannot create actions.",
  },
  "Department access denied.": {
    fa: "دسترسی به این واحد مجاز نیست.",
    en: "Department access denied.",
  },
  "Action owner is outside the actor's accessible departments.": {
    fa: "مسئول اقدام خارج از واحدهای در دسترس شما است.",
    en: "Action owner is outside the actor's accessible departments.",
  },
  "Alert not found in the selected department.": {
    fa: "هشدار در واحد انتخاب‌شده پیدا نشد.",
    en: "Alert not found in the selected department.",
  },
  "Action priority does not exist.": {
    fa: "اولویت اقدام وجود ندارد.",
    en: "Action priority does not exist.",
  },
  "Invalid Jalali due date.": {
    fa: "موعد شمسی نامعتبر است.",
    en: "Invalid Jalali due date.",
  },
  "Action not found.": { fa: "اقدام پیدا نشد.", en: "Action not found." },
  "You cannot change this action.": {
    fa: "تغییر این اقدام مجاز نیست.",
    en: "You cannot change this action.",
  },
  "Alert not found.": { fa: "هشدار پیدا نشد.", en: "Alert not found." },
  "Alert is already resolved.": {
    fa: "این هشدار قبلاً بسته شده است.",
    en: "Alert is already resolved.",
  },
  "Critical threshold is inconsistent with warning threshold.": {
    fa: "آستانه بحرانی با آستانه هشدار سازگار نیست.",
    en: "Critical threshold is inconsistent with warning threshold.",
  },
  "Option name is required.": {
    fa: "نام گزینه الزامی است.",
    en: "Option name is required.",
  },
  "KPI option not found.": {
    fa: "گزینه شاخص پیدا نشد.",
    en: "KPI option not found.",
  },
  "KPI management permission is required.": {
    fa: "مجوز مدیریت شاخص لازم است.",
    en: "KPI management permission is required.",
  },
  "KPI name is required.": {
    fa: "نام KPI الزامی است.",
    en: "KPI name is required.",
  },
  "Unknown input mode.": {
    fa: "نوع ورودی نامعتبر است.",
    en: "Unknown input mode.",
  },
  "Invalid KPI target or weight.": {
    fa: "هدف یا وزن شاخص نامعتبر است.",
    en: "Invalid KPI target or weight.",
  },
  "KPI owner and reporter must be approved members of the selected department.":
    {
      fa: "مالک و گزارش‌دهنده شاخص باید اعضای تأییدشده واحد باشند.",
      en: "KPI owner and reporter must be approved members of the selected department.",
    },
  "KPI not found.": { fa: "شاخص پیدا نشد.", en: "KPI not found." },
  "Invalid KPI code.": { fa: "کد شاخص نامعتبر است.", en: "Invalid KPI code." },
  "KPI code is already in use.": {
    fa: "این کد شاخص قبلاً استفاده شده است.",
    en: "KPI code is already in use.",
  },
  "KPI owner must be an approved member of the selected department.": {
    fa: "مالک شاخص باید عضو تأییدشده واحد باشد.",
    en: "KPI owner must be an approved member of the selected department.",
  },
  "Invalid Jalali reporting period.": {
    fa: "دوره گزارش شمسی نامعتبر است.",
    en: "Invalid Jalali reporting period.",
  },
  "Active KPI not found.": {
    fa: "شاخص فعال پیدا نشد.",
    en: "Active KPI not found.",
  },
  "The password confirmation does not match.": {
    fa: "تکرار رمز عبور مطابقت ندارد.",
    en: "The password confirmation does not match.",
  },
  "The new password must differ from the current password.": {
    fa: "رمز عبور جدید باید با رمز فعلی متفاوت باشد.",
    en: "The new password must differ from the current password.",
  },
  "The current password is incorrect.": {
    fa: "رمز عبور فعلی نادرست است.",
    en: "The current password is incorrect.",
  },
  "A JPG, PNG or WebP avatar is required.": {
    fa: "تصویر JPG، PNG یا WebP الزامی است.",
    en: "A JPG, PNG or WebP avatar is required.",
  },
  "The avatar must be 200 KB or smaller.": {
    fa: "حجم تصویر باید حداکثر ۲۰۰ کیلوبایت باشد.",
    en: "The avatar must be 200 KB or smaller.",
  },
  "This national code is already in use.": {
    fa: "این کد ملی قبلاً ثبت شده است.",
    en: "This national code is already in use.",
  },
  "The avatar must be a JPG, PNG or WebP image.": {
    fa: "تصویر باید JPG، PNG یا WebP باشد.",
    en: "The avatar must be a JPG, PNG or WebP image.",
  },
  "The avatar dimensions must be between 50×50 and 200×200 pixels.": {
    fa: "ابعاد تصویر باید بین ۵۰×۵۰ و ۲۰۰×۲۰۰ پیکسل باشد.",
    en: "The avatar dimensions must be between 50×50 and 200×200 pixels.",
  },
  "Passwords do not match.": {
    fa: "رمز عبور و تکرار آن یکسان نیستند.",
    en: "Passwords do not match.",
  },
  "The selected department does not exist.": {
    fa: "واحد انتخاب‌شده وجود ندارد.",
    en: "The selected department does not exist.",
  },
  "Password updated.": {
    fa: "رمز عبور به‌روزرسانی شد.",
    en: "Password updated.",
  },
  "Avatar updated.": {
    fa: "تصویر پروفایل به‌روزرسانی شد.",
    en: "Avatar updated.",
  },
  "Avatar removed.": { fa: "تصویر پروفایل حذف شد.", en: "Avatar removed." },
};

export function resolveLocale(value?: string | string[] | null): AppLocale {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.toLowerCase().startsWith("en") ? "en" : "fa";
}
