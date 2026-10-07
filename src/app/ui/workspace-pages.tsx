import Link from "next/link";
import {
  AvatarRemoveButton,
  DemoForm,
  ModuleToggle,
  type AuthField,
} from "./auth-form";
import { CommandStatusLine } from "./workspace-chrome";
import { getRoutePage, type RoutePage } from "./route-catalog";
import { serverApi } from "@/lib/api-server";
import { PerformanceBoard } from "./performance-pages";
import { OrganizationBoard } from "./organization-pages";
import { ProfileBoard } from "./profile-pages";
import {
  AuditBoard,
  ModulesBoard,
  SettingsBoard,
  WeeklyBoard,
} from "./system-pages";

type RecordValue = Record<string, unknown>;
const columns: Partial<
  Record<
    NonNullable<RoutePage["collection"]>,
    { labels: string[]; keys: string[]; api: string }
  >
> = {
  users: {
    labels: ["نام و نام خانوادگی", "موبایل", "نقش", "واحد", "وضعیت"],
    keys: ["fullName", "mobile", "role", "departmentId", "approvedAt"],
    api: "users",
  },
  departments: {
    labels: ["نام واحد", "کد", "مدیر"],
    keys: ["name", "code", "managerUserId"],
    api: "departments",
  },
  "access-levels": {
    labels: ["عنوان", "واحد", "مجوزها", "کاربران"],
    keys: ["name", "departmentId", "permissionsCount", "usersCount"],
    api: "access-levels",
  },
  audit: {
    labels: ["رویداد", "کاربر", "شرح", "زمان"],
    keys: ["action", "actorName", "description", "createdAt"],
    api: "audit",
  },
  modules: {
    labels: ["ماژول", "نسخه", "وضعیت"],
    keys: ["name", "version", "isActive"],
    api: "modules",
  },
  kpis: {
    labels: ["شاخص", "کد", "هدف", "واحد"],
    keys: ["name", "code", "targetValue", "departmentId"],
    api: "kpis",
  },
  checkins: {
    labels: ["دوره", "مقدار واقعی", "وضعیت", "ثبت‌کننده"],
    keys: ["period", "actualValue", "status", "userId"],
    api: "checkins",
  },
  actions: {
    labels: ["عنوان اقدام", "وضعیت", "اولویت", "مسئول", "موعد"],
    keys: ["title", "status", "priority", "ownerUserId", "dueAt"],
    api: "actions",
  },
  alerts: {
    labels: ["هشدار", "شدت", "وضعیت", "دوره"],
    keys: ["title", "severity", "status", "period"],
    api: "alerts",
  },
  inbox: {
    labels: ["عنوان", "نوع", "وضعیت", "زمان"],
    keys: ["title", "type", "readAt", "createdAt"],
    api: "inbox",
  },
  priorities: {
    labels: ["عنوان", "ترتیب"],
    keys: ["name", "position"],
    api: "priorities",
  },
};

function format(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "فعال" : "غیرفعال";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function faNum(value: unknown) {
  return String(value ?? 0).replace(
    /[0-9]/g,
    (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)],
  );
}

function asNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function PageHeading({
  page,
  action,
}: {
  page: RoutePage;
  action?: React.ReactNode;
}) {
  return (
    <div className="nk-block-head nk-block-head-sm">
      <div className="nk-block-between flex-wrap gap-3">
        <div className="nk-block-head-content">
          <span className="overline-title">{page.eyebrow}</span>
          <h1 className="nk-block-title page-title">
            {page.headline ?? page.title}
          </h1>
          <div className="nk-block-des text-soft">
            <p>{page.description}</p>
          </div>
        </div>
        {action && <div className="nk-block-head-content">{action}</div>}
      </div>
    </div>
  );
}

function StatCard({
  href,
  tone,
  label,
  value,
  detail,
}: {
  href: string;
  tone: "teal" | "orange" | "rose" | "ink";
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="col-md-3">
      <Link
        href={href}
        className={`card card-bordered h-100 sm-stat-card sm-stat-${tone}`}
      >
        <span className="sm-stat-orb" aria-hidden="true" />
        <div className="card-inner">
          <span className="overline-title">{label}</span>
          <div className="sm-stat-value mt-1">{value}</div>
          <span className="text-soft small">{detail}</span>
        </div>
      </Link>
    </div>
  );
}

