export type PageKind =
  | "dashboard"
  | "table"
  | "form"
  | "profile"
  | "settings"
  | "weekly"
  | "board"
  | "directory";

export type RoutePage = {
  path: string;
  title: string;
  headline?: string;
  eyebrow: string;
  description: string;
  kind: PageKind;
  board?: "checkins" | "alerts" | "actions" | "kpis";
  directory?: "users" | "departments";
  collection?:
    | "users"
    | "departments"
    | "access-levels"
    | "audit"
    | "modules"
    | "kpis"
    | "checkins"
    | "actions"
    | "alerts"
    | "priorities"
    | "inbox";
  form?:
    | "department"
    | "access-level"
    | "user"
    | "kpi"
    | "checkin"
    | "action"
    | "priority"
    | "module"
    | "settings-general"
    | "settings-roles"
    | "sms"
    | "profile-personal"
    | "profile-photo"
    | "profile-security";
  actionLabel?: string;
};

const catalog: Record<string, RoutePage> = {
  "/": {
    path: "/",
    title: "نمای کلی سازمان",
    eyebrow: "مرکز فرمان",
    description: "به‌روزرسانی وضعیت بر اساس آخرین ثبت‌های تیم.",
    kind: "dashboard",
  },
  "/dashboard": {
    path: "/dashboard",
    title: "نمای کلی سازمان",
    eyebrow: "مرکز فرمان",
    description: "به‌روزرسانی وضعیت بر اساس آخرین ثبت‌های تیم.",
    kind: "dashboard",
  },
  "/admin/users": {
    path: "/admin/users",
    title: "کاربران",
    headline: "اسمارت منیجر در یک نگاه",
    eyebrow: "ساختار سازمانی",
    description:
      "سطح دسترسی هر شخص در همین سازمان تعریف می‌شود و فقط داده مجاز خودش را می‌بیند.",
    kind: "directory",
    directory: "users",
  },
  "/admin/departments": {
    path: "/admin/departments",
    title: "واحدهای سازمانی",
    headline: "واحدهای سازمانی",
    eyebrow: "سازمان",
    description:
      "واحدها مبنای محدوده داده ماژول‌ها هستند. کاربری بدون واحد، داده واحد–محور را نمی‌بیند.",
    kind: "directory",
    directory: "departments",
  },
  "/admin/access-levels": {
    path: "/admin/access-levels",
    title: "سطح‌های دسترسی",
    eyebrow: "مجوزها",
    description: "بسته‌های دسترسی و دامنهٔ مجوزها را مدیریت کنید.",
    kind: "table",
    collection: "access-levels",
    actionLabel: "ساخت سطح دسترسی",
  },
  "/admin/access-levels/create": {
    path: "/admin/access-levels/create",
    title: "ساخت سطح دسترسی",
    eyebrow: "مجوزها",
    description: "یک سطح دسترسی برای کاربران سازمان تعریف کنید.",
    kind: "form",
    form: "access-level",
  },
  "/admin/roles": {
    path: "/admin/roles",
    title: "نقش‌ها و مجوزها",
    eyebrow: "مجوزها",
    description: "مجوزهای نقش‌های سامانه را مرور کنید.",
    kind: "settings",
    form: "settings-roles",
  },
  "/admin/audit-log": {
    path: "/admin/audit-log",
    title: "تاریخچه و ممیزی",
    eyebrow: "سامانه",
    description:
      "ثبت تغییرپذیر نیست؛ هر رویداد پس از ثبت قابل ویرایش یا حذف دستی نیست.",
    kind: "table",
    collection: "audit",
  },
  "/admin/modules": {
    path: "/admin/modules",
    title: "ماژول‌ها",
    eyebrow: "سامانه",
    description: "ماژول‌های نصب‌شده و وضعیت فعال بودن آن‌ها.",
    kind: "table",
    collection: "modules",
  },
  "/profile": {
    path: "/profile",
    title: "اطلاعات شخصی",
    eyebrow: "پروفایل",
    description: "نام، کد ملی، تاریخ تولد و نشانی حساب شما در اسمارت منیجر.",
    kind: "profile",
    form: "profile-personal",
  },
  "/profile/photo": {
    path: "/profile/photo",
    title: "عکس پروفایل",
    eyebrow: "پروفایل",
    description: "عکس حساب را جدا از اطلاعات شخصی و رمز عبور مدیریت کنید.",
    kind: "profile",
    form: "profile-photo",
  },
  "/profile/security": {
    path: "/profile/security",
    title: "تنظیمات امنیتی",
    eyebrow: "پروفایل",
    description:
      "رمز عبور حساب را از اینجا تغییر کنید. نام کاربری ورود تغییر نمی‌کند.",
    kind: "profile",
    form: "profile-security",
  },
  "/settings": {
    path: "/settings",
    title: "تنظیمات",
    eyebrow: "پیکربندی پنل",
    description: "برچسب‌ها و رفتارهایی که در کل سامانه استفاده می‌شوند.",
    kind: "settings",
  },
  "/settings/general": {
    path: "/settings/general",
    title: "تنظیمات",
    eyebrow: "پیکربندی پنل",
    description: "نام شرکت و لوگوی نمایش‌داده‌شده را تنظیم کنید.",
    kind: "settings",
    form: "settings-general",
  },
  "/settings/about": {
    path: "/settings/about",
    title: "تنظیمات",
    eyebrow: "پیکربندی پنل",
    description: "اطلاعات نسخه و قابلیت‌های سامانه.",
    kind: "settings",
  },
  "/settings/roles": {
    path: "/settings/roles",
    title: "تنظیمات",
    eyebrow: "پیکربندی پنل",
    description: "سطح‌های دسترسی را بسازید و به کاربران تخصیص دهید.",
    kind: "settings",
    form: "settings-roles",
  },
  "/settings/action-priorities": {
    path: "/settings/action-priorities",
    title: "تنظیمات",
    eyebrow: "پیکربندی پنل",
    description: "عنوان‌های اولویت اقدام را مدیریت کنید.",
    kind: "settings",
  },
  "/settings/kpi-options": {
    path: "/settings/kpi-options",
    title: "تنظیمات",
    eyebrow: "پیکربندی پنل",
    description: "گزینه‌های نوع ورودی، جهت و تناوب شاخص‌ها.",
    kind: "settings",
  },
  "/kpis": {
    path: "/kpis",
    title: "استودیو KPI",
    headline: "KPIها بدون تغییر کد قابل تنظیم‌اند",
    eyebrow: "قرارداد داده KPI",
    description:
      "فرمول، هدف، آستانه، نقش‌ها و زمان‌بندی هر KPI نسخه‌دار و قابل پیگیری هستند.",
    kind: "board",
    board: "kpis",
    actionLabel: "ساخت KPI",
  },
  "/kpis/create": {
    path: "/kpis/create",
    title: "تعریف شاخص جدید",
    eyebrow: "قرارداد داده KPI",
    description: "مشخصات، هدف و آستانه یک شاخص را تعریف کنید.",
    kind: "form",
    form: "kpi",
  },
  "/checkins": {
    path: "/checkins",
    title: "ثبت‌های من",
    headline: "ثبت‌هایی که منتظر شما هستند",
    eyebrow: "ورود اطلاعات پرسنل",
    description:
      "هر کارت یک KPI و یک دوره مشخص است. ثبت داده با موبایل کمتر از سه دقیقه زمان می‌گیرد.",
    kind: "board",
    board: "checkins",
  },
  "/kpi-reports/weekly": {
    path: "/kpi-reports/weekly",
    title: "گزارش هفته جاری",
    eyebrow: "مرور مدیریتی",
    description: "خلاصه‌ای از تکمیل داده، انحراف‌های مهم و اقدام‌های هفته بعد.",
    kind: "weekly",
  },
  "/actions": {
    path: "/actions",
    title: "اقدام‌ها",
    headline: "اقدام‌ها را قابل سنجش نگه دارید",
    eyebrow: "بستن حلقه کنترل",
    description:
      "هر اقدام باید مسئول، موعد و معیار موفقیت داشته باشد تا اثر آن روی KPI دیده شود.",
    kind: "board",
    board: "actions",
    actionLabel: "اقدام جدید",
  },
  "/actions/create": {
    path: "/actions/create",
    title: "اقدام جدید",
    eyebrow: "بستن حلقه کنترل",
    description: "برای هر اقدام مسئول، موعد و معیار موفقیت مشخص کنید.",
    kind: "form",
    form: "action",
  },
  "/alerts": {
    path: "/alerts",
    title: "هشدارها",
    headline: "هشدارها را به تصمیم تبدیل کنید",
    eyebrow: "کنترل انحراف",
    description:
      "قواعد قطعی وضعیت را مشخص می‌کنند؛ پیشنهاد محلی فقط به تصمیم شما کمک می‌کند.",
    kind: "board",
    board: "alerts",
  },
  "/sms-ippanel-hub": {
    path: "/sms-ippanel-hub",
    title: "درگاه پیامک IPPanel",
    eyebrow: "مدیریت ماژول",
    description: "تنظیمات اتصال، اعتبار حساب و ارسال آزمایشی پیامک.",
    kind: "settings",
    form: "sms",
  },
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
  if (/^\/kpis\/[^/]+(?:\/edit)?$/.test(path))
    return {
      path,
      title: path.endsWith("/edit") ? "ویرایش شاخص" : "جزئیات شاخص",
      eyebrow: "مدیریت عملکرد",
      description: "مشخصات و گزارش‌های شاخص انتخاب‌شده.",
      kind: path.endsWith("/edit") ? "form" : "table",
      form: "kpi",
      collection: "kpis",
      actionLabel: "ویرایش شاخص",
    };
  if (/^\/admin\/access-levels\/[^/]+\/edit$/.test(path))
    return {
      path,
      title: "ویرایش سطح دسترسی",
      eyebrow: "مجوزها",
      description: "مجوزهای سطح دسترسی انتخاب‌شده را تنظیم کنید.",
      kind: "form",
      form: "access-level",
    };
  return null;
}

export const settingsTabs = [
  { label: "درباره سامانه", href: "/settings/about", icon: "ni-info" },
  { label: "تنظیمات عمومی", href: "/settings/general", icon: "ni-setting" },
  { label: "نقش‌ها و مجوزها", href: "/settings/roles", icon: "ni-shield" },
];
