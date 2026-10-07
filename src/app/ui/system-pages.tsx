import Link from "next/link";
import { serverApi } from "@/lib/api-server";
import type { RoutePage } from "./route-catalog";
import {
  AuditTable,
  ExcelButton,
  GeneralSettings,
  KpiOptionGroups,
  ModulesTable,
  PriorityEditor,
  type AuditRow,
  type ModuleRow,
  type NamedRow,
} from "./system-client";

function rows<T>(value: T[] | null) {
  return Array.isArray(value) ? value : [];
}

function faNum(value: unknown) {
  return String(value ?? 0).replace(
    /[0-9]/g,
    (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)],
  );
}

function jalaliDate(date: Date) {
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Tehran",
  }).format(date);
}

function tehranWeek(now = new Date()) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tehran",
    weekday: "short",
  }).format(now);
  const sinceSaturday =
    { Sat: 0, Sun: 1, Mon: 2, Tue: 3, Wed: 4, Thu: 5, Fri: 6 }[weekday] ?? 0;
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(now)
    .split("-")
    .map(Number);
  const start = new Date(Date.UTC(year, month - 1, day));
  start.setUTCDate(start.getUTCDate() - sinceSaturday);
  const from = new Date(start.getTime() - (3 * 60 + 30) * 60 * 1000);
  return { from, to: new Date(from.getTime() + 6 * 24 * 60 * 60 * 1000) };
}

type Weekly = {
  priorities: { id: string; title: string }[];
  nextActions: { id: string; title: string; owner: string }[];
  resolvedAlerts: number;
  completedActions: number;
} | null;

type KpiDash = { completion: number; attention: number; period: string } | null;

const settingsTabs = [
  { id: "general", href: "/settings/general", label: "عمومی" },
  { id: "access", href: "/settings/roles", label: "سطح دسترسی" },
  { id: "kpi", href: "/settings/kpi-options", label: "استودیو KPI" },
  { id: "actions", href: "/settings/action-priorities", label: "اقدام" },
  { id: "about", href: "/settings/about", label: "درباره ما" },
];

function settingsTab(path: string) {
  if (path.startsWith("/settings/roles")) return "access";
  if (path.startsWith("/settings/kpi-options")) return "kpi";
  if (path.startsWith("/settings/action-priorities")) return "actions";
  if (path.startsWith("/settings/about")) return "about";
  return "general";
}

