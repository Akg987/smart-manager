export type PageKind = "dashboard" | "table" | "form" | "profile" | "settings" | "weekly";

export type RoutePage = {
  path: string;
  title: string;
  eyebrow: string;
  description: string;
  kind: PageKind;
  collection?: "users" | "departments" | "access-levels" | "audit" | "modules" | "kpis" | "checkins" | "actions" | "alerts" | "priorities" | "inbox";
  form?: "department" | "access-level" | "user" | "kpi" | "checkin" | "action" | "priority" | "module" | "settings-general" | "settings-roles" | "sms" | "profile-personal" | "profile-photo" | "profile-security";
  actionLabel?: string;
};

const catalog: Record<string, RoutePage> = {
  "/": { path: "/", title: "داشبورد", eyebrow: "نمای کلی", description: "وضعیت شاخص‌ها و اقدام‌های سازمان را در یک نگاه دنبال کنید.", kind: "dashboard" },
  "/dashboard": { path: "/dashboard", title: "داشبورد", eyebrow: "نمای کلی", description: "وضعیت شاخص‌ها و اقدام‌های سازمان را در یک نگاه دنبال کنید.", kind: "dashboard" },
  "/admin/users": { path: "/admin/users", title: "مدیریت کاربران", eyebrow: "سازمان", description: "کاربران، وضعیت دسترسی و عضویت سازمانی را مدیریت کنید.", kind: "table", collection: "users", actionLabel: "افزودن کاربر" },
  "/admin/departments": { path: "/admin/departments", title: "واحدهای سازمانی", eyebrow: "سازمان", description: "واحدها و مسئولیت‌های سازمانی را مشاهده و مدیریت کنید.", kind: "table", collection: "departments", actionLabel: "افزودن واحد" },
  "/admin/access-levels": { path: "/admin/access-levels", title: "سطح‌های دسترسی", eyebrow: "مجوزها", description: "بسته‌های دسترسی و دامنهٔ مجوزها را مدیریت کنید.", kind: "table", collection: "access-levels", actionLabel: "ساخت سطح دسترسی" },
  "/admin/access-levels/create": { path: "/admin/access-levels/create", title: "ساخت سطح دسترسی", eyebrow: "مجوزها", description: "یک سطح دسترسی برای کاربران سازمان تعریف کنید.", kind: "form", form: "access-level" },
  "/admin/roles": { path: "/admin/roles", title: "نقش‌ها و مجوزها", eyebrow: "مجوزها", description: "مجوزهای نقش‌های سامانه را مرور کنید.", kind: "settings", form: "settings-roles" },
  "/admin/audit-log": { path: "/admin/audit-log", title: "گزارش رویدادها", eyebrow: "سامانه", description: "تغییرات و رویدادهای اخیر سامانه را مرور کنید.", kind: "table", collection: "audit" },
  "/admin/modules": { path: "/admin/modules", title: "مدیریت ماژول‌ها", eyebrow: "سامانه", description: "ماژول‌های نصب‌شده و قابلیت‌های آن‌ها را مدیریت کنید.", kind: "table", collection: "modules", actionLabel: "نصب ماژول" },
  "/profile": { path: "/profile", title: "اطلاعات شخصی", eyebrow: "پروفایل", description: "اطلاعات حساب و مشخصات فردی خود را مدیریت کنید.", kind: "profile", form: "profile-personal" },
  "/profile/photo": { path: "/profile/photo", title: "تصویر پروفایل", eyebrow: "پروفایل", description: "تصویر حساب کاربری خود را به‌روزرسانی کنید.", kind: "profile", form: "profile-photo" },
  "/profile/security": { path: "/profile/security", title: "امنیت حساب", eyebrow: "پروفایل", description: "رمز عبور و تنظیمات امنیتی حساب را مدیریت کنید.", kind: "profile", form: "profile-security" },
  "/settings": { path: "/settings", title: "تنظیمات سامانه", eyebrow: "سامانه", description: "تنظیمات و اطلاعات سامانه را مرور کنید.", kind: "settings" },
  "/settings/general": { path: "/settings/general", title: "تنظیمات عمومی", eyebrow: "سامانه", description: "نام و نشان سازمان را تنظیم کنید.", kind: "settings", form: "settings-general" },
  "/settings/about": { path: "/settings/about", title: "درباره سامانه", eyebrow: "سامانه", description: "اطلاعات نسخه و قابلیت‌های سامانه.", kind: "settings" },
  "/settings/roles": { path: "/settings/roles", title: "نقش‌ها", eyebrow: "سامانه", description: "مجوزهای نقش‌ها را مرور کنید.", kind: "settings", form: "settings-roles" },
  "/settings/action-priorities": { path: "/settings/action-priorities", title: "اولویت اقدام‌ها", eyebrow: "تنظیمات ماژول", description: "گزینه‌های اولویت برای اقدام‌های اصلاحی.", kind: "table", collection: "priorities", actionLabel: "افزودن اولویت" },
  "/settings/kpi-options": { path: "/settings/kpi-options", title: "تنظیمات استودیو شاخص", eyebrow: "تنظیمات ماژول", description: "گزینه‌های ورودی، جهت و دورهٔ شاخص‌ها.", kind: "table", collection: "priorities", actionLabel: "افزودن گزینه" },
  "/kpis": { path: "/kpis", title: "شاخص‌های کلیدی", eyebrow: "مدیریت عملکرد", description: "وضعیت و هدف شاخص‌های سازمان را دنبال کنید.", kind: "table", collection: "kpis", actionLabel: "تعریف شاخص" },
  "/kpis/create": { path: "/kpis/create", title: "تعریف شاخص جدید", eyebrow: "مدیریت عملکرد", description: "مشخصات و هدف یک شاخص را تعریف کنید.", kind: "form", form: "kpi" },
  "/checkins": { path: "/checkins", title: "ثبت عملکرد دوره‌ای", eyebrow: "مدیریت عملکرد", description: "مقدار شاخص‌های دوره را ثبت و بازبینی کنید.", kind: "table", collection: "checkins", actionLabel: "ثبت مقدار" },
  "/kpi-reports/weekly": { path: "/kpi-reports/weekly", title: "گزارش هفتگی", eyebrow: "مدیریت عملکرد", description: "خلاصهٔ هفتگی شاخص‌ها و اقدام‌های پیگیری.", kind: "weekly" },
  "/actions": { path: "/actions", title: "اقدام‌های اصلاحی", eyebrow: "بهبود مستمر", description: "اقدام‌های جاری و مسئولیت‌های پیگیری را مدیریت کنید.", kind: "table", collection: "actions", actionLabel: "ثبت اقدام" },
  "/alerts": { path: "/alerts", title: "هشدارها", eyebrow: "بهبود مستمر", description: "هشدارهای شاخص‌ها را بررسی و پیگیری کنید.", kind: "table", collection: "alerts" },
  "/sms-ippanel-hub": { path: "/sms-ippanel-hub", title: "درگاه پیامک IPPanel", eyebrow: "مدیریت ماژول", description: "تنظیمات اتصال، اعتبار حساب و ارسال آزمایشی پیامک.", kind: "settings", form: "sms" },
};

