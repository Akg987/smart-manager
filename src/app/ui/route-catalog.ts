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
  "/ai": {
    path: "/ai",
    title: "دستیار هوشمند",
    eyebrow: "تحلیل مدیریتی",
    description: "گفت‌وگو با داده‌های مجاز و دریافت پیشنهادهای قابل بازبینی.",
    kind: "table",
  },
  "/ai/chat": {
    path: "/ai/chat",
    title: "گفت‌وگوی هوشمند",
    eyebrow: "تحلیل مدیریتی",
    description: "پرسش دربارهٔ شاخص‌های عملکرد و گردش‌های مدیریتی در محدودهٔ مجاز.",
    kind: "table",
  },
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
  "/dashboards": {
    path: "/dashboards",
    title: "داشبوردهای پویا",
    eyebrow: "سازنده داشبورد",
    description:
      "داشبوردهای نقش‌محور را با ویجت‌های مجاز بسازید، ویرایش کنید و منتشر کنید.",
    kind: "table",
  },
  "/dashboards/create": {
    path: "/dashboards/create",
    title: "ساخت داشبورد",
    eyebrow: "سازنده داشبورد",
    description: "چیدمان و ویجت‌های داشبورد را بر اساس دسترسی خود تنظیم کنید.",
    kind: "form",
  },
  "/formulas": {
    path: "/formulas",
    title: "استودیوی فرمول‌ها",
    eyebrow: "شاخص عملکرد مشتق‌شده",
    description:
      "فرمول را اعتبارسنجی و شاخص عملکرد مشتق‌شدهٔ نسخه‌دار ایجاد و محاسبه کنید.",
    kind: "table",
  },
  "/formulas/create": {
    path: "/formulas/create",
    title: "ساخت فرمول",
    eyebrow: "استودیوی فرمول‌ها",
    description: "منابع مجاز شاخص‌های عملکرد را به فرمولی امن و قابل‌ردیابی تبدیل کنید.",
    kind: "form",
  },
  "/decisions": {
    path: "/decisions",
    title: "پیگیری تصمیم‌ها",
    eyebrow: "گردش کار مدیریت",
    description:
      "تصمیم‌ها را ثبت کنید، برای اجرا پیگیری کنید و نتیجه را بازبینی کنید.",
    kind: "table",
  },
  "/management-reviews": {
    path: "/management-reviews",
    title: "مرورهای هفتگی و ماهانه",
    eyebrow: "گزارش مدیریتی",
    description: "جلسه‌های هفتگی و ماهانه را با تصویر ثبت‌شدهٔ هر دوره مدیریت کنید.",
    kind: "table",
  },
  "/management-reviews/create": {
    path: "/management-reviews/create",
    title: "ساخت مرور مدیریتی",
    eyebrow: "گزارش مدیریتی",
    description: "پیش‌نویس مرور هفتگی یا ماهانه را برای دورهٔ انتخابی ایجاد کنید.",
    kind: "form",
  },
  "/management-automation": {
    path: "/management-automation",
    title: "یادآوری و تشدید",
    eyebrow: "اتوماسیون مدیریتی",
    description:
      "قواعد تشدید و یادآوری مهلت‌ها را در محدودهٔ مجاز پیکربندی کنید.",
    kind: "settings",
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
  "/admin/tenants": {
    path: "/admin/tenants",
    title: "ساختار شرکت",
    eyebrow: "ساختار سازمانی",
    description:
      "مدیریت شرکت‌ها، شعبه‌ها و واحدهای کسب‌وکار در محدوده دسترسی شما.",
    kind: "settings",
  },
  "/accept-invitation": {
    path: "/accept-invitation",
    title: "پذیرش دعوت شرکت",
    eyebrow: "عضویت سازمانی",
    description: "دعوت شرکت با تطبیق شمارهٔ موبایل حساب پذیرش می‌شود.",
    kind: "settings",
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
    title: "استودیوی شاخص‌های عملکرد",
    headline: "شاخص‌های عملکرد بدون تغییر کد قابل تنظیم‌اند",
    eyebrow: "قرارداد دادهٔ شاخص عملکرد",
    description:
      "فرمول، هدف، آستانه، نقش‌ها و زمان‌بندی هر شاخص عملکرد نسخه‌دار و قابل پیگیری هستند.",
    kind: "board",
    board: "kpis",
    actionLabel: "ساخت شاخص عملکرد",
  },
  "/kpis/create": {
    path: "/kpis/create",
    title: "تعریف شاخص جدید",
    eyebrow: "قرارداد دادهٔ شاخص عملکرد",
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
      "هر کارت یک شاخص عملکرد و یک دورهٔ مشخص است. ثبت داده با موبایل کمتر از سه دقیقه زمان می‌گیرد.",
    kind: "board",
    board: "checkins",
  },
  "/checkins/review": {
    path: "/checkins/review",
    title: "بررسی داده‌های شاخص‌های عملکرد",
    eyebrow: "گردش‌کار داده",
    description:
      "ثبت‌ها را بررسی کنید؛ ثبت‌کننده اجازهٔ تأیید دادهٔ خودش را ندارد.",
    kind: "table",
  },
  "/red-flags": {
    path: "/red-flags",
    title: "پرچم‌های قرمز",
    eyebrow: "پایش انحراف",
    description:
      "علت، مسئول و پیگیری موارد بحرانی را در محدودهٔ دسترسی خود مدیریت کنید.",
    kind: "table",
  },
  "/observations": {
    path: "/observations",
    title: "مشاهدات مدیریتی",
    eyebrow: "مرور عملکرد",
    description: "مشاهدات دوره‌ای را ثبت و در مرور مدیریتی پیگیری کنید.",
    kind: "table",
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
      "هر اقدام باید مسئول، موعد و معیار موفقیت داشته باشد تا اثر آن بر شاخص عملکرد دیده شود.",
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
    title: "درگاه پیامک آی‌پی‌پنل",
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
  if (/^\/dashboards\/\d+$/.test(path))
    return {
      path,
      title: "داشبورد",
      eyebrow: "سازنده داشبورد",
      description: "نمایش، پیش‌نمایش یا ویرایش داشبورد انتخاب‌شده.",
      kind: "table",
    };
  if (/^\/formulas\/\d+$/.test(path))
    return {
      path,
      title: "شاخص عملکرد مشتق‌شده",
      eyebrow: "استودیوی فرمول‌ها",
      description: "محاسبه و بررسی ریزدانهٔ نسخهٔ انتخاب‌شده.",
      kind: "table",
    };
  if (/^\/management-reviews\/\d+$/.test(path))
    return {
      path,
      title: "جزئیات مرور مدیریتی",
      eyebrow: "گزارش مدیریتی",
      description: "تصویر ثبت‌شده، انتشار و جمع‌بندی جلسه را مدیریت کنید.",
      kind: "table",
    };
  if (/^\/kpis\/[^/]+\/data$/.test(path))
    return {
      path,
      title: "ثبت دادهٔ شاخص عملکرد",
      eyebrow: "گردش گزارش",
      description: "مقدار و شواهد این دوره را ثبت کنید.",
      kind: "table",
    };
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
  if (/^\/kpis\/[^/]+\/history$/.test(path))
    return {
      path,
      title: "تاریخچهٔ شاخص عملکرد",
      eyebrow: "نسخه و دادهٔ مصوب",
      description: "نسخه‌های تعریف و داده‌های تأییدشدهٔ شاخص را مرور کنید.",
      kind: "table",
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
