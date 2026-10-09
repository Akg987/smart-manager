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
  "AI chat is not available for this scope.": {
    fa: "\u062f\u0633\u062a\u0631\u0633\u06cc \u06af\u0641\u062a\u200c\u0648\u06af\u0648\u06cc \u0647\u0648\u0634\u0645\u0646\u062f \u062f\u0631 \u0627\u06cc\u0646 \u0645\u062d\u062f\u0648\u062f\u0647 \u0641\u0639\u0627\u0644 \u0646\u06cc\u0633\u062a.",
    en: "AI chat is not available for this scope.",
  },
  "Select a company within your active scope.": {
    fa: "\u06cc\u06a9 \u0634\u0631\u06a9\u062a \u062f\u0631 \u0645\u062d\u062f\u0648\u062f\u0647 \u0641\u0639\u0627\u0644 \u062e\u0648\u062f \u0627\u0646\u062a\u062e\u0627\u0628 \u06a9\u0646\u06cc\u062f.",
    en: "Select a company within your active scope.",
  },
  "AI analytics is not available for this scope.": {
    fa: "\u062a\u062d\u0644\u06cc\u0644 \u0647\u0648\u0634\u0645\u0646\u062f \u062f\u0631 \u0627\u06cc\u0646 \u0645\u062d\u062f\u0648\u062f\u0647 \u0641\u0639\u0627\u0644 \u0646\u06cc\u0633\u062a.",
    en: "AI analytics is not available for this scope.",
  },
  "Company is outside your holding.": {
    fa: "\u0634\u0631\u06a9\u062a \u062e\u0627\u0631\u062c \u0627\u0632 \u0647\u0644\u062f\u06cc\u0646\u06af \u0634\u0645\u0627\u0633\u062a.",
    en: "Company is outside your holding.",
  },
  "AI provider is not configured. Set AI_API_BASE_URL, AI_API_KEY, and AI_MODEL.":
    {
      fa: "\u0633\u0631\u0648\u06cc\u0633 \u0647\u0648\u0634 \u0645\u0635\u0646\u0648\u0639\u06cc \u067e\u06cc\u06a9\u0631\u0628\u0646\u062f \u0646\u0634\u062f\u0647 \u0627\u0633\u062a.",
      en: "AI provider is not configured.",
    },
  "Conversation is outside your scope.": {
    fa: "\u06af\u0641\u062a\u200c\u0648\u06af\u0648 \u062e\u0627\u0631\u062c \u0627\u0632 \u0645\u062d\u062f\u0648\u062f\u0647 \u062f\u0633\u062a\u0631\u0633\u06cc \u0634\u0645\u0627\u0633\u062a.",
    en: "Conversation is outside your scope.",
  },
  "AI recommendation review is not allowed.": {
    fa: "\u0628\u0631\u0631\u0633\u06cc \u067e\u06cc\u0634\u0646\u0647\u0627\u062f \u0647\u0648\u0634\u0645\u0646\u062f \u0645\u062c\u0627\u0632 \u0646\u06cc\u0633\u062a.",
    en: "AI recommendation review is not allowed.",
  },
  "Recommendation is outside your scope.": {
    fa: "\u067e\u06cc\u0634\u0646\u0647\u0627\u062f \u062e\u0627\u0631\u062c \u0627\u0632 \u0645\u062d\u062f\u0648\u062f\u0647 \u062f\u0633\u062a\u0631\u0633\u06cc \u0634\u0645\u0627\u0633\u062a.",
    en: "Recommendation is outside your scope.",
  },
  "Recommendation was already reviewed.": {
    fa: "\u0627\u06cc\u0646 \u067e\u06cc\u0634\u0646\u0647\u0627\u062f \u0642\u0628\u0644\u0627\u064b \u0628\u0631\u0631\u0633\u06cc \u0634\u062f\u0647 \u0627\u0633\u062a.",
    en: "Recommendation was already reviewed.",
  },
  "Recommendation review failed.": {
    fa: "\u0628\u0631\u0631\u0633\u06cc \u067e\u06cc\u0634\u0646\u0647\u0627\u062f \u062b\u0628\u062a \u0646\u0634\u062f.",
    en: "Recommendation review failed.",
  },
  "Action creation permission is required.": {
    fa: "\u0645\u062c\u0648\u0632 \u0633\u0627\u062e\u062a \u0627\u0642\u062f\u0627\u0645 \u0644\u0627\u0632\u0645 \u0627\u0633\u062a.",
    en: "Action creation permission is required.",
  },
  "Owner, approver, department, and deadline are required to create an action.":
    {
      fa: "\u0645\u0633\u0626\u0648\u0644\u060c \u062a\u0623\u06cc\u06cc\u062f\u06a9\u0646\u0646\u062f\u0647\u060c \u0648\u0627\u062d\u062f \u0648 \u0645\u0647\u0644\u062a \u0628\u0631\u0627\u06cc \u0633\u0627\u062e\u062a \u0627\u0642\u062f\u0627\u0645 \u0644\u0627\u0632\u0645 \u0627\u0633\u062a.",
      en: "Owner, approver, department, and deadline are required to create an action.",
    },
  "Department is outside the active company.": {
    fa: "\u0648\u0627\u062d\u062f \u0627\u0646\u062a\u062e\u0627\u0628\u200c\u0634\u062f\u0647 \u0628\u0647 \u0634\u0631\u06a9\u062a \u0641\u0639\u0627\u0644 \u0645\u0631\u0628\u0648\u0637 \u0646\u06cc\u0633\u062a.",
    en: "Department is outside the active company.",
  },
  "Action priority is not configured.": {
    fa: "\u0627\u0648\u0644\u0648\u06cc\u062a \u0627\u0642\u062f\u0627\u0645 \u067e\u06cc\u06a9\u0631\u0628\u0646\u062f \u0646\u0634\u062f\u0647 \u0627\u0633\u062a.",
    en: "Action priority is not configured.",
  },
  "AI provider request failed.": {
    fa: "\u062f\u0631\u062e\u0648\u0627\u0633\u062a \u0633\u0631\u0648\u06cc\u0633 \u0647\u0648\u0634 \u0645\u0635\u0646\u0648\u0639\u06cc \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062f.",
    en: "AI provider request failed.",
  },
  "AI provider returned an empty response.": {
    fa: "\u0633\u0631\u0648\u06cc\u0633 \u0647\u0648\u0634 \u0645\u0635\u0646\u0648\u0639\u06cc \u067e\u0627\u0633\u062e \u062e\u0627\u0644\u06cc \u0628\u0631\u06af\u0631\u062f\u0627\u0646\u062f.",
    en: "AI provider returned an empty response.",
  },
  "An active tenant membership is required.": {
    fa: "\u0639\u0636\u0648\u06cc\u062a \u0641\u0639\u0627\u0644 \u0633\u0627\u0632\u0645\u0627\u0646\u06cc \u0644\u0627\u0632\u0645 \u0627\u0633\u062a.",
    en: "An active tenant membership is required.",
  },
  "External AI analysis is paused pending approval of the provider and data-sharing scope.":
    {
      fa: "\u062a\u062d\u0644\u06cc\u0644 \u062e\u0627\u0631\u062c\u06cc \u0647\u0648\u0634 \u0645\u0635\u0646\u0648\u0639\u06cc \u062a\u0627 \u062a\u0623\u06cc\u06cc\u062f \u0645\u0642\u0635\u062f \u0633\u0631\u0648\u06cc\u0633 \u0648 \u0645\u062d\u062f\u0648\u062f\u0647 \u0627\u0634\u062a\u0631\u0627\u06a9 \u062f\u0627\u062f\u0647 \u0645\u062a\u0648\u0642\u0641 \u0627\u0633\u062a.",
      en: "External AI analysis is paused pending approval of the provider and data-sharing scope.",
    },
  "Authentication required.": {
    fa: "برای ادامه باید وارد شوید.",
    en: "Authentication required.",
  },
  "Too many login attempts. Try again later.": {
    fa: "تعداد تلاش‌های ورود بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.",
    en: "Too many login attempts. Try again later.",
  },
  "Import file is required.": {
    fa: "\u0641\u0627\u06cc\u0644 \u0648\u0627\u0631\u062f\u0633\u0627\u0632\u06cc \u0627\u0644\u0632\u0627\u0645\u06cc \u0627\u0633\u062a.",
    en: "Import file is required.",
  },
  "Tenant membership required.": {
    fa: "عضویت فعال سازمانی برای ادامه لازم است.",
    en: "An active organization membership is required.",
  },
  "An active company is required.": {
    fa: "\u0628\u0631\u0627\u06cc \u0627\u062f\u0627\u0645\u0647 \u0628\u0627\u06cc\u062f \u06cc\u06a9 \u0634\u0631\u06a9\u062a \u0641\u0639\u0627\u0644 \u0627\u0646\u062a\u062e\u0627\u0628 \u0634\u0648\u062f.",
    en: "An active company is required.",
  },
  "Branch does not belong to the active company.": {
    fa: "\u0634\u0639\u0628\u0647\u0654 \u0627\u0646\u062a\u062e\u0627\u0628\u200c\u0634\u062f\u0647 \u0628\u0647 \u0634\u0631\u06a9\u062a \u0641\u0639\u0627\u0644 \u0645\u0631\u0628\u0648\u0637 \u0646\u06cc\u0633\u062a.",
    en: "Branch does not belong to the active company.",
  },
  "You cannot assign a membership to yourself.": {
    fa: "\u0646\u0645\u06cc\u200c\u062a\u0648\u0627\u0646\u06cc\u062f \u0628\u0647 \u062e\u0648\u062f\u062a\u0627\u0646 \u0639\u0636\u0648\u06cc\u062a \u0628\u062f\u0647\u06cc\u062f.",
    en: "You cannot assign a membership to yourself.",
  },
  "Business unit does not belong to the selected company and branch.": {
    fa: "\u0648\u0627\u062d\u062f \u06a9\u0633\u0628\u200c\u0648\u06a9\u0627\u0631 \u0628\u0647 \u0634\u0631\u06a9\u062a \u0648 \u0634\u0639\u0628\u0647\u0654 \u0627\u0646\u062a\u062e\u0627\u0628\u200c\u0634\u062f\u0647 \u0645\u0631\u0628\u0648\u0637 \u0646\u06cc\u0633\u062a.",
    en: "Business unit does not belong to the selected company and branch.",
  },
  "Company scope cannot include a branch or business unit.": {
    fa: "\u0645\u062d\u062f\u0648\u062f\u0647\u0654 \u0634\u0631\u06a9\u062a \u0646\u0645\u06cc\u200c\u062a\u0648\u0627\u0646\u062f \u0634\u0639\u0628\u0647 \u06cc\u0627 \u0648\u0627\u062d\u062f \u06a9\u0633\u0628\u200c\u0648\u06a9\u0627\u0631 \u062f\u0627\u0634\u062a\u0647 \u0628\u0627\u0634\u062f.",
    en: "Company scope cannot include a branch or business unit.",
  },
  "Branch scope requires a branch and cannot include a business unit.": {
    fa: "\u0645\u062d\u062f\u0648\u062f\u0647\u0654 \u0634\u0639\u0628\u0647 \u0628\u0647 \u0634\u0639\u0628\u0647 \u0646\u06cc\u0627\u0632 \u062f\u0627\u0631\u062f \u0648 \u0646\u0645\u06cc\u200c\u062a\u0648\u0627\u0646\u062f \u0648\u0627\u062d\u062f \u06a9\u0633\u0628\u200c\u0648\u06a9\u0627\u0631 \u0631\u0627 \u0634\u0627\u0645\u0644 \u0634\u0648\u062f.",
    en: "Branch scope requires a branch and cannot include a business unit.",
  },
  "Business unit scope requires a business unit.": {
    fa: "\u0645\u062d\u062f\u0648\u062f\u0647\u0654 \u0648\u0627\u062d\u062f \u06a9\u0633\u0628\u200c\u0648\u06a9\u0627\u0631 \u0628\u0647 \u0627\u0646\u062a\u062e\u0627\u0628 \u0648\u0627\u062d\u062f \u0646\u06cc\u0627\u0632 \u062f\u0627\u0631\u062f.",
    en: "Business unit scope requires a business unit.",
  },
  "One or more roles are unavailable in this holding.": {
    fa: "\u06cc\u06a9 \u06cc\u0627 \u0686\u0646\u062f \u0646\u0642\u0634 \u062f\u0631 \u0627\u06cc\u0646 \u0647\u0644\u062f\u06cc\u0646\u06af \u0642\u0627\u0628\u0644 \u0627\u0633\u062a\u0641\u0627\u062f\u0647 \u0646\u06cc\u0633\u062a.",
    en: "One or more roles are unavailable in this holding.",
  },
  "System and root roles cannot be delegated.": {
    fa: "\u0648\u0627\u06af\u0630\u0627\u0631\u06cc \u0646\u0642\u0634\u200c\u0647\u0627\u06cc \u0633\u06cc\u0633\u062a\u0645\u06cc \u0648 \u0631\u06cc\u0634\u0647 \u0645\u062c\u0627\u0632 \u0646\u06cc\u0633\u062a.",
    en: "System and root roles cannot be delegated.",
  },
  "Role permissions exceed the assigned membership scope.": {
    fa: "\u0645\u062c\u0648\u0632\u0647\u0627\u06cc \u0646\u0642\u0634 \u0627\u0632 \u0645\u062d\u062f\u0648\u062f\u0647\u0654 \u0639\u0636\u0648\u06cc\u062a \u062a\u0639\u06cc\u06cc\u0646\u200c\u0634\u062f\u0647 \u0641\u0631\u0627\u062a\u0631 \u0627\u0633\u062a.",
    en: "Role permissions exceed the assigned membership scope.",
  },
  "Role permissions exceed the delegator's current permissions or scope.": {
    fa: "\u0645\u062c\u0648\u0632\u0647\u0627\u06cc \u0646\u0642\u0634 \u0627\u0632 \u062f\u0633\u062a\u0631\u0633\u06cc \u06cc\u0627 \u0645\u062d\u062f\u0648\u062f\u0647\u0654 \u0641\u0639\u0644\u06cc \u0648\u0627\u06af\u0630\u0627\u0631\u06a9\u0646\u0646\u062f\u0647 \u0641\u0631\u0627\u062a\u0631 \u0627\u0633\u062a.",
    en: "Role permissions exceed the delegator's current permissions or scope.",
  },
  "You cannot revoke your own membership.": {
    fa: "\u0646\u0645\u06cc\u200c\u062a\u0648\u0627\u0646\u06cc\u062f \u0639\u0636\u0648\u06cc\u062a \u062e\u0648\u062f\u062a\u0627\u0646 \u0631\u0627 \u0644\u063a\u0648 \u06a9\u0646\u06cc\u062f.",
    en: "You cannot revoke your own membership.",
  },
  "Membership not found.": {
    fa: "\u0639\u0636\u0648\u06cc\u062a \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f.",
    en: "Membership not found.",
  },
  "Invitation is invalid, expired, revoked, or belongs to another mobile number.":
    {
      fa: "\u062f\u0639\u0648\u062a\u200c\u0646\u0627\u0645\u0647 \u0646\u0627\u0645\u0639\u062a\u0628\u0631\u060c \u0645\u0646\u0642\u0636\u06cc\u060c \u0628\u0627\u0637\u0644\u200c\u0634\u062f\u0647 \u06cc\u0627 \u0645\u0631\u0628\u0648\u0637 \u0628\u0647 \u0634\u0645\u0627\u0631\u0647 \u0645\u0648\u0628\u0627\u06cc\u0644 \u062f\u06cc\u06af\u0631\u06cc \u0627\u0633\u062a.",
      en: "Invitation is invalid, expired, revoked, or belongs to another mobile number.",
    },
  "Company not found.": {
    fa: "\u0634\u0631\u06a9\u062a \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f.",
    en: "Company not found.",
  },
  "Invitation not found.": {
    fa: "\u062f\u0639\u0648\u062a\u200c\u0646\u0627\u0645\u0647 \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f.",
    en: "Invitation not found.",
  },
  "Role permissions exceed the invitation company scope.": {
    fa: "\u0645\u062c\u0648\u0632\u0647\u0627\u06cc \u0646\u0642\u0634 \u0627\u0632 \u0645\u062d\u062f\u0648\u062f\u0647\u0654 \u0634\u0631\u06a9\u062a \u062f\u0631 \u062f\u0639\u0648\u062a\u200c\u0646\u0627\u0645\u0647 \u0641\u0631\u0627\u062a\u0631 \u0627\u0633\u062a.",
    en: "Role permissions exceed the invitation company scope.",
  },
  "A role without permissions cannot be delegated.": {
    fa: "\u0646\u0642\u0634 \u0628\u062f\u0648\u0646 \u0645\u062c\u0648\u0632 \u0642\u0627\u0628\u0644 \u0648\u0627\u06af\u0630\u0627\u0631\u06cc \u0646\u06cc\u0633\u062a.",
    en: "A role without permissions cannot be delegated.",
  },
  "Default tenant is not configured.": {
    fa: "\u0634\u0631\u06a9\u062a \u067e\u06cc\u0634\u200c\u0641\u0631\u0636 \u0633\u0627\u0645\u0627\u0646\u0647 \u0647\u0646\u0648\u0632 \u062a\u0646\u0638\u06cc\u0645 \u0646\u0634\u062f\u0647 \u0627\u0633\u062a.",
    en: "Default tenant is not configured.",
  },
  "User has an active membership outside the approval scope.": {
    fa: "\u06a9\u0627\u0631\u0628\u0631 \u062f\u0631 \u062d\u0648\u0632\u0647\u0654 \u062e\u0627\u0631\u062c \u0627\u0632 \u0645\u062d\u062f\u0648\u062f\u0647\u0654 \u062a\u0623\u06cc\u06cc\u062f \u0647\u0645 \u0639\u0636\u0648\u06cc\u062a \u0641\u0639\u0627\u0644 \u062f\u0627\u0631\u062f.",
    en: "User has an active membership outside the approval scope.",
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
  "Submitters cannot lock their own KPI data.": {
    fa: "ثبت‌کننده نمی‌تواند دادهٔ KPI خود را قفل کند.",
    en: "Submitters cannot lock their own KPI data.",
  },
  "Only approved check-ins can be locked.": {
    fa: "فقط ثبت‌های تأییدشده قابل قفل‌شدن هستند.",
    en: "Only approved check-ins can be locked.",
  },
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
  "The selected manager is not a member of this company.": {
    fa: "مدیر انتخاب‌شده عضو این شرکت نیست.",
    en: "The selected manager is not a member of this company.",
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
  "Evidence file is required and must be at most 1 MB.": {
    fa: "\u0627\u0631\u0633\u0627\u0644 \u0641\u0627\u06cc\u0644 \u0645\u062f\u0631\u06a9 \u0628\u0627 \u062d\u062c\u0645 \u062d\u062f\u0627\u06a9\u062b\u0631 \u06f1 \u0645\u06af\u0627\u0628\u0627\u06cc\u062a \u0627\u0644\u0632\u0627\u0645\u06cc \u0627\u0633\u062a.",
    en: "Evidence file is required and must be at most 1 MB.",
  },
  "Unsupported evidence file.": {
    fa: "\u0641\u0631\u0645\u062a \u0641\u0627\u06cc\u0644 \u0645\u062f\u0631\u06a9 \u067e\u0634\u062a\u06cc\u0628\u0627\u0646\u06cc \u0646\u0645\u06cc\u200c\u0634\u0648\u062f.",
    en: "Unsupported evidence file.",
  },
  "Action approver must be an active different user in the selected department.":
    {
      fa: "\u062a\u0623\u06cc\u06cc\u062f\u06a9\u0646\u0646\u062f\u0647 \u0628\u0627\u06cc\u062f \u06a9\u0627\u0631\u0628\u0631 \u0641\u0639\u0627\u0644 \u0648 \u0645\u062a\u0641\u0627\u0648\u062a\u06cc \u062f\u0631 \u0648\u0627\u062d\u062f \u0627\u0646\u062a\u062e\u0627\u0628\u200c\u0634\u062f\u0647 \u0628\u0627\u0634\u062f.",
      en: "Action approver must be an active different user in the selected department.",
    },
};

export function resolveLocale(value?: string | string[] | null): AppLocale {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.toLowerCase().startsWith("en") ? "en" : "fa";
}