export function staticRouteSegments(): string[][] {
  return Object.keys(catalog)
    .filter((path) => path !== "/")
    .map((path) => path.split("/").filter(Boolean));
}

export function getRoutePage(segments: string[] = []): RoutePage | null {
  const path = `/${segments.join("/")}`;
  const direct = catalog[path];
  if (direct) return direct;
  if (/^\/kpis\/[^/]+(?:\/edit)?$/.test(path)) return { path, title: path.endsWith("/edit") ? "ویرایش شاخص" : "جزئیات شاخص", eyebrow: "مدیریت عملکرد", description: "مشخصات و گزارش‌های شاخص انتخاب‌شده.", kind: path.endsWith("/edit") ? "form" : "table", form: "kpi", collection: "kpis", actionLabel: "ویرایش شاخص" };
  if (/^\/admin\/access-levels\/[^/]+\/edit$/.test(path)) return { path, title: "ویرایش سطح دسترسی", eyebrow: "مجوزها", description: "مجوزهای سطح دسترسی انتخاب‌شده را تنظیم کنید.", kind: "form", form: "access-level" };
  return null;
}

export const settingsTabs = [
  { label: "درباره سامانه", href: "/settings/about", icon: "ni-info" },
  { label: "تنظیمات عمومی", href: "/settings/general", icon: "ni-setting" },
  { label: "نقش‌ها و مجوزها", href: "/settings/roles", icon: "ni-shield" },
];