async function Dashboard() {
  const [me, kpis, actions] = await Promise.all([
    serverApi<{ user?: { firstName?: string | null } }>("auth/me"),
    serverApi<{ dashboard: RecordValue | null }>("dashboard/kpis"),
    serverApi<{ dashboard: RecordValue | null }>("dashboard/actions"),
  ]);
  const kpi = kpis.data?.dashboard ?? {};
  const action = actions.data?.dashboard ?? {};
  const firstName = me.data?.user?.firstName?.trim() || "کاربر";
  const total = asNumber(kpi.total);
  const submitted = asNumber(kpi.submitted);
  const dueCount = asNumber(kpi.dueCount, Math.max(0, total - submitted));
  const completionLabel =
    typeof kpi.completionLabel === "string"
      ? kpi.completionLabel
      : `${faNum(asNumber(kpi.completion))}%`.replace("%", "٪");
  const attentionLabel =
    typeof kpi.attentionLabel === "string"
      ? kpi.attentionLabel
      : faNum(kpi.attention);
  const openAlertsLabel =
    typeof action.openAlertsLabel === "string"
      ? action.openAlertsLabel
      : faNum(action.openAlerts);
  const overdueLabel =
    typeof action.overdueLabel === "string"
      ? action.overdueLabel
      : faNum(action.overdue);
  const bars =
    Array.isArray(kpi.bars) && (kpi.bars as RecordValue[]).length > 0
      ? (kpi.bars as RecordValue[])
      : Array.from({ length: 8 }, () => ({ height: 12, health: "unknown" }));
  const due = Array.isArray(kpi.due) ? (kpi.due as RecordValue[]) : [];
  const priorities = Array.isArray(action.priorities)
    ? (action.priorities as RecordValue[])
    : [];
  const teamActions = Array.isArray(action.teamActions)
    ? (action.teamActions as RecordValue[])
    : [];
  const improving = kpi.improving !== false;
  const failure = kpis.error ?? actions.error;

  return (
    <>
      <div className="nk-block-head nk-block-head-sm">
        <div className="nk-block-between">
          <div className="nk-block-head-content">
            <span className="overline-title">مرکز فرمان</span>
            <h3 className="nk-block-title page-title">
              سلام {firstName} عزیز، امروز روی چه چیزی تمرکز می‌کنیم؟
            </h3>
            <div className="nk-block-des text-soft">
              <CommandStatusLine />
            </div>
          </div>
          <div className="nk-block-head-content">
            <Link href="/checkins" className="btn btn-primary">
              <em className="icon ni ni-plus" />
              <span>ثبت داده امروز</span>
            </Link>
          </div>
        </div>
      </div>
      <div className="nk-block">
        {failure && (
          <div role="alert" className="alert alert-fill alert-warning mb-3">
            {failure}
          </div>
        )}
        <div className="row g-gs">
          <StatCard
            href="/checkins"
            tone="teal"
            label="تکمیل داده"
            value={completionLabel}
            detail={`${faNum(submitted)} از ${faNum(total)} شاخص دوره جاری`}
          />
          <StatCard
            href="/kpis"
            tone="orange"
            label="KPI نیازمند توجه"
            value={attentionLabel}
            detail={`${faNum(dueCount)} مورد بدون ثبت این دوره`}
          />
          <StatCard
            href="/alerts"
            tone="rose"
            label="هشدار باز"
            value={openAlertsLabel}
            detail={`${faNum(action.critical)} هشدار بحرانی`}
          />
          <StatCard
            href="/actions"
            tone="ink"
            label="اقدام معوق"
            value={overdueLabel}
            detail="پیگیری تا پایان امروز"
          />
          <div className="col-md-6">
            <div className="card card-bordered h-100 sm-health-panel">
              <div className="card-inner">
                <div className="d-flex justify-content-between align-items-start mb-3">
                  <div>
                    <span className="overline-title">سلامت سبد KPI</span>
                    <h6 className="title mb-0">روند هشت ثبت اخیر</h6>
                  </div>
                  <span
                    className={`badge badge-dim ${improving ? "bg-success" : "bg-outline-light"}`}
                  >
                    {improving ? "رو به بهبود" : "بدون تغییر مشخص"}
                  </span>
                </div>
                <div className="sm-trend" aria-label="روند هشت ثبت اخیر">
                  {bars.map((bar, index) => {
                    const health = String(bar.health ?? "unknown");
                    const height = Math.max(8, asNumber(bar.height, 12));
                    return (
                      <span
                        key={index}
                        className={`is-${health}`}
                        style={{ height: `${height}%` }}
                      />
                    );
                  })}
                </div>
                <div className="sm-trend-labels">
                  <span>۸ دوره قبل</span>
                  <span>امروز</span>
                </div>
                <div className="sm-health-legend">
                  <span>
                    <i className="sm-legend-dot is-green" /> سبز{" "}
                    {faNum(kpi.green)}
                  </span>
                  <span>
                    <i className="sm-legend-dot is-yellow" /> زرد{" "}
                    {faNum(kpi.yellow)}
                  </span>
                  <span>
                    <i className="sm-legend-dot is-red" /> قرمز {faNum(kpi.red)}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-6">
            <div className="card card-bordered h-100">
              <div className="card-inner">
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <div>
                    <span className="overline-title">اولویت‌های امروز</span>
                    <h6 className="title mb-0">
                      سه موردی که باید تصمیم بگیرند
                    </h6>
                  </div>
                  <Link href="/alerts" className="link">
                    همه هشدارها
                  </Link>
                </div>
                <div className="sm-mini-list">
                  {priorities.length === 0 ? (
                    <p className="text-soft mb-0">
                      هشدار فوری ندارید. همه‌چیز برای شروع روز آماده است.
                    </p>
                  ) : (
                    priorities.map((item, index) => (
                      <Link href="/alerts" key={String(item.id ?? index)}>
                        <span
                          className={`sm-priority-num ${item.tone === "is-high" || item.tone === "high" ? "is-high" : ""}`}
                        >
                          {faNum(index + 1)}
                        </span>
                        <span className="sm-mini-copy">
                          <strong>{String(item.title ?? "")}</strong>
                          <small>
                            {String(item.description ?? "نیازمند تصمیم مدیر")}
                          </small>
                        </span>
                        <span
                          className={`badge badge-dim ${item.tone === "is-high" || item.tone === "high" ? "bg-danger" : "bg-outline-warning"}`}
                        >
                          {String(item.severityLabel ?? item.severity ?? "")}
                        </span>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-6">
            <div className="card card-bordered h-100">
              <div className="card-inner">
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <div>
                    <span className="overline-title">ثبت‌های من</span>
                    <h6 className="title mb-0">نزدیک به موعد</h6>
                  </div>
                  <Link href="/checkins" className="link">
                    مشاهده همه
                  </Link>
                </div>
                <div className="sm-mini-list">
                  {due.length === 0 ? (
                    <p className="text-soft mb-0">
                      ثبت بازی ندارید. ثبت‌های این دوره تکمیل شده‌اند.
                    </p>
                  ) : (
                    due.map((item) => (
                      <Link href={`/kpis/${item.id}`} key={String(item.id)}>
                        <span className="sm-priority-num">↗</span>
                        <span className="sm-mini-copy">
                          <strong>{String(item.name ?? "")}</strong>
                          <small>موعد: {faNum(item.period)}</small>
                        </span>
                        <span className="badge badge-dim bg-outline-warning">
                          پیش‌نویس
                        </span>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-6">
            <div className="card card-bordered h-100">
              <div className="card-inner">
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <div>
                    <span className="overline-title">پیگیری اقدام</span>
                    <h6 className="title mb-0">کارهای باز تیم</h6>
                  </div>
                  <Link href="/actions" className="link">
                    مرکز اقدام
                  </Link>
                </div>
                <div className="sm-mini-list">
                  {teamActions.length === 0 ? (
                    <p className="text-soft mb-0">اقدام بازی وجود ندارد.</p>
                  ) : (
                    teamActions.map((item, index) => (
                      <Link
                        href="/actions"
                        className="sm-mini-row"
                        key={String(item.id ?? index)}
                      >
                        <span className="sm-priority-num">
                          {faNum(index + 1)}
                        </span>
                        <span className="sm-mini-copy">
                          <strong>{String(item.title ?? "")}</strong>
                          <small>
                            مسئول: {String(item.owner ?? "تعیین نشده")}
                          </small>
                        </span>
                        <span className="text-soft small">
                          {String(item.dueAt ?? item.due ?? "بدون موعد")}
                        </span>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

async function CollectionTable({
  collection,
  label,
}: {
  collection: NonNullable<RoutePage["collection"]>;
  label?: string;
}) {
  const definition = columns[collection];
  if (!definition)
    return (
      <div className="card card-bordered">
        <div className="card-inner text-soft">این فهرست در API موجود نیست.</div>
      </div>
    );
  const result = await serverApi<RecordValue[]>(`data/${definition.api}`);
  const rows = Array.isArray(result.data) ? result.data : [];
  return (
    <div className="card card-bordered">
      <div className="card-inner">
        <h2 className="title">{label ?? "فهرست"}</h2>
        {result.error && (
          <p className="alert alert-fill alert-warning mt-3" role="alert">
            {result.error}
          </p>
        )}
        <div className="sm-table-wrap mt-3">
          <table className="table table-tranx">
            <thead>
              <tr>
                {definition.labels.map((item) => (
                  <th key={item}>{item}</th>
                ))}
                {collection === "modules" && <th>عملیات</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={String(row.id ?? index)}>
                  {definition.keys.map((key) => (
                    <td key={key}>
                      {collection === "access-levels" && key === "name" ? (
                        <Link
                          href={`/admin/access-levels/${row.id}/edit`}
                          className="link-primary"
                        >
                          {format(row.name)}
                        </Link>
                      ) : (
                        format(
                          key === "fullName"
                            ? [row.firstName, row.lastName]
                                .filter(Boolean)
                                .join(" ")
                            : row[key],
                        )
                      )}
                    </td>
                  ))}
                  {collection === "modules" && (
                    <td>
                      <ModuleToggle
                        slug={String(row.slug)}
                        active={row.isActive === true}
                      />
                    </td>
                  )}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={definition.labels.length}
                    className="py-5 text-center text-soft"
                  >
                    {result.error
                      ? "برای این حساب داده‌ای در دسترس نیست."
                      : "داده‌ای برای نمایش وجود ندارد."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

async function AccessLevelsPanel() {
  return (
    <>
      <div className="flex justify-end mb-3">
        <Link href="/admin/access-levels/create" className="btn btn-primary">
          ساخت سطح دسترسی
        </Link>
      </div>
      <CollectionTable collection="access-levels" label="سطح‌های دسترسی" />
    </>
  );
}
async function FormPage({
  form,
  path,
}: {
  form?: RoutePage["form"];
  path?: string;
}) {
  const fieldsByForm: Record<string, AuthField[]> = {
    department: [
      { name: "name", label: "نام واحد", required: true },
      { name: "code", label: "کد واحد", required: true },
      { name: "managerUserId", label: "شناسه مدیر", type: "number" },
    ],
    kpi: [
      {
        name: "departmentId",
        label: "شناسه واحد",
        type: "number",
        required: true,
      },
      { name: "code", label: "کد شاخص", required: true },
      { name: "name", label: "نام شاخص", required: true },
      {
        name: "direction",
        label: "جهت مطلوب",
        type: "select",
        options: ["higher", "lower", "range"],
        required: true,
      },
      {
        name: "targetValue",
        label: "مقدار هدف",
        type: "number",
        required: true,
      },
      { name: "ownerUserId", label: "شناسه مسئول", type: "number" },
      { name: "description", label: "شرح شاخص", type: "textarea" },
    ],
    checkin: [
      { name: "kpiId", label: "شناسه شاخص", type: "number", required: true },
      {
        name: "period",
        label: "دوره گزارش (شمسی)",
        placeholder: "۱۴۰۵-W۱۵",
        required: true,
      },
      {
        name: "actualValue",
        label: "مقدار واقعی",
        type: "number",
        required: true,
      },
      { name: "note", label: "توضیحات", type: "textarea" },
      { name: "blockers", label: "موانع", type: "textarea" },
    ],
    action: [
      {
        name: "departmentId",
        label: "شناسه واحد",
        type: "number",
        required: true,
      },
      { name: "alertId", label: "شناسه هشدار مرتبط", type: "number" },
      { name: "title", label: "عنوان اقدام", required: true },
      { name: "description", label: "شرح", type: "textarea" },
      { name: "successMetric", label: "معیار موفقیت", required: true },
      {
        name: "ownerUserId",
        label: "شناسه مسئول",
        type: "number",
        required: true,
      },
      { name: "priority", label: "اولویت", required: true },
      {
        name: "dueAt",
        label: "موعد شمسی",
        placeholder: "۱۴۰۵/۰۷/۳۰",
        required: true,
      },
    ],
    priority: [{ name: "name", label: "عنوان اولویت", required: true }],
    "settings-general": [
      { name: "companyName", label: "نام سازمان", required: true },
      { name: "logoPath", label: "مسیر نشان" },
    ],
    sms: [
      { name: "apiKey", label: "کلید API", type: "password" },
      { name: "sender", label: "شماره فرستنده", required: true },
    ],
    "profile-personal": [
      { name: "firstName", label: "نام" },
      { name: "lastName", label: "نام خانوادگی" },
      { name: "jobTitle", label: "عنوان شغلی" },
      { name: "address", label: "نشانی", type: "textarea" },
    ],
    "access-level": [
      { name: "name", label: "نام سطح دسترسی", required: true },
      { name: "departmentId", label: "شناسه واحد (اختیاری)", type: "number" },
      {
        name: "permissions",
        label: "مجوزها (با Ctrl انتخاب کنید)",
        type: "multiselect",
        options: [
          "manage-modules",
          "manage-settings",
          "manage-users",
          "manage-roles",
          "view-audit-log",
          "manage-departments",
          "access-all-departments",
          "alerts.view",
          "alerts.acknowledge",
          "alerts.resolve",
          "actions.view",
          "actions.manage",
          "actions.update-own",
          "kpi.view",
          "kpi.manage",
          "kpi.submit",
        ],
      },
    ],
    "profile-security": [
      {
        name: "current_password",
        label: "رمز عبور فعلی",
        type: "password",
        required: true,
      },
      {
        name: "password",
        label: "رمز عبور جدید",
        type: "password",
        required: true,
      },
      {
        name: "password_confirmation",
        label: "تکرار رمز عبور جدید",
        type: "password",
        required: true,
      },
    ],
    "profile-photo": [
      {
        name: "avatar",
        label:
          "انتخاب تصویر (JPG, PNG, WebP؛ ۵۰ تا ۲۰۰ پیکسل؛ حداکثر ۲۰۰ کیلوبایت)",
        type: "file",
        required: true,
      },
    ],
  };
  const endpoints: Record<
    string,
    { endpoint: string; method: "POST" | "PATCH" }
  > = {
    department: { endpoint: "/api/departments", method: "POST" },
    kpi: { endpoint: "/api/kpis", method: "POST" },
    checkin: { endpoint: "/api/checkins", method: "POST" },
    action: { endpoint: "/api/actions", method: "POST" },
    priority: { endpoint: "/api/actions/priorities", method: "POST" },
    "settings-general": { endpoint: "/api/settings/branding", method: "PATCH" },
    sms: { endpoint: "/api/sms/settings", method: "PATCH" },
    "profile-personal": { endpoint: "/api/users/me", method: "PATCH" },
    "access-level": {
      endpoint: path?.match(/\/admin\/access-levels\/(\d+)\/edit$/)
        ? `/api/authorization/access-levels/${path.match(/\/admin\/access-levels\/(\d+)\/edit$/)?.[1]}`
        : "/api/authorization/access-levels",
      method: path?.endsWith("/edit") ? "PATCH" : "POST",
    },
    "profile-security": { endpoint: "/api/users/me/password", method: "POST" },
    "profile-photo": { endpoint: "/api/users/me/avatar", method: "POST" },
  };
  let fields = fieldsByForm[form ?? ""] ?? [];
  const editMatch =
    form === "access-level"
      ? path?.match(/\/admin\/access-levels\/(\d+)\/edit$/)
      : null;
  if (editMatch) {
    const result = await serverApi<RecordValue[]>(
      "authorization/access-levels",
    );
    const level = result.data?.find((row) => String(row.id) === editMatch[1]);
    if (level)
      fields = fields.map((field) => ({
        ...field,
        value:
          field.name === "name"
            ? String(level.name ?? "")
            : field.name === "departmentId"
              ? String(level.departmentId ?? "")
              : field.name === "permissions"
                ? Array.isArray(level.permissions)
                  ? level.permissions.map(String).join(",")
                  : ""
                : field.value,
      }));
  }
  const config = form ? endpoints[form] : undefined;
  return (
    <div className="card card-bordered">
      <div className="card-inner">
        <h2 className="title">{form ?? "فرم"}</h2>
        {config ? (
          <>
            <DemoForm
              fields={fields}
              submitLabel="ذخیره"
              endpoint={config.endpoint}
              method={config.method}
            />
            {form === "profile-photo" && <AvatarRemoveButton />}
          </>
        ) : (
          <p className="text-soft mt-3">
            فرم این عملیات هنوز به مسیر API متصل نشده است.
          </p>
        )}
      </div>
    </div>
  );
}

export async function WorkspacePage({
  page,
  tab,
  view,
}: {
  page: RoutePage;
  tab?: string;
  view?: string;
}) {
  if (page.kind === "board" && page.board)
    return PerformanceBoard({ page, view });
  if (page.kind === "directory") return OrganizationBoard({ page });
  if (page.kind === "weekly" || page.path === "/kpi-reports/weekly")
    return WeeklyBoard();
  if (page.path === "/admin/modules") return ModulesBoard();
  if (page.path === "/admin/audit-log") return AuditBoard();
  if (page.path === "/settings" || page.path.startsWith("/settings/"))
    return SettingsBoard({ page });
  if (page.kind === "profile")
    return ProfileBoard({
      section:
        page.form === "profile-photo"
          ? "photo"
          : page.form === "profile-security"
            ? "security"
            : "personal",
    });
  let content: React.ReactNode;
  if (page.kind === "dashboard") content = await Dashboard();
  else if (page.kind === "table" && page.collection)
    content = (
      <CollectionTable collection={page.collection} label={page.title} />
    );
  else if (page.kind === "form" || page.kind === "profile")
    content = <FormPage form={page.form} path={page.path} />;
  else if (page.kind === "settings" && page.form === "settings-roles")
    content = <AccessLevelsPanel />;
  else if (page.kind === "settings")
    content = (
      <div className="card card-bordered">
        <div className="card-inner">
          <h2 className="title">{page.title}</h2>
          <p className="text-soft mt-3">{page.description}</p>
          {page.form && <FormPage form={page.form} path={page.path} />}
          {tab && <p className="form-note mt-3">{tab}</p>}
        </div>
      </div>
    );
  else content = <CollectionTable collection="checkins" label={page.title} />;
  if (page.kind === "dashboard") return content;
  const createLink =
    page.collection === "access-levels"
      ? "/admin/access-levels/create"
      : undefined;
  return (
    <>
      <PageHeading
        page={page}
        action={
          page.actionLabel && createLink ? (
            <Link href={createLink} className="btn btn-primary">
              {page.actionLabel}
            </Link>
          ) : undefined
        }
      />
      {content}
    </>
  );
}

export function routeForUi(segments: string[] = []) {
  return getRoutePage(segments);
}