function SettingsFrame({
  path,
  children,
}: {
  path: string;
  children: React.ReactNode;
}) {
  const current = settingsTab(path);
  return (
    <div className="sm-catalog-page">
      <header className="sm-catalog-head">
        <div>
          <span className="sm-page-head__eyebrow">پیکربندی پنل</span>
          <h1>تنظیمات</h1>
          <p>برچسب‌ها و رفتارهایی که در کل سامانه استفاده می‌شوند.</p>
        </div>
      </header>
      <section className="card card-bordered sm-settings-card">
        <nav className="sm-settings-tabs" aria-label="بخش‌های تنظیمات">
          {settingsTabs.map((tab) => (
            <Link
              key={tab.id}
              href={tab.href}
              className={tab.id === current ? "is-active" : ""}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
        <div className="sm-settings-body">{children}</div>
      </section>
    </div>
  );
}

export async function WeeklyBoard() {
  const [weekly, kpis] = await Promise.all([
    serverApi<Weekly>("actions/weekly"),
    serverApi<KpiDash>("kpis"),
  ]);
  const board = weekly.data;
  const completion = kpis.data?.completion ?? 0;
  const attention = kpis.data?.attention ?? 0;
  const { from, to } = tehranWeek();
  const priorities = board?.priorities ?? [];
  const actions = board?.nextActions ?? [];
  const csv = [
    ["بخش", "عنوان", "جزئیات"],
    ["تکمیل داده", `${completion}%`, "هدف پایلوت ۸۵٪"],
    ["هشدار حل‌شده", String(board?.resolvedAlerts ?? 0), "از ابتدای هفته"],
    ["اقدام مؤثر", String(board?.completedActions ?? 0), "پس از سنجش KPI"],
    ...priorities.map((item) => ["اولویت", item.title, ""]),
    ...actions.map((item) => ["اقدام هفته بعد", item.title, item.owner]),
  ];
  return (
    <div className="sm-catalog-page">
      <div className="sm-catalog-head">
        <div>
          <span className="sm-page-head__eyebrow">مرور مدیریتی</span>
          <h1>گزارش هفته جاری</h1>
          <p>خلاصه‌ای از تکمیل داده، انحراف‌های مهم و اقدام‌های هفته بعد.</p>
        </div>
        <ExcelButton rows={csv} />
      </div>
      {(weekly.error || kpis.error) && (
        <div role="alert" className="alert alert-warning">
          {weekly.error || kpis.error}
        </div>
      )}
      <div className="sm-week-grid">
        <article className="sm-week-lead">
          <h2>
            {attention > 0
              ? `${faNum(attention)} شاخص نیازمند اقدام فوری است.`
              : "شاخص نیازمند اقدام فوری نیست."}
          </h2>
          <p>
            این گزارش به شکل خودکار از داده‌های ثبت‌شده محیط محلی تهیه می‌شود و
            برای جلسه هفتگی آماده است.
          </p>
          <div className="sm-brief-meta">
            <span>
              بازه: {jalaliDate(from)} تا {jalaliDate(to)}
            </span>
            <span>نسخه محلی</span>
          </div>
        </article>
        <article className="sm-week-side">
          <h3>سه اولویت</h3>
          {priorities.length === 0 ? (
            <p>موردی برای نمایش نیست.</p>
          ) : (
            priorities.map((item) => <p key={item.id}>{item.title}</p>)
          )}
        </article>
        <article className="sm-week-side">
          <h3>اقدام هفته بعد</h3>
          {actions.length === 0 ? (
            <p>موردی برای نمایش نیست.</p>
          ) : (
            actions.map((item) => <p key={item.id}>{item.title}</p>)
          )}
        </article>
      </div>
      <div className="sm-report-metrics">
        <article className="card card-bordered sm-stat-card sm-stat-teal">
          <span className="sm-stat-orb" />
          <div className="card-inner">
            <span className="overline-title">تکمیل داده</span>
            <div className="sm-stat-value">{faNum(completion)}٪</div>
            <p className="text-soft mb-0">هدف پایلوت: ۸۵٪</p>
          </div>
        </article>
        <article className="card card-bordered sm-stat-card sm-stat-orange">
          <span className="sm-stat-orb" />
          <div className="card-inner">
            <span className="overline-title">هشدار حل‌شده</span>
            <div className="sm-stat-value">
              {faNum(board?.resolvedAlerts ?? 0)}
            </div>
            <p className="text-soft mb-0">از ابتدای هفته</p>
          </div>
        </article>
        <article className="card card-bordered sm-stat-card sm-stat-ink">
          <span className="sm-stat-orb" />
          <div className="card-inner">
            <span className="overline-title">اقدام مؤثر</span>
            <div className="sm-stat-value">
              {faNum(board?.completedActions ?? 0)}
            </div>
            <p className="text-soft mb-0">پس از سنجش KPI</p>
          </div>
        </article>
      </div>
    </div>
  );
}

export async function ModulesBoard() {
  const result = await serverApi<ModuleRow[]>("data/modules");
  return <ModulesTable rows={rows(result.data)} />;
}

export async function AuditBoard() {
  const result = await serverApi<AuditRow[]>("data/audit");
  return (
    <>
      {result.error && (
        <div role="alert" className="alert alert-warning">
          {result.error}
        </div>
      )}
      <AuditTable rows={rows(result.data)} />
    </>
  );
}

export async function SettingsBoard({ page }: { page: RoutePage }) {
  const tab = settingsTab(page.path);
  return (
    <SettingsFrame path={page.path}>
      {tab === "general" ? (
        <GeneralTab />
      ) : tab === "access" ? (
        <AccessTab />
      ) : tab === "kpi" ? (
        <KpiTab />
      ) : tab === "actions" ? (
        <ActionsTab />
      ) : (
        <AboutTab />
      )}
    </SettingsFrame>
  );
}

async function GeneralTab() {
  const result = await serverApi<{
    companyName?: string;
    logoPath?: string | null;
  }>("settings/branding");
  const branding = result.data;
  return (
    <GeneralSettings
      companyName={branding?.companyName || "اسمارت منیجر"}
      hasLogo={Boolean(branding?.logoPath)}
    />
  );
}

async function AccessTab() {
  const result =
    await serverApi<{ id: string; name: string; usersCount?: number }[]>(
      "data/access-levels",
    );
  const levels = rows(result.data);
  return (
    <div className="sm-access-panel">
      <div className="sm-access-top">
        <div>
          <h2>سطح دسترسی</h2>
          <p>
            سطح‌های دسترسی را بسازید، به واحد وصل کنید و به کاربران تخصیص دهید.
            مدیر سیستم خارج از این فهرست است.
          </p>
        </div>
        <Link href="/admin/access-levels/create" className="btn btn-primary">
          <span>ساخت سطح</span>
          <em className="icon ni ni-plus" />
        </Link>
      </div>
      {levels.length === 0 ? (
        <div className="sm-access-empty">
          هنوز سطح دسترسی‌ای ساخته نشده است. با «ساخت سطح» شروع کنید.
        </div>
      ) : (
        <div className="sm-access-list">
          {levels.map((level) => (
            <Link key={level.id} href={`/admin/access-levels/${level.id}/edit`}>
              {level.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

async function KpiTab() {
  const [inputModes, directions, frequencies] = await Promise.all([
    serverApi<NamedRow[]>("kpis/options/input_mode"),
    serverApi<NamedRow[]>("kpis/options/direction"),
    serverApi<NamedRow[]>("kpis/options/frequency"),
  ]);
  return (
    <KpiOptionGroups
      inputModes={rows(inputModes.data)}
      directions={rows(directions.data)}
      frequencies={rows(frequencies.data)}
    />
  );
}

async function ActionsTab() {
  const result = await serverApi<NamedRow[]>("actions/priorities");
  return <PriorityEditor rows={rows(result.data)} />;
}

async function AboutTab() {
  const result = await serverApi<ModuleRow[]>("data/modules");
  const modules = rows(result.data);
  return (
    <div className="sm-about-page">
      <div className="sm-about-hero">
        <div>
          <span className="sm-page-head__eyebrow">هسته سامانه</span>
          <h2 className="sm-about-hero__title">اسمارت منیجر</h2>
          <p className="sm-about-hero__lead">
            هسته سامانه مدیریت KPI، ثبت داده پرسنل، هشدار، اقدام اصلاحی و معماری
            ماژول فارسی — مشابه افزونه وردپرس قابل توسعه است.
          </p>
        </div>
        <div className="sm-about-hero__version">
          <small>نسخه</small>
          <strong>v1.0.0</strong>
        </div>
      </div>
      <div className="sm-about-meta">
        <div>
          <small>ایجادکننده</small>
          <strong>تیم اسمارت‌لوکس</strong>
        </div>
        <div>
          <small>مجوز</small>
          <strong>Proprietary</strong>
        </div>
        <div>
          <small>نام داخلی</small>
          <strong dir="ltr">Smart Manager</strong>
        </div>
        <div>
          <small>شناسه</small>
          <strong dir="ltr">smart-manager</strong>
        </div>
        <div>
          <small>حداقل Node</small>
          <strong dir="ltr">20+</strong>
        </div>
        <div>
          <small>دامنه ترجمه</small>
          <strong dir="ltr">smart-manager</strong>
        </div>
        <div>
          <small>نشانی</small>
          <strong dir="ltr">
            <a href="https://smerlux.ir">https://smerlux.ir</a>
          </strong>
        </div>
      </div>
      <div className="sm-about-tags">
        <span>core</span>
        <span>kpi</span>
        <span>nest</span>
        <span>next</span>
        <span>rtl</span>
      </div>
      <h3>محیط اجرا</h3>
      <div className="sm-about-env__grid">
        <div>
          <small>Node</small>
          <strong dir="ltr">{process.version}</strong>
        </div>
        <div>
          <small>رابط</small>
          <strong dir="ltr">Next.js</strong>
        </div>
        <div>
          <small>سرویس</small>
          <strong dir="ltr">NestJS</strong>
        </div>
        <div>
          <small>نسخه هسته</small>
          <strong dir="ltr">v1.0.0</strong>
        </div>
      </div>
      <h3>ماژول‌های نصب‌شده</h3>
      <p>هر ماژول مثل افزونه وردپرس شناسنامه، نسخه و نویسنده دارد.</p>
      <div className="sm-about-modules">
        <div className="sm-about-module-head">
          <span>ماژول</span>
          <span>نسخه</span>
          <span>ایجادکننده</span>
          <span>وضعیت</span>
        </div>
        {modules.map((module) => (
          <article key={module.slug}>
            <div>
              <strong>{module.name}</strong>
              <small>{moduleCopyLead(module.slug)}</small>
            </div>
            <span dir="ltr">v{module.version}</span>
            <span>تیم اسمارت‌لوکس</span>
            <span className={module.isActive ? "is-on" : ""}>
              {module.isActive ? "فعال" : "غیرفعال"}
            </span>
          </article>
        ))}
      </div>
    </div>
  );
}

function moduleCopyLead(slug: string) {
  if (slug === "kpi-management")
    return "تعریف شاخص‌های کلیدی عملکرد، ثبت دوره‌ای مقدار توسط پرسنل، محاسبه سلامت سبز/زرد/قرمز استودیو KPI.";
  if (slug === "corrective-actions")
    return "مدیریت هشدارها و کانبان اقدام اصلاحی؛ به کانبان اقدام‌ها از طریق قالب وصل می‌شود.";
  if (slug === "sms-ippanel-hub")
    return "هاب اتصال به پنل پیامکی IPPanel. سایر ماژول‌ها فقط کد پترن و متغیرها را ارسال می‌کنند.";
  return "ماژول نصب‌شده سامانه.";
}
